// Conexión con Google Drive a través del «puente»: un script de Google Apps Script instalado en la cuenta
// del propietario de la carpeta (ver puente/Code.gs). Los usuarios no inician sesión en Google: entran con su
// usuario y contraseña de GESTCON, y con la clave de datos que abre su contraseña se calcula la credencial
// que el puente exige para todo lo que no sea leer el archivo cifrado.
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
  constructor() { super('Google Drive no acepta la credencial de esta sesión. Cierra la sesión y vuelve a entrar.') }
}

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')

/** Credencial para el puente: HMAC-SHA256 de un texto fijo con la clave de datos */
export async function credencialDe(claveDatos: Uint8Array): Promise<string> {
  const k = await crypto.subtle.importKey('raw', claveDatos as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return hex(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode('gestcon-puente-v1')))
}

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

export type EstadoPuente = 'ok' | 'sin_activar' | 'sin_permiso'

/** Carpeta de Drive a través del puente. «clave» da la clave de datos de la sesión (o null si aún no se ha entrado). */
export class CarpetaPuente implements Carpeta {
  tipo = 'puente' as const
  private credencial: { de: Uint8Array; valor: string } | null = null

  constructor(public url: string, public nombre: string, private clave: () => Uint8Array | null, private ruta: string[] = []) {}

  private async cred(): Promise<string | undefined> {
    const c = this.clave()
    if (!c) return undefined
    if (this.credencial?.de !== c) this.credencial = { de: c, valor: await credencialDe(c) }
    return this.credencial.valor
  }

  private async llamar<T>(op: string, extra: Record<string, unknown> = {}): Promise<T> {
    const cuerpo = JSON.stringify({ op, ruta: this.ruta, credencial: await this.cred(), ...extra })
    let r: Response
    try {
      // text/plain: sin petición previa de CORS, que Apps Script no admite
      r = await fetch(this.url, { method: 'POST', body: cuerpo, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow' })
    } catch {
      throw new Error('No se puede contactar con Google Drive. Comprueba la conexión a internet.')
    }
    if (!r.ok) throw new Error(`Google Drive respondió con un error (${r.status}).`)
    let j: any
    try { j = await r.json() } catch { throw new Error('Respuesta inesperada de la conexión con Google Drive.') }
    if (j.error) {
      const m = String(j.error)
      if (m.startsWith('sin_activar')) throw new SinActivarError()
      if (m.startsWith('sin_permiso')) throw new SinPermisoPuenteError()
      throw new Error(m)
    }
    return j as T
  }

  /** ¿Acepta el puente la credencial de esta sesión? */
  async estado(): Promise<EstadoPuente> {
    return (await this.llamar<{ estado: EstadoPuente }>('estado')).estado
  }

  /** Registra la credencial de esta sesión con el código de activación (una sola vez) */
  async activar(codigo: string): Promise<void> {
    await this.llamar('activar', { codigo })
  }

  /** Subcarpetas que ya se sabe que existen (para no preguntarlo cada vez) */
  private static conocidas = new Set<string>()

  async sub(nombre: string, crear = true): Promise<Carpeta> {
    const c = new CarpetaPuente(this.url, nombre, this.clave, [...this.ruta, nombre])
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
    await this.llamar('borrar', { nombre })
  }

  async listar(): Promise<InfoArchivo[]> {
    return (await this.llamar<{ archivos: InfoArchivo[] }>('listar')).archivos
  }
}
