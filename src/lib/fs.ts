// Acceso a la carpeta de red con la File System Access API (Chrome / Edge)

type Dir = FileSystemDirectoryHandle

export function soportado(): boolean {
  return typeof (window as any).showDirectoryPicker === 'function'
}

// ---------- Persistencia del handle en IndexedDB ----------
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

export async function guardarHandle(h: Dir): Promise<void> {
  const db = await abrirIdb()
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(ALMACEN, 'readwrite')
    tx.objectStore(ALMACEN).put(h, 'carpeta')
    tx.oncomplete = () => res()
    tx.onerror = () => rej(tx.error)
  })
  db.close()
}

export async function cargarHandle(): Promise<Dir | null> {
  try {
    const db = await abrirIdb()
    const h = await new Promise<Dir | null>((res, rej) => {
      const r = db.transaction(ALMACEN).objectStore(ALMACEN).get('carpeta')
      r.onsuccess = () => res((r.result as Dir) ?? null)
      r.onerror = () => rej(r.error)
    })
    db.close()
    return h
  } catch {
    return null
  }
}

export async function olvidarHandle(): Promise<void> {
  const db = await abrirIdb()
  await new Promise<void>((res) => {
    const tx = db.transaction(ALMACEN, 'readwrite')
    tx.objectStore(ALMACEN).delete('carpeta')
    tx.oncomplete = () => res()
  })
  db.close()
}

// ---------- Carpeta y permisos ----------
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

// ---------- Archivos ----------
export async function subcarpeta(dir: Dir, nombre: string, crear = true): Promise<Dir> {
  return dir.getDirectoryHandle(nombre, { create: crear })
}

export async function existe(dir: Dir, nombre: string): Promise<boolean> {
  try {
    await dir.getFileHandle(nombre)
    return true
  } catch {
    return false
  }
}

export async function leerBytes(dir: Dir, nombre: string): Promise<{ datos: Uint8Array; modificado: number }> {
  const fh = await dir.getFileHandle(nombre)
  const f = await fh.getFile()
  return { datos: new Uint8Array(await f.arrayBuffer()), modificado: f.lastModified }
}

export async function modificadoDe(dir: Dir, nombre: string): Promise<number> {
  return (await (await dir.getFileHandle(nombre)).getFile()).lastModified
}

/** Escribe el archivo y devuelve su nueva fecha de modificación */
export async function escribirBytes(dir: Dir, nombre: string, datos: Uint8Array): Promise<number> {
  const fh = await dir.getFileHandle(nombre, { create: true })
  const w = await (fh as any).createWritable()
  await w.write(datos)
  await w.close()
  return (await fh.getFile()).lastModified
}

export async function borrarArchivo(dir: Dir, nombre: string): Promise<void> {
  await dir.removeEntry(nombre)
}

export interface InfoArchivo {
  nombre: string
  tamano: number
  modificado: number
}

export async function listarArchivos(dir: Dir): Promise<InfoArchivo[]> {
  const out: InfoArchivo[] = []
  for await (const [nombre, h] of (dir as any).entries() as AsyncIterable<[string, FileSystemHandle]>) {
    if (h.kind !== 'file') continue
    const f = await (h as FileSystemFileHandle).getFile()
    out.push({ nombre, tamano: f.size, modificado: f.lastModified })
  }
  return out
}
