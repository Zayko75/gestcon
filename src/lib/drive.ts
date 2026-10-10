// Conexión con Google Drive: inicio de sesión (Google Identity Services) y API de Drive v3.
// La aplicación sigue sin servidor: el navegador habla directamente con Google.
import type { Carpeta, InfoArchivo, LecturaArchivo } from './fs'

const SCOPE = 'https://www.googleapis.com/auth/drive'
const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'
const CARPETA_MIME = 'application/vnd.google-apps.folder'
const GDOC_MIME = 'application/vnd.google-apps.document'
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const COMUNES = 'supportsAllDrives=true&includeItemsFromAllDrives=true'
const CAMPOS = 'id,name,mimeType,size,modifiedTime,version'

/** La sesión de Google ha caducado: hay que volver a conectar con un clic */
export class SesionCaducadaError extends Error {
  constructor() { super('La sesión de Google ha caducado. Pulsa «Reconectar con Google».') }
}

// ---------- ID de cliente OAuth ----------
const CLAVE_CLIENTE = 'gestcon-google-client-id'

export function clientId(): string {
  const env = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim()
  if (env) return env
  try { return localStorage.getItem(CLAVE_CLIENTE)?.trim() ?? '' } catch { return '' }
}

export function clientIdDeConfiguracion(): boolean {
  return !!(import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim()
}

export function guardarClientId(id: string): void {
  try { localStorage.setItem(CLAVE_CLIENTE, id.trim()) } catch { /* sin almacenamiento */ }
}

// ---------- Inicio de sesión ----------
let token: { valor: string; caduca: number } | null = null
let gisCargado: Promise<void> | null = null

function cargarGis(): Promise<void> {
  if ((window as any).google?.accounts?.oauth2) return Promise.resolve()
  gisCargado ??= new Promise((res, rej) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => res()
    s.onerror = () => { gisCargado = null; rej(new Error('No se pudo cargar el inicio de sesión de Google. Comprueba la conexión a internet.')) }
    document.head.appendChild(s)
  })
  return gisCargado
}

export function sesionActiva(): boolean {
  return !!token && token.caduca > Date.now() + 30_000
}

/** Abre la ventana de Google para iniciar sesión. Debe llamarse desde un clic. */
export async function iniciarSesion(): Promise<void> {
  const id = clientId()
  if (!id) throw new Error('Falta el ID de cliente de Google. Configúralo en la pantalla de conexión.')
  await cargarGis()
  await new Promise<void>((res, rej) => {
    const cliente = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: id,
      scope: SCOPE,
      callback: (r: any) => {
        if (r.error || !r.access_token) {
          rej(new Error('Google no ha dado acceso: ' + (r.error_description || r.error || 'sin permiso')))
          return
        }
        token = { valor: r.access_token, caduca: Date.now() + Number(r.expires_in || 3600) * 1000 }
        res()
      },
      error_callback: (e: any) => {
        rej(new Error(e?.type === 'popup_closed'
          ? 'Se cerró la ventana de Google sin terminar de iniciar sesión.'
          : e?.type === 'popup_failed_to_open'
            ? 'El navegador bloqueó la ventana de Google. Permite las ventanas emergentes para esta página.'
            : 'No se pudo iniciar sesión con Google.'))
      },
    })
    cliente.requestAccessToken({ prompt: '' })
  })
}

export function cerrarSesion(): void {
  if (token) (window as any).google?.accounts?.oauth2?.revoke?.(token.valor, () => {})
  token = null
}

// ---------- Llamadas a la API ----------
async function api(url: string, init: RequestInit = {}): Promise<Response> {
  if (!sesionActiva()) throw new SesionCaducadaError()
  const r = await fetch(url, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${token!.valor}` } })
  if (r.status === 401) { token = null; throw new SesionCaducadaError() }
  if (!r.ok) {
    let detalle = ''
    try { detalle = (await r.json())?.error?.message ?? '' } catch { /* sin detalle */ }
    if (r.status === 403 && /insufficient|scope/i.test(detalle)) {
      token = null
      throw new Error('Google Drive no ha dado permiso suficiente. Vuelve a conectar y marca la casilla de acceso a Drive.')
    }
    if (r.status === 404) throw new Error('No se encuentra el archivo o la carpeta en Google Drive.')
    throw new Error(`Google Drive respondió con un error (${r.status})${detalle ? ': ' + detalle : ''}`)
  }
  return r
}

const q = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")

interface Meta { id: string; name: string; mimeType: string; size?: string; modifiedTime: string; version: string }

async function buscar(consulta: string, extra = ''): Promise<Meta[]> {
  const out: Meta[] = []
  let pagina = ''
  do {
    const url = `${API}/files?q=${encodeURIComponent(consulta)}&fields=nextPageToken,files(${CAMPOS})&pageSize=1000&orderBy=modifiedTime desc&${COMUNES}${extra}${pagina ? '&pageToken=' + pagina : ''}`
    const j = await (await api(url)).json()
    out.push(...j.files)
    pagina = j.nextPageToken ?? ''
  } while (pagina)
  return out
}

function mimeDe(nombre: string): string {
  if (/\.docx$/i.test(nombre)) return DOCX_MIME
  if (/\.sqlite$/i.test(nombre)) return 'application/x-sqlite3'
  return 'application/octet-stream'
}

// ---------- Elegir la carpeta ----------
export interface CandidatoDrive { id: string; nombre: string; modificado: Date; tieneDatos: boolean }

/** Busca carpetas con ese nombre en Drive (incluidas las compartidas) */
export async function buscarCarpetas(nombre: string): Promise<CandidatoDrive[]> {
  const carpetas = await buscar(`name = '${q(nombre.trim())}' and mimeType = '${CARPETA_MIME}' and trashed = false`, '&corpora=allDrives')
  const out: CandidatoDrive[] = []
  for (const c of carpetas) {
    const datos = await buscar(`'${c.id}' in parents and name = 'datos.sqlite' and trashed = false`)
    out.push({ id: c.id, nombre: c.name, modificado: new Date(c.modifiedTime), tieneDatos: datos.length > 0 })
  }
  return out
}

// ---------- Carpeta de Drive ----------
export class CarpetaDrive implements Carpeta {
  tipo = 'drive' as const
  private hijos: Map<string, Meta> | null = null
  private subs = new Map<string, CarpetaDrive>()
  constructor(public id: string, public nombre: string) {}

  private async cargar(forzar = false): Promise<Map<string, Meta>> {
    if (this.hijos && !forzar) return this.hijos
    const m = new Map<string, Meta>()
    // Ordenados por fecha: si hay nombres repetidos, se usa el más reciente
    for (const f of await buscar(`'${this.id}' in parents and trashed = false`)) if (!m.has(f.name)) m.set(f.name, f)
    this.hijos = m
    return m
  }

  private async meta(nombre: string): Promise<Meta | undefined> {
    return (await this.cargar()).get(nombre) ?? (await this.cargar(true)).get(nombre)
  }

  private async archivo(nombre: string): Promise<Meta> {
    const m = await this.meta(nombre)
    if (!m || m.mimeType === CARPETA_MIME) throw new Error(`No existe «${nombre}» en la carpeta «${this.nombre}» de Google Drive.`)
    return m
  }

  /** Metadatos al día (sin caché), para detectar cambios externos */
  private async fresco(nombre: string): Promise<Meta> {
    const m = await this.archivo(nombre)
    const f: Meta = await (await api(`${API}/files/${m.id}?fields=${CAMPOS},trashed&${COMUNES}`)).json()
    if ((f as any).trashed) { this.hijos?.delete(nombre); throw new Error(`«${nombre}» está en la papelera de Google Drive.`) }
    this.hijos?.set(nombre, f)
    return f
  }

  async sub(nombre: string, crear = true): Promise<Carpeta> {
    const ya = this.subs.get(nombre)
    if (ya) return ya
    let m = await this.meta(nombre)
    if (!m || m.mimeType !== CARPETA_MIME) {
      if (!crear) throw new Error(`No existe la carpeta «${nombre}» en Google Drive.`)
      m = await (await api(`${API}/files?fields=${CAMPOS}&${COMUNES}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nombre, mimeType: CARPETA_MIME, parents: [this.id] }),
      })).json() as Meta
      this.hijos?.set(nombre, m)
    }
    const c = new CarpetaDrive(m.id, nombre)
    this.subs.set(nombre, c)
    return c
  }

  async existe(nombre: string) {
    const m = await this.meta(nombre)
    return !!m && m.mimeType !== CARPETA_MIME
  }

  async leer(nombre: string): Promise<LecturaArchivo> {
    const m = await this.fresco(nombre)
    // Una plantilla convertida a documento de Google se descarga como Word
    const url = m.mimeType === GDOC_MIME
      ? `${API}/files/${m.id}/export?mimeType=${encodeURIComponent(DOCX_MIME)}`
      : `${API}/files/${m.id}?alt=media&${COMUNES}`
    const datos = new Uint8Array(await (await api(url)).arrayBuffer())
    return { datos, modificado: Date.parse(m.modifiedTime), marca: m.version }
  }

  async modificado(nombre: string) {
    return Date.parse((await this.fresco(nombre)).modifiedTime)
  }

  async marca(nombre: string) {
    return (await this.fresco(nombre)).version
  }

  async escribir(nombre: string, datos: Uint8Array): Promise<string> {
    const mime = mimeDe(nombre)
    const m = await this.meta(nombre)
    let r: Meta
    if (m && m.mimeType !== CARPETA_MIME && m.mimeType !== GDOC_MIME) {
      r = await (await api(`${UPLOAD}/files/${m.id}?uploadType=media&fields=${CAMPOS}&${COMUNES}`, {
        method: 'PATCH', headers: { 'Content-Type': mime }, body: datos as BlobPart as Blob,
      })).json()
    } else {
      const limite = 'gestcon' + Math.random().toString(36).slice(2)
      const cuerpo = new Blob([
        `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
        JSON.stringify({ name: nombre, mimeType: mime, parents: [this.id] }),
        `\r\n--${limite}\r\nContent-Type: ${mime}\r\n\r\n`,
        datos as BlobPart,
        `\r\n--${limite}--`,
      ])
      r = await (await api(`${UPLOAD}/files?uploadType=multipart&fields=${CAMPOS}&${COMUNES}`, {
        method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${limite}` }, body: cuerpo,
      })).json()
    }
    ;(await this.cargar()).set(nombre, r)
    return r.version
  }

  /** Mueve el archivo a la papelera de Drive (se vacía sola a los 30 días) */
  async borrar(nombre: string) {
    const m = await this.archivo(nombre)
    await api(`${API}/files/${m.id}?${COMUNES}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }),
    })
    this.hijos?.delete(nombre)
  }

  async listar(): Promise<InfoArchivo[]> {
    const out: InfoArchivo[] = []
    for (const [nombre, m] of await this.cargar(true)) {
      if (m.mimeType === CARPETA_MIME) continue
      out.push({ nombre, tamano: Number(m.size ?? 0), modificado: Date.parse(m.modifiedTime) })
    }
    return out
  }
}
