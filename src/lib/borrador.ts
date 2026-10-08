import type { DatosPatrocinio, Estado, Patrocinio } from '../types'
import { importeSinIva, numeroES, parseImporte } from './format'
import { emailValido, letraCoherente, soportesEnumerados, unaLinea, variasLineas } from './textos'

/** Estado del formulario: todo como texto, como lo escribe el usuario */
export interface Borrador {
  estado: Estado
  entidad: string; cif: string; representante_legal: string; dni_nie_representante: string; telefono: string; email: string
  anualidad: string; evento: string; fecha_celebracion: string; fecha_inicio: string; fecha_fin: string
  plazo_ejecucion: string; municipios: string
  soportes_cedidos: string; soportes_propios: string; soportes_enumerados: string
  num_contrato: string; importe_total: string; iva_pct: string
  /** Texto en letra guardado: no se edita, se recalcula si deja de coincidir con el importe */
  importe_letra: string; importe_letra_sin_iva: string
  aplicacion: string; importe_reding: string; fecha_firma: string
}

export function borradorVacio(ivaPct = 21): Borrador {
  return {
    estado: 'preparacion', entidad: '', cif: '', representante_legal: '', dni_nie_representante: '', telefono: '', email: '',
    anualidad: String(new Date().getFullYear()), evento: '', fecha_celebracion: '', fecha_inicio: '', fecha_fin: '',
    plazo_ejecucion: '', municipios: '', soportes_cedidos: '', soportes_propios: '', soportes_enumerados: '',
    num_contrato: '', importe_total: '', iva_pct: numeroES(ivaPct).replace(/,00$/, ''), importe_letra: '', importe_letra_sin_iva: '',
    aplicacion: '', importe_reding: '', fecha_firma: '',
  }
}

export function aBorrador(p: Patrocinio): Borrador {
  return {
    estado: p.estado, entidad: p.entidad, cif: p.cif, representante_legal: p.representante_legal,
    dni_nie_representante: p.dni_nie_representante, telefono: p.telefono, email: p.email,
    anualidad: p.anualidad === null ? '' : String(p.anualidad), evento: p.evento, fecha_celebracion: p.fecha_celebracion,
    fecha_inicio: p.fecha_inicio ?? '', fecha_fin: p.fecha_fin ?? '',
    plazo_ejecucion: p.plazo_ejecucion ?? '', municipios: p.municipios,
    soportes_cedidos: p.soportes_cedidos, soportes_propios: p.soportes_propios, soportes_enumerados: p.soportes_enumerados,
    num_contrato: p.num_contrato === null ? '' : String(p.num_contrato), importe_total: numeroES(p.importe_total),
    iva_pct: numeroES(p.iva_pct).replace(/,00$/, ''),
    importe_letra: p.importe_letra, importe_letra_sin_iva: p.importe_letra_sin_iva, aplicacion: p.aplicacion,
    importe_reding: numeroES(p.importe_reding), fecha_firma: p.fecha_firma ?? '',
  }
}

/** Importe en letra que corresponde al borrador (conserva el texto guardado si coincide) */
export function letrasDe(b: Borrador): { total: string; sinIva: string } {
  const total = parseImporte(b.importe_total)
  const iva = parseImporte(b.iva_pct)
  if (total === null || total <= 0 || iva === null) return { total: b.importe_letra, sinIva: b.importe_letra_sin_iva }
  return {
    total: letraCoherente(b.importe_letra, total),
    sinIva: letraCoherente(b.importe_letra_sin_iva, importeSinIva(total, iva)),
  }
}

/** Convierte el formulario en datos para la base de datos, o devuelve el motivo por el que no vale */
export function deBorrador(b: Borrador): { datos: DatosPatrocinio } | { error: string } {
  if (!b.entidad.trim()) return { error: 'Escribe el nombre de la entidad.' }
  const total = parseImporte(b.importe_total)
  if (total === null || total < 0) return { error: 'El importe total no es un número válido (ejemplo: 4.235,00).' }
  const iva = parseImporte(b.iva_pct)
  if (iva === null || iva < 0 || iva >= 100) return { error: 'El tipo de IVA debe ser un número entre 0 y 100 (ejemplo: 21).' }
  const reding = parseImporte(b.importe_reding)
  if (reding === null || reding < 0) return { error: 'El importe REDING no es un número válido (ejemplo: 13.775,25).' }
  const anio = b.anualidad.trim() === '' ? null : Number(b.anualidad)
  if (anio !== null && (!Number.isInteger(anio) || anio < 2000 || anio > 2100)) return { error: 'La anualidad debe ser un año, por ejemplo 2026.' }
  const num = b.num_contrato.trim() === '' ? null : Number(b.num_contrato)
  if (num !== null && (!Number.isInteger(num) || num <= 0)) return { error: 'El nº de contrato debe ser un número entero mayor que cero.' }
  if (b.fecha_inicio && b.fecha_fin && b.fecha_fin < b.fecha_inicio) return { error: 'La fecha de fin del evento es anterior a la de inicio.' }
  if (!emailValido(b.email)) return { error: 'El email no parece válido. Si hay varios, sepáralos con punto y coma.' }

  const letras = letrasDe(b)
  const cedidos = variasLineas(b.soportes_cedidos)
  const propios = variasLineas(b.soportes_propios)
  return {
    datos: {
      estado: b.estado,
      // El CIF se guarda tal como se escribe
      entidad: unaLinea(b.entidad), cif: b.cif.trim(), representante_legal: unaLinea(b.representante_legal),
      dni_nie_representante: unaLinea(b.dni_nie_representante), telefono: unaLinea(b.telefono), email: unaLinea(b.email),
      anualidad: anio, evento: unaLinea(b.evento), fecha_celebracion: variasLineas(b.fecha_celebracion),
      fecha_inicio: b.fecha_inicio || null, fecha_fin: b.fecha_fin || b.fecha_inicio || null,
      plazo_ejecucion: b.plazo_ejecucion || null, municipios: unaLinea(b.municipios),
      soportes_cedidos: cedidos, soportes_propios: propios,
      // Si está vacío se rellena con las dos listas
      soportes_enumerados: variasLineas(b.soportes_enumerados) || soportesEnumerados(cedidos, propios),
      num_contrato: num, importe_total: total, iva_pct: iva,
      importe_letra: letras.total, importe_letra_sin_iva: letras.sinIva,
      aplicacion: unaLinea(b.aplicacion), importe_reding: reding, fecha_firma: b.fecha_firma || null,
    },
  }
}
