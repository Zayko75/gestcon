import { borrarArchivo, escribirBytes, leerBytes, listarArchivos } from './fs'
import type { Copia } from "../types"
import type { Carpeta } from "./fs"

export const MAX_COPIAS = 30
const RE = /^datos_(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})(?:_(.+))?\.sqlite$/

const p2 = (n: number) => String(n).padStart(2, '0')

export function nombreCopia(fecha = new Date(), motivo = ''): string {
  const f = `${fecha.getFullYear()}-${p2(fecha.getMonth() + 1)}-${p2(fecha.getDate())}_${p2(fecha.getHours())}-${p2(fecha.getMinutes())}-${p2(fecha.getSeconds())}`
  return `datos_${f}${motivo ? '_' + motivo : ''}.sqlite`
}

export async function listarCopias(dir: Carpeta): Promise<Copia[]> {
  const out: Copia[] = []
  for (const a of await listarArchivos(dir)) {
    const m = RE.exec(a.nombre)
    if (!m) continue
    out.push({
      nombre: a.nombre,
      fecha: new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]),
      tamano: a.tamano,
      motivo: m[7] ?? '',
    })
  }
  return out.sort((a, b) => b.nombre.localeCompare(a.nombre))
}

/** Deja las últimas `max` copias automáticas (una por día) y las últimas `max` del resto (manuales, antes de eliminar…) */
export async function podar(dir: Carpeta, max = MAX_COPIAS): Promise<number> {
  const copias = await listarCopias(dir)
  const sobran = [
    ...copias.filter((c) => c.motivo === '').slice(max),
    ...copias.filter((c) => c.motivo !== '').slice(max),
  ]
  for (const c of sobran) await borrarArchivo(dir, c.nombre)
  return sobran.length
}

const mismoDia = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

/** Copia automática del día: solo si hoy todavía no hay ninguna. Devuelve el nombre o null. */
export async function copiaDiaria(dir: Carpeta, datos: Uint8Array): Promise<string | null> {
  const hoy = new Date()
  if ((await listarCopias(dir)).some((c) => c.motivo === '' && mismoDia(c.fecha, hoy))) return null
  return crearCopia(dir, datos)
}

export async function crearCopia(dir: Carpeta, datos: Uint8Array, motivo = ''): Promise<string> {
  let nombre = nombreCopia(new Date(), motivo)
  const existentes = new Set((await listarArchivos(dir)).map((a) => a.nombre))
  // Si ya hay una copia en el mismo segundo, esperar a que cambie el nombre
  let n = 0
  while (existentes.has(nombre) && n++ < 5) {
    await new Promise((r) => setTimeout(r, 1100))
    nombre = nombreCopia(new Date(), motivo)
  }
  await escribirBytes(dir, nombre, datos)
  await podar(dir)
  return nombre
}

export async function leerCopia(dir: Carpeta, nombre: string): Promise<Uint8Array> {
  return (await leerBytes(dir, nombre)).datos
}
