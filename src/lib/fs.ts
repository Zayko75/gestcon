// Almacenamiento de la carpeta de datos.
// Dos orígenes con la misma interfaz:
//   - Carpeta del ordenador o de red (File System Access API, Chrome / Edge)
//   - Carpeta de Google Drive (API de Google Drive, ver drive.ts)

export interface InfoArchivo {
  nombre: string
  tamano: number
  modificado: number
}

export interface LecturaArchivo {
  datos: Uint8Array
  /** Fecha de modificación (ms) para mostrar */
  modificado: number
  /** Marca de versión para detectar cambios hechos fuera de esta ventana */
  marca: string
}

export interface Carpeta {
  tipo: 'local' | 'drive'
  nombre: string
  sub(nombre: string, crear?: boolean): Promise<Carpeta>
  existe(nombre: string): Promise<boolean>
  leer(nombre: string): Promise<LecturaArchivo>
  modificado(nombre: string): Promise<number>
  marca(nombre: string): Promise<string>
  /** Escribe el archivo y devuelve su nueva marca de versión */
  escribir(nombre: string, datos: Uint8Array): Promise<string>
  borrar(nombre: string): Promise<void>
  listar(): Promise<InfoArchivo[]>
}

// ---------- Funciones de uso general (independientes del origen) ----------
export const subcarpeta = (dir: Carpeta, nombre: string, crear = true) => dir.sub(nombre, crear)
export const existe = (dir: Carpeta, nombre: string) => dir.existe(nombre)
export const leerBytes = (dir: Carpeta, nombre: string) => dir.leer(nombre)
export const modificadoDe = (dir: Carpeta, nombre: string) => dir.modificado(nombre)
export const marcaDe = (dir: Carpeta, nombre: string) => dir.marca(nombre)
export const escribirBytes = (dir: Carpeta, nombre: string, datos: Uint8Array) => dir.escribir(nombre, datos)
export const borrarArchivo = (dir: Carpeta, nombre: string) => dir.borrar(nombre)
export const listarArchivos = (dir: Carpeta) => dir.listar()

// ---------- Carpeta del ordenador / red ----------
type Dir = FileSystemDirectoryHandle

export function soportado(): boolean {
  return typeof (window as any).showDirectoryPicker === 'function'
}

export class CarpetaLocal implements Carpeta {
  tipo = 'local' as const
  constructor(public h: Dir) {}
  get nombre() { return this.h.name }

  async sub(nombre: string, crear = true) {
    return new CarpetaLocal(await this.h.getDirectoryHandle(nombre, { create: crear }))
  }
  async existe(nombre: string) {
    try { await this.h.getFileHandle(nombre); return true } catch { return false }
  }
  async leer(nombre: string) {
    const f = await (await this.h.getFileHandle(nombre)).getFile()
    return { datos: new Uint8Array(await f.arrayBuffer()), modificado: f.lastModified, marca: String(f.lastModified) }
  }
  async modificado(nombre: string) {
    return (await (await this.h.getFileHandle(nombre)).getFile()).lastModified
  }
  async marca(nombre: string) {
    return String(await this.modificado(nombre))
  }
  async escribir(nombre: string, datos: Uint8Array) {
    const fh = await this.h.getFileHandle(nombre, { create: true })
    const w = await (fh as any).createWritable()
    await w.write(datos)
    await w.close()
    return String((await fh.getFile()).lastModified)
  }
  async borrar(nombre: string) {
    await this.h.removeEntry(nombre)
  }
  async listar() {
    const out: InfoArchivo[] = []
    for await (const [nombre, h] of (this.h as any).entries() as AsyncIterable<[string, FileSystemHandle]>) {
      if (h.kind !== 'file') continue
      const f = await (h as FileSystemFileHandle).getFile()
      out.push({ nombre, tamano: f.size, modificado: f.lastModified })
    }
    return out
  }
}

export async function elegirCarpeta(): Promise<Dir> {
  return (window as any).showDirectoryPicker({ mode: 'readwrite', id: 'gestcon' })
}

/** Vuelve a pedir permiso de lectura/escritura (hay que llamarlo desde un clic) */
export async function asegurarPermiso(h: Dir): Promise<boolean> {
  const opts = { mode: 'readwrite' }
  const hh = h as any
  if ((await hh.queryPermission(opts)) === 'granted') return true
  return (await hh.requestPermission(opts)) === 'granted'
}

// ---------- Conexión recordada (IndexedDB) ----------
export type ConexionGuardada =
  | { tipo: 'local'; handle: Dir; nombre: string }
  | { tipo: 'drive'; id: string; nombre: string }

const BD = 'gestcon-app'
const ALMACEN = 'kv'

function abrirIdb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(BD, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(ALMACEN)
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
}

async function idbPut(clave: string, valor: unknown): Promise<void> {
  const db = await abrirIdb()
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(ALMACEN, 'readwrite')
    if (valor === undefined) tx.objectStore(ALMACEN).delete(clave)
    else tx.objectStore(ALMACEN).put(valor, clave)
    tx.oncomplete = () => res()
    tx.onerror = () => rej(tx.error)
  })
  db.close()
}

async function idbGet<T>(clave: string): Promise<T | null> {
  const db = await abrirIdb()
  const v = await new Promise<T | null>((res, rej) => {
    const r = db.transaction(ALMACEN).objectStore(ALMACEN).get(clave)
    r.onsuccess = () => res((r.result as T) ?? null)
    r.onerror = () => rej(r.error)
  })
  db.close()
  return v
}

export async function guardarConexion(c: ConexionGuardada): Promise<void> {
  await idbPut('conexion', c)
}

export async function cargarConexion(): Promise<ConexionGuardada | null> {
  try {
    const c = await idbGet<ConexionGuardada>('conexion')
    if (c) return c
    // Versiones anteriores solo guardaban el handle de la carpeta local
    const h = await idbGet<Dir>('carpeta')
    return h ? { tipo: 'local', handle: h, nombre: h.name } : null
  } catch {
    return null
  }
}
