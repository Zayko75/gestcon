// Cálculos de control: contrato menor, crédito de cada aplicación presupuestaria, pendientes y resúmenes.
import type { Estado, Patrocinio } from '../types'
import { importeSinIva } from './format'
import { MUNICIPIOS } from './municipios'
import { claveCif } from './textos'

// ---------- Configuración ----------
/** Límite del contrato menor de servicios, sin IVA (Ley 9/2017 de Contratos del Sector Público, art. 118) */
export const LIMITE_MENOR_DEFECTO = 15000
export const CLAVE_LIMITE = 'limite_contrato_menor'
export const claveCredito = (aplicacion: string) => `credito:${aplicacion}`

export function limiteMenor(config: Record<string, string>): number {
  const n = Number(config[CLAVE_LIMITE])
  return Number.isFinite(n) && n > 0 ? n : LIMITE_MENOR_DEFECTO
}

/** Crédito disponible de una aplicación, o null si no se ha indicado */
export function creditoDe(config: Record<string, string>, aplicacion: string): number | null {
  const v = config[claveCredito(aplicacion)]
  if (v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export const sinIva = (r: Pick<Patrocinio, 'importe_total' | 'iva_pct'>) => importeSinIva(r.importe_total, r.iva_pct)

// ---------- Contrato menor ----------
/** Otros patrocinios de la misma entidad (por CIF) en la misma anualidad */
export function delMismoAnio(registros: Patrocinio[], p: { id: number | null; cif: string; anualidad: number | null }): Patrocinio[] {
  const k = claveCif(p.cif)
  if (!k || p.anualidad === null) return []
  return registros.filter((r) => r.id !== p.id && r.anualidad === p.anualidad && claveCif(r.cif) === k)
}

// ---------- Crédito por aplicación ----------
/** Estados que ya comprometen el gasto en firme */
export const FIRMES: Estado[] = ['firmado', 'tramitado']

export interface UsoAplicacion {
  aplicacion: string
  anio: number | null
  patrocinios: number
  /** Importes IVA incluido */
  total: number
  firme: number
  enCurso: number
  credito: number | null
}

export function usoPorAplicacion(registros: Patrocinio[], config: Record<string, string>): UsoAplicacion[] {
  const m = new Map<string, UsoAplicacion>()
  for (const r of registros) {
    const a = r.aplicacion.trim()
    if (!a) continue
    const u = m.get(a) ?? { aplicacion: a, anio: /^\d{4}\//.test(a) ? Number(a.slice(0, 4)) : null, patrocinios: 0, total: 0, firme: 0, enCurso: 0, credito: creditoDe(config, a) }
    u.patrocinios++
    u.total += r.importe_total
    if (FIRMES.includes(r.estado)) u.firme += r.importe_total
    else u.enCurso += r.importe_total
    m.set(a, u)
  }
  // También las aplicaciones con crédito pero sin patrocinios todavía
  for (const k of Object.keys(config)) {
    if (!k.startsWith('credito:')) continue
    const a = k.slice('credito:'.length)
    if (!m.has(a)) m.set(a, { aplicacion: a, anio: /^\d{4}\//.test(a) ? Number(a.slice(0, 4)) : null, patrocinios: 0, total: 0, firme: 0, enCurso: 0, credito: creditoDe(config, a) })
  }
  const redondeo = (n: number) => Math.round(n * 100) / 100
  return [...m.values()]
    .map((u) => ({ ...u, total: redondeo(u.total), firme: redondeo(u.firme), enCurso: redondeo(u.enCurso) }))
    .sort((a, b) => (b.anio ?? 0) - (a.anio ?? 0) || b.total - a.total)
}

/** Uso de una aplicación contando un patrocinio con un importe distinto del guardado (el que se está editando) */
export function usoConCambio(registros: Patrocinio[], aplicacion: string, id: number | null, importe: number): number {
  const a = aplicacion.trim()
  return Math.round((registros.filter((r) => r.id !== id && r.aplicacion.trim() === a).reduce((s, r) => s + r.importe_total, 0) + importe) * 100) / 100
}

// ---------- Pendientes ----------
export const hoyISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export function sumarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split('-').map(Number)
  const f = new Date(Date.UTC(a, m - 1, d + dias))
  return f.toISOString().slice(0, 10)
}
export function diasEntre(desde: string, hasta: string): number {
  const t = (s: string) => { const [a, m, d] = s.split('-').map(Number); return Date.UTC(a, m - 1, d) }
  return Math.round((t(hasta) - t(desde)) / 86400000)
}

export interface Pendientes {
  /** En preparación o pendientes de firma con el evento a menos de 30 días (o ya pasado) */
  firmaUrgente: Patrocinio[]
  /** El resto de los que aún no están firmados */
  sinFirmar: Patrocinio[]
  /** Firmados (no tramitados) cuyo evento empieza en los próximos 30 días */
  proximos: Patrocinio[]
  /** Evento celebrado (o plazo de ejecución vencido) y sin tramitar: falta justificar */
  porJustificar: Patrocinio[]
}

export function pendientes(registros: Patrocinio[], hoy = hoyISO(), dias = 30): Pendientes {
  const limite = sumarDias(hoy, dias)
  const porFecha = (a: Patrocinio, b: Patrocinio) => (a.fecha_inicio ?? '9999').localeCompare(b.fecha_inicio ?? '9999')
  const out: Pendientes = { firmaUrgente: [], sinFirmar: [], proximos: [], porJustificar: [] }
  for (const r of registros) {
    if (r.estado === 'tramitado') continue
    const fin = r.fecha_fin ?? r.fecha_inicio
    const celebrado = (fin !== null && fin < hoy) || (r.plazo_ejecucion !== null && r.plazo_ejecucion < hoy)
    if (r.estado === 'preparacion' || r.estado === 'pendiente_firma') {
      if (r.fecha_inicio !== null && r.fecha_inicio <= limite) out.firmaUrgente.push(r)
      else out.sinFirmar.push(r)
    } else if (celebrado) out.porJustificar.push(r)
    else if (r.fecha_inicio !== null && r.fecha_inicio <= limite) out.proximos.push(r)
  }
  out.firmaUrgente.sort(porFecha)
  out.sinFirmar.sort(porFecha)
  out.proximos.sort(porFecha)
  out.porJustificar.sort(porFecha)
  return out
}

export const totalPendientes = (p: Pendientes) => p.firmaUrgente.length + p.porJustificar.length + p.proximos.length + p.sinFirmar.length

// ---------- Municipios ----------
const normal = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()
const OFICIALES = new Map(MUNICIPIOS.map((m) => [normal(m), m]))

/** Nombre para mostrar: «MÁLAGA» → «Málaga». Si no es un municipio de la lista, se usa el texto escrito (con sus tildes). */
export function nombreMunicipio(clave: string, escrito = clave): string {
  const base = OFICIALES.get(normal(clave)) ?? escrito.trim()
  const t = base.toLowerCase().replace(/(^|[\s(-])(\p{L})/gu, (_x, a: string, b: string) => a + b.toUpperCase())
    .replace(/(?!^)\b(De|Del|La|Las|Los|El|Y)\b/g, (x) => x.toLowerCase())
  return t.charAt(0).toUpperCase() + t.slice(1)
}

const trozos = (texto: string) => texto.split(/\s*[,;/]\s*|\s+y\s+/i).map((m) => m.replace(/\.$/, '').trim()).filter(Boolean)

/** Municipios de un patrocinio: «Rincón de la Victoria, Totalán y Málaga» → ['RINCON DE LA VICTORIA', 'TOTALAN', 'MALAGA'] (clave normalizada) */
export function municipiosDe(texto: string): string[] {
  return [...new Set(trozos(texto).map(normal))]
}

/** Igual, con el nombre para mostrar de cada uno */
export function municipiosConNombre(texto: string): { clave: string; nombre: string }[] {
  const vistos = new Set<string>()
  const out: { clave: string; nombre: string }[] = []
  for (const t of trozos(texto)) {
    const clave = normal(t)
    if (vistos.has(clave)) continue
    vistos.add(clave)
    out.push({ clave, nombre: nombreMunicipio(clave, t) })
  }
  return out
}
