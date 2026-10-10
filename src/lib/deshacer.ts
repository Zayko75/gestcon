// Deshacer y rehacer cambios en la ficha de un patrocinio.
// Cada guardado de la ficha es un «paso»: los campos que cambiaron, con su valor anterior y el nuevo.
// Los pasos se recuerdan mientras la pestaña está abierta (también al ir y volver entre fichas).
// Deshacer guarda los valores anteriores como un cambio más, así se combina bien con los cambios de otros usuarios.
import type { DatosPatrocinio, Estado } from '../types'
import { eur, fechaES } from './format'

export interface Paso {
  antes: Partial<DatosPatrocinio>
  despues: Partial<DatosPatrocinio>
  fecha: number
}

interface Pila { deshacer: Paso[]; rehacer: Paso[] }

const MAX_PASOS = 50
const pilas = new Map<number, Pila>()

function pila(id: number): Pila {
  let p = pilas.get(id)
  if (!p) { p = { deshacer: [], rehacer: [] }; pilas.set(id, p) }
  return p
}

export const pasosDeshacer = (id: number): readonly Paso[] => pila(id).deshacer
export const pasosRehacer = (id: number): readonly Paso[] => pila(id).rehacer

/** Anota un cambio nuevo (y olvida lo que se podía rehacer) */
export function anotar(id: number, paso: Paso) {
  const p = pila(id)
  if (!Object.keys(paso.despues).length) return
  p.deshacer.push(paso)
  if (p.deshacer.length > MAX_PASOS) p.deshacer.shift()
  p.rehacer = []
}

/** Saca el último paso para deshacerlo / rehacerlo, y lo pasa a la otra pila */
export function sacar(id: number, cual: 'deshacer' | 'rehacer'): Paso | undefined {
  const p = pila(id)
  const paso = p[cual].pop()
  if (paso) p[cual === 'deshacer' ? 'rehacer' : 'deshacer'].push(paso)
  return paso
}

/** Devuelve un paso a su pila si al final no se pudo aplicar */
export function devolver(id: number, cual: 'deshacer' | 'rehacer', paso: Paso) {
  const p = pila(id)
  const otra = p[cual === 'deshacer' ? 'rehacer' : 'deshacer']
  const i = otra.lastIndexOf(paso)
  if (i >= 0) otra.splice(i, 1)
  p[cual].push(paso)
}

/** Para las pruebas y al cambiar de carpeta o de usuario */
export const olvidarTodo = () => pilas.clear()

// ---------- Textos ----------
export const NOMBRE_CAMPO: Record<keyof DatosPatrocinio, string> = {
  estado: 'Estado', entidad: 'Entidad', cif: 'CIF', representante_legal: 'Representante legal',
  dni_nie_representante: 'DNI/NIE', telefono: 'Teléfono', email: 'Email', anualidad: 'Anualidad',
  evento: 'Evento', fecha_celebracion: 'Fecha de celebración', fecha_inicio: 'Primer día', fecha_fin: 'Último día',
  plazo_ejecucion: 'Plazo de ejecución', municipios: 'Municipios', soportes_cedidos: 'Soportes cedidos',
  soportes_propios: 'Soportes propios', soportes_enumerados: 'Soportes enumerados', num_contrato: 'Nº de contrato',
  importe_total: 'Importe total', iva_pct: 'Tipo de IVA', importe_letra: 'Importe en letra',
  importe_letra_sin_iva: 'Importe en letra sin IVA', aplicacion: 'Aplicación presupuestaria',
  importe_reding: 'Importe REDING', fecha_firma: 'Fecha de firma',
}

const TEXTO_ESTADO: Record<Estado, string> = { preparacion: 'En preparación', pendiente_firma: 'Pendiente de firma', firmado: 'Firmado', tramitado: 'Tramitado' }

/** Campos que se calculan de otros: no se nombran si ya se nombra aquel del que salen */
const DERIVADOS: Partial<Record<keyof DatosPatrocinio, (keyof DatosPatrocinio)[]>> = {
  importe_letra: ['importe_total'], importe_letra_sin_iva: ['importe_total', 'iva_pct'],
  soportes_enumerados: ['soportes_cedidos', 'soportes_propios'], fecha_celebracion: ['fecha_inicio', 'fecha_fin'],
}

/** Campos de un paso que merece la pena nombrar */
export function camposVisibles(paso: Paso): (keyof DatosPatrocinio)[] {
  const campos = Object.keys(paso.despues) as (keyof DatosPatrocinio)[]
  const visibles = campos.filter((c) => !DERIVADOS[c]?.some((o) => campos.includes(o)))
  return visibles.length ? visibles : campos
}

/** Valor de un campo, tal como lo lee una persona */
export function valorLegible(campo: keyof DatosPatrocinio, v: unknown): string {
  if (v === null || v === undefined || v === '') return '(vacío)'
  if (campo === 'estado') return TEXTO_ESTADO[v as Estado] ?? String(v)
  if (campo === 'importe_total' || campo === 'importe_reding') return eur(Number(v))
  if (campo === 'iva_pct') return `${String(v).replace('.', ',')} %`
  if (/^fecha_(inicio|fin|firma)$|^plazo_ejecucion$/.test(campo)) return fechaES(String(v))
  const s = String(v).replace(/\s*\n\s*/g, ' · ').trim()
  return s.length > 60 ? s.slice(0, 57).trimEnd() + '…' : s
}

/** «Importe total» o «Importe total y Evento» o «Importe total y 2 campos más» */
export function resumenPaso(paso: Paso): string {
  const c = camposVisibles(paso).map((x) => NOMBRE_CAMPO[x])
  if (c.length === 1) return c[0]
  if (c.length === 2) return `${c[0]} y ${c[1]}`
  return `${c[0]} y ${c.length - 1} campos más`
}
