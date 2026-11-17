// Conexión con Google Drive a través del «puente»: un script de Google Apps Script instalado en la cuenta
// del propietario de la carpeta (ver puente/Code.gs). Los usuarios no inician sesión en Google: entran con su
// usuario y contraseña de GESTCON. Con ellos se calcula su credencial para el puente, que solo guarda su huella.
// Los administradores dan de alta y retiran esas credenciales al gestionar los usuarios.
import type { Carpeta, InfoArchivo, LecturaArchivo } from './fs'

/** Dirección del puente publicado (es pública: sin credencial no permite nada) */
const URL_PUENTE = 'https://script.google.com/macros/s/AKfycbxJJ5H-23oFYphdUBLaa4rAAgy4hwHct_FtvGWSkJNNloqkPpK0SGzwh5NrTWBvrsVTKg/exec'
const CLAVE_URL = 'gestcon-puente-url'

export function urlPuente(): string {
  try {
    const propia = localStorage.getItem(CLAVE_URL)?.trim()
    if (propia) return propia === 'no' ? '' : propia
  } catch { /* sin almacenamiento */ }
  const env = (import.meta.env.VITE_PUENTE_URL as string | undefined)?.trim()
  if (env) return env === 'no' ? '' : env
  return URL_PUENTE.includes('PENDIENTE') ? '' : URL_PUENTE
}

export class SinActivarError extends Error {
  constructor() { super('La conexión con Google Drive aún no está activada. Un administrador debe entrar y activarla con el código de activación.') }
}
export class SinPermisoPuenteError extends Error {
  constructor() { super('Este usuario no tiene acceso a los datos de Google Drive. Pide al administrador que te ponga una contraseña provisional.') }
}

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')

/** Usuario del puente que corresponde al código de recuperación */
export const USUARIO_RECUPERACION = '#recuperacion'

/** Credencial de un usuario para el puente: PBKDF2 de su contraseña (la sal depende del nombre de usuario) */
export async function credencialPuente(usuario: string, clave: string): Promise<string> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(clave.normalize('NFC')), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode('gestcon-puente|' + usuario), iterations: 150_000 }, base, 256)
  return hex(bits)
}

/** Huella de una credencial: lo único que guarda el puente */
export async function huellaDe(credencial: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(credencial)))
}

/** Credencial común de la versión 1 del puente (solo para migrar a credenciales por usuario) */
export async function credencialAntigua(claveDatos: Uint8Array): Promise<string> {
  const k = await crypto.subtle.importKey('raw', claveDatos as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return hex(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode('gestcon-puente-v1')))
}

export interface Identidad { usuario: string; credencial: string }

function aB64(d: Uint8Array): string {
  let s = ''
  for (let i = 0; i < d.length; i += 0x8000) s += String.fromCharCode(...d.subarray(i, i + 0x8000))
  return btoa(s)
}
function deB64(s: string): Uint8Array {
  const b = atob(s)
  const out = new Uint8Array(b.length)
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i)
  return out
}

function mimeDe(nombre: string): string {
  if (/\.docx$/i.test(nombre)) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (/\.sqlite$/i.test(nombre)) return 'application/x-sqlite3'
  return 'application/octet-stream'
}

export type EstadoPuente = 'ok' | 'sin_activar' | 'migrar' | 'sin_permiso'

/** Carpeta de Drive a través del puente. La identidad (usuario y credencial) la comparten todas sus subcarpetas. */
export class CarpetaPuente implements Carpeta {
  tipo = 'puente' as const

  constructor(public url: string, public nombre: string, private sesion: { id: Identidad | null } = { id: null }, private ruta: string[] = []) {}

  /** Usuario con el que se hacen las peticiones (null al cerrar la sesión) */
  ponerIdentidad(id: Identidad | null) { this.sesion.id = id }
  get identidad(): Identidad | null { return this.sesion.id }

  /**
   * Una petición al puente. Apps Script a veces deja una petición colgada sin responder nunca (medido el 17/11/2026:
   * 2 de cada 12), y al entrar se hacen unas 8 seguidas: sin límite de tiempo la aplicación se quedaba cargando para
   * siempre. Cada intento tiene un tiempo límite (también para recibir la respuesta entera) y, si no responde o falla
   * la red, se repite. Todas las operaciones se pueden repetir sin efectos dobles, salvo «activar», que no se repite.
   */
  private async llamar<T>(op: string, extra: Record<string, unknown> = {}): Promise<T> {
    const cuerpo = JSON.stringify({ op, ruta: this.ruta, usuario: this.sesion.id?.usuario, credencial: this.sesion.id?.credencial, ...extra })
    const grande = op === 'leer' || op === 'escribir'
    const limite = grande ? 20_000 : 8_000
    const intentos = op === 'activar' ? 1 : 4
    let texto: string | null = null
    let estadoHttp = 0
    for (let n = 1; n <= intentos && texto === null; n++) {
      const corte = new AbortController()
      const reloj = setTimeout(() => corte.abort(), limite)
      try {
        // text/plain: sin petición previa de CORS, que Apps Script no admite
        const x = await fetch(this.url, { method: 'POST', body: cuerpo, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow', signal: corte.signal })
        // Errores pasajeros de Google (demasiadas peticiones, servidor ocupado): se reintenta
        if ((x.status === 429 || x.status >= 500) && n < intentos) throw new Error(String(x.status))
        estadoHttp = x.status
        texto = await x.text()
      } catch {
        if (n === intentos) {
          throw new Error(corte.signal.aborted
            ? 'Google Drive no responde. Comprueba la conexión a internet y vuelve a intentarlo dentro de un momento.'
            : 'No se puede contactar con Google Drive. Comprueba la conexión a internet.')
        }
        await new Promise((ok) => setTimeout(ok, 400 * n))
      } finally {
        clearTimeout(reloj)
      }
    }
    if (estadoHttp < 200 || estadoHttp >= 300) throw new Error(`Google Drive respondió con un error (${estadoHttp}).`)
    let j: any
    try { j = JSON.parse(texto ?? '') } catch { throw new Error('Respuesta inesperada de la conexión con Google Drive.') }
    if (j.error) {
      const m = String(j.error)
      if (m.startsWith('sin_activar')) throw new SinActivarError()
      if (m.startsWith('sin_permiso')) throw new SinPermisoPuenteError()
      throw new Error(m)
    }
    return j as T
  }

  /** ¿Acepta el puente la identidad de esta sesión? */
  async estado(): Promise<EstadoPuente> {
    return (await this.llamar<{ estado: EstadoPuente }>('estado')).estado
  }

  /** Registra al usuario de esta sesión como primer administrador: con el código de activación o migrando la versión 1 */
  async activar(x: { codigo?: string; legado?: string }): Promise<void> {
    await this.llamar('activar', x)
  }

  /** Da acceso a un usuario (huella de su credencial), se lo cambia o se lo quita (huella null) */
  async acceso(objetivo: string, huella: string | null | undefined, admin?: boolean): Promise<void> {
    await this.llamar('acceso', { objetivo, huella, admin })
  }

  /** Usuarios con acceso (solo administradores) */
  async accesos(): Promise<{ usuario: string; admin: boolean }[]> {
    return (await this.llamar<{ accesos: { usuario: string; admin: boolean }[] }>('accesos')).accesos
  }

  /** Subcarpetas que ya se sabe que existen (para no preguntarlo cada vez) */
  private static conocidas = new Set<string>()

  async sub(nombre: string, crear = true): Promise<Carpeta> {
    const c = new CarpetaPuente(this.url, nombre, this.sesion, [...this.ruta, nombre])
    const clave = this.url + '|' + c.ruta.join('/')
    if (CarpetaPuente.conocidas.has(clave)) return c
    const { existe } = await c.llamar<{ existe: boolean }>('carpeta', { crear })
    if (!existe) throw new Error(`No existe la carpeta «${nombre}» en Google Drive.`)
    CarpetaPuente.conocidas.add(clave)
    return c
  }

  async existe(nombre: string) {
    return (await this.llamar<{ existe: boolean }>('existe', { nombre })).existe
  }

  async leer(nombre: string): Promise<LecturaArchivo> {
    const j = await this.llamar<{ datos: string; modificado: number; marca: string }>('leer', { nombre })
    return { datos: deB64(j.datos), modificado: j.modificado, marca: j.marca }
  }

  async modificado(nombre: string) {
    return (await this.llamar<{ modificado: number }>('marca', { nombre })).modificado
  }

  async marca(nombre: string) {
    return (await this.llamar<{ marca: string }>('marca', { nombre })).marca
  }

  async escribir(nombre: string, datos: Uint8Array): Promise<string> {
    return (await this.llamar<{ marca: string }>('escribir', { nombre, datos: aB64(datos), mime: mimeDe(nombre) })).marca
  }

  async borrar(nombre: string) {
    try {
      await this.llamar('borrar', { nombre })
    } catch (e) {
      // Si un intento anterior sí lo borró (y su respuesta se perdió), el archivo ya no está: es lo que se quería
      if (!(e instanceof Error && e.message.startsWith('No existe'))) throw e
    }
  }

  async listar(): Promise<InfoArchivo[]> {
    return (await this.llamar<{ archivos: InfoArchivo[] }>('listar')).archivos
  }
}
