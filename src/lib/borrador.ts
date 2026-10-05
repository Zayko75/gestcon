import type { DatosPatrocinio, Patrocinio } from '../types'
import { numeroES, parseImporte } from './format'

/** Estado del formulario: todo como texto, como lo escribe el usuario */
export interface Borrador {
  tramitado: boolean
  entidad: string; cif: string; representante_legal: string; dni_nie_representante: string; telefono: string; email: string
  anualidad: string; evento: string; fecha_celebracion: string; plazo_ejecucion: string; municipios: string
  soportes_cedidos: string; soportes_propios: string; soportes_enumerados: string
  num_contrato: string; importe_total: string; importe_letra: string; importe_letra_sin_iva: string
  aplicacion: string; importe_reding: string; fecha_firma: string
}

export function borradorVacio(): Borrador {
  return {
    tramitado: false, entidad: '', cif: '', representante_legal: '', dni_nie_representante: '', telefono: '', email: '',
    anualidad: String(new Date().getFullYear()), evento: '', fecha_celebracion: '', plazo_ejecucion: '', municipios: '',
    soportes_cedidos: '', soportes_propios: '', soportes_enumerados: '',
    num_contrato: '', importe_total: '', importe_letra: '', importe_letra_sin_iva: '', aplicacion: '', importe_reding: '', fecha_firma: '',
  }
}

export function aBorrador(p: Patrocinio): Borrador {
  return {
    tramitado: !!p.tramitado, entidad: p.entidad, cif: p.cif, representante_legal: p.representante_legal,
    dni_nie_representante: p.dni_nie_representante, telefono: p.telefono, email: p.email,
    anualidad: p.anualidad === null ? '' : String(p.anualidad), evento: p.evento, fecha_celebracion: p.fecha_celebracion,
    plazo_ejecucion: p.plazo_ejecucion ?? '', municipios: p.municipios,
    soportes_cedidos: p.soportes_cedidos, soportes_propios: p.soportes_propios, soportes_enumerados: p.soportes_enumerados,
    num_contrato: p.num_contrato === null ? '' : String(p.num_contrato), importe_total: numeroES(p.importe_total),
    importe_letra: p.importe_letra, importe_letra_sin_iva: p.importe_letra_sin_iva, aplicacion: p.aplicacion,
    importe_reding: numeroES(p.importe_reding), fecha_firma: p.fecha_firma ?? '',
  }
}

/** Convierte el formulario en datos para la base de datos, o devuelve el motivo por el que no vale */
export function deBorrador(b: Borrador): { datos: DatosPatrocinio } | { error: string } {
  if (!b.entidad.trim()) return { error: 'Escribe el nombre de la entidad.' }
  const total = parseImporte(b.importe_total)
  if (total === null) return { error: 'El importe total no es un número válido (ejemplo: 4.235,00).' }
  const reding = parseImporte(b.importe_reding)
  if (reding === null) return { error: 'El importe REDING no es un número válido (ejemplo: 13.775,25).' }
  const anio = b.anualidad.trim() === '' ? null : Number(b.anualidad)
  if (anio !== null && !Number.isInteger(anio)) return { error: 'La anualidad debe ser un año, por ejemplo 2026.' }
  const num = b.num_contrato.trim() === '' ? null : Number(b.num_contrato)
  if (num !== null && !Number.isInteger(num)) return { error: 'El nº de contrato debe ser un número entero.' }
  const t = (s: string) => s.replace(/\r\n/g, '\n').trim()
  return {
    datos: {
      tramitado: b.tramitado ? 1 : 0,
      entidad: t(b.entidad), cif: t(b.cif), representante_legal: t(b.representante_legal),
      dni_nie_representante: t(b.dni_nie_representante), telefono: t(b.telefono), email: t(b.email),
      anualidad: anio, evento: t(b.evento), fecha_celebracion: t(b.fecha_celebracion),
      plazo_ejecucion: b.plazo_ejecucion || null, municipios: t(b.municipios),
      soportes_cedidos: t(b.soportes_cedidos), soportes_propios: t(b.soportes_propios), soportes_enumerados: t(b.soportes_enumerados),
      num_contrato: num, importe_total: total, importe_letra: t(b.importe_letra), importe_letra_sin_iva: t(b.importe_letra_sin_iva),
      aplicacion: t(b.aplicacion), importe_reding: reding, fecha_firma: b.fecha_firma || null,
    },
  }
}
