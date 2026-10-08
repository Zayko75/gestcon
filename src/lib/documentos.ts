import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
import type { Patrocinio } from '../types'
import { campania, eur, fechaES, importeSinIva } from './format'

export interface DefDocumento {
  id: string
  etiqueta: string
  descripcion: string
  plantilla: string // nombre del .docx en /plantillas
  prefijo: string // para el nombre del documento generado
}

export const DOCUMENTOS: DefDocumento[] = [
  { id: 'anexo1', etiqueta: 'Anexo I', descripcion: 'Informe-propuesta del servicio gestor', plantilla: 'Anexo_I.docx', prefijo: 'Anexo_I' },
  { id: 'anexo2', etiqueta: 'Anexo II', descripcion: 'Orden de inicio del expediente', plantilla: 'Anexo_II.docx', prefijo: 'Anexo_II' },
  { id: 'anexo5', etiqueta: 'Anexo V', descripcion: 'Propuesta de adjudicación', plantilla: 'Anexo_V.docx', prefijo: 'Anexo_V' },
  { id: 'anexo6', etiqueta: 'Anexo VI', descripcion: 'Adjudicación de contrato menor', plantilla: 'Anexo_VI.docx', prefijo: 'Anexo_VI' },
  { id: 'contrato', etiqueta: 'Contrato', descripcion: 'Contrato de patrocinio', plantilla: 'Contrato.docx', prefijo: 'Contrato' },
  { id: 'competencial', etiqueta: 'Informe competencial', descripcion: 'Competencias y necesidad del patrocinio', plantilla: 'Informe_Competencial.docx', prefijo: 'Informe_Competencial' },
  { id: 'economico', etiqueta: 'Informe económico', descripcion: 'Valoración económica del patrocinio', plantilla: 'Informe_Economico.docx', prefijo: 'Informe_Economico' },
  { id: 'justificacion', etiqueta: 'Informe de justificación', descripcion: 'Justificación del impacto', plantilla: 'Informe_Justificacion_Impacto.docx', prefijo: 'Informe_Justificacion_Impacto' },
]

/** Nombre legible de cada etiqueta, para avisar de datos que faltan */
export const NOMBRE_CAMPO: Record<string, string> = {
  entidad: 'entidad', cif: 'CIF', evento: 'evento', importe_total: 'importe total', importe_sin_iva: 'importe sin IVA',
  iva: 'IVA', importe_letra: 'importe en letra', importe_letra_sin_iva: 'importe en letra sin IVA',
  aplicacion: 'aplicación presupuestaria', anualidad: 'anualidad', fecha_celebracion: 'fecha de celebración',
  municipios: 'municipios', soportes_cedidos: 'soportes cedidos', soportes_propios: 'soportes propios',
  soportes_enumerados: 'soportes enumerados', representante_legal: 'representante legal',
  dni_nie_representante: 'DNI/NIE del representante', telefono: 'teléfono', email: 'email',
  num_contrato: 'nº de contrato', plazo_ejecucion: 'plazo de ejecución', fecha_firma: 'fecha de firma',
  importe_reding: 'importe REDING', campania: 'campaña',
}

/** Valores que se insertan en las plantillas, ya formateados */
export function datosPlantilla(p: Patrocinio): Record<string, string> {
  const sinIva = importeSinIva(p.importe_total, p.iva_pct)
  const s = (v: unknown) => (v === null || v === undefined ? '' : String(v))
  return {
    entidad: s(p.entidad), cif: s(p.cif), evento: s(p.evento),
    representante_legal: s(p.representante_legal), dni_nie_representante: s(p.dni_nie_representante),
    telefono: s(p.telefono), email: s(p.email),
    anualidad: s(p.anualidad), fecha_celebracion: s(p.fecha_celebracion), municipios: s(p.municipios),
    plazo_ejecucion: fechaES(p.plazo_ejecucion), fecha_firma: fechaES(p.fecha_firma),
    soportes_cedidos: s(p.soportes_cedidos), soportes_propios: s(p.soportes_propios), soportes_enumerados: s(p.soportes_enumerados),
    num_contrato: s(p.num_contrato), aplicacion: s(p.aplicacion),
    importe_total: eur(p.importe_total), importe_sin_iva: eur(sinIva), iva: eur(Math.round((p.importe_total - sinIva) * 100) / 100),
    importe_reding: eur(p.importe_reding),
    importe_letra: s(p.importe_letra), importe_letra_sin_iva: s(p.importe_letra_sin_iva),
    campania: campania(p.importe_total),
  }
}

/** Etiquetas {campo} que contiene una plantilla */
export function etiquetasDePlantilla(bytes: Uint8Array): string[] {
  const xml = new PizZip(bytes).file('word/document.xml')?.asText() ?? ''
  const set = new Set<string>()
  for (const m of xml.matchAll(/\{([a-z_]+)\}/g)) set.add(m[1])
  return [...set]
}

export function camposFaltantes(etiquetas: string[], datos: Record<string, string>): string[] {
  return etiquetas.filter((t) => (datos[t] ?? '').trim() === '').map((t) => NOMBRE_CAMPO[t] ?? t)
}

/**
 * Margen superior mínimo: el logotipo de la cabecera a 1,25 cm del borde, como en los anexos y el contrato.
 * Algunas plantillas (informes) lo tienen a 0,25 cm y el documento queda pegado al borde de la hoja.
 */
const CABECERA_MIN = 708 // twips (1,25 cm)
function margenSuperior(xml: string): string {
  return xml.replace(/<w:pgMar\b[^>]*>/g, (pgMar) =>
    pgMar.replace(/w:header="(\d+)"/, (m, v: string) => (Number(v) < CABECERA_MIN ? `w:header="${CABECERA_MIN}"` : m)))
}

/**
 * Recuadros alineados: en los anexos, las tablas anchas (las que sobresalen del margen) tienen anchos algo
 * distintos (9.630 a 9.675 twips) y la de soportes está desplazada con una sangría en vez de centrada.
 * Se igualan todas al mismo ancho y centradas, repartiendo las columnas en proporción.
 */
const ANCHO_RECUADRO = 9660 // twips
function tablasDePrimerNivel(xml: string): [number, number][] {
  const out: [number, number][] = []
  const re = /<w:tbl>|<\/w:tbl>/g
  let nivel = 0, inicio = -1
  for (let m = re.exec(xml); m; m = re.exec(xml)) {
    if (m[0] === '<w:tbl>') { if (nivel++ === 0) inicio = m.index }
    else if (--nivel === 0) out.push([inicio, m.index + m[0].length])
  }
  return out
}
function alinearRecuadros(xml: string): string {
  let out = '', desde = 0
  for (const [a, b] of tablasDePrimerNivel(xml)) {
    let t = xml.slice(a, b)
    const cols = [...t.matchAll(/<w:gridCol w:w="(\d+)"\/>/g)].map((m) => Number(m[1]))
    const total = cols.reduce((x, y) => x + y, 0)
    if (!t.slice(7).includes('<w:tbl>') && total >= 9600 && total <= 9700 && total !== ANCHO_RECUADRO || (total === ANCHO_RECUADRO && /<w:tblInd /.test(t))) {
      const f = ANCHO_RECUADRO / total
      const esc = (v: string) => String(Math.round(Number(v) * f))
      t = t.replace(/<w:gridCol w:w="(\d+)"\/>/g, (_m, v) => `<w:gridCol w:w="${esc(v)}"/>`)
        .replace(/<w:tcW w:w="(\d+)" w:type="dxa"\/>/g, (_m, v) => `<w:tcW w:w="${esc(v)}" w:type="dxa"/>`)
        .replace(/<w:tblW w:w="\d+" w:type="dxa"\/>/, `<w:tblW w:w="${ANCHO_RECUADRO}" w:type="dxa"/>`)
        .replace(/<w:tblInd w:w="-?\d+" w:type="dxa"\/>/, '')
      // Centrada en la página, como las demás
      t = /<w:tblPr>[\s\S]*?<w:jc w:val="[^"]*"\/>[\s\S]*?<\/w:tblPr>/.test(t.slice(0, t.indexOf('</w:tblPr>') + 10))
        ? t.replace(/(<w:tblPr>[\s\S]*?)<w:jc w:val="[^"]*"\/>/, '$1<w:jc w:val="center"/>')
        : t.replace(/(<w:tblW [^>]*\/>)/, '$1<w:jc w:val="center"/>')
      // La última columna absorbe el redondeo para que el total sea exacto
      const nuevas = [...t.matchAll(/<w:gridCol w:w="(\d+)"\/>/g)].map((m) => Number(m[1]))
      const dif = ANCHO_RECUADRO - nuevas.reduce((x, y) => x + y, 0)
      if (dif) {
        const i = t.lastIndexOf('<w:gridCol w:w="')
        t = t.slice(0, i) + t.slice(i).replace(/w:w="(\d+)"/, (_m, v) => `w:w="${Number(v) + dif}"`)
      }
    }
    out += xml.slice(desde, a) + t
    desde = b
  }
  return out + xml.slice(desde)
}

/** Rellena la plantilla y devuelve el .docx */
export function generarDocx(plantilla: Uint8Array, datos: Record<string, string>): Uint8Array {
  const doc = new Docxtemplater(new PizZip(plantilla), { paragraphLoop: true, linebreaks: true, nullGetter: () => '' })
  doc.render(datos)
  const zip = doc.getZip()
  // Los tabuladores de los textos (lista de soportes) pasan a tabuladores reales de Word
  const xml = alinearRecuadros(margenSuperior(zip.file('word/document.xml')!.asText()))
  const arreglado = xml.replace(/<w:t(\s[^>]*)?>([^<]*\t[^<]*)<\/w:t>/g, (_m, attrs: string | undefined, texto: string) => {
    const partes = texto.split('\t')
    return partes.map((t) => `<w:t xml:space="preserve">${t}</w:t>`).join('<w:tab/>')
  })
  zip.file('word/document.xml', arreglado)
  return zip.generate({ type: 'uint8array', compression: 'DEFLATE' })
}

function limpiar(texto: string, max: number): string {
  return texto
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, max)
    .replace(/[._]+$/, '')
}

/**
 * 2026_151_Contrato_CD._COSTA_DEL_VOLEY.docx  (SC = sin nº de contrato).
 * Lleva la anualidad porque el nº de contrato se reinicia cada año.
 */
export function nombreDocumento(p: Patrocinio, def: DefDocumento): string {
  const num = p.num_contrato !== null ? String(p.num_contrato).padStart(3, '0') : 'SC' + p.id
  const anio = p.anualidad !== null ? `${p.anualidad}_` : ''
  return `${anio}${num}_${def.prefijo}_${limpiar(p.entidad, 60) || 'sin_entidad'}.docx`
}

/** Nombre que usaban las versiones anteriores (sin anualidad), para encontrar documentos ya generados */
export function nombreDocumentoAntiguo(p: Patrocinio, def: DefDocumento): string {
  const num = p.num_contrato !== null ? String(p.num_contrato).padStart(3, '0') : 'SC' + p.id
  return `${num}_${def.prefijo}_${limpiar(p.entidad, 60) || 'sin_entidad'}.docx`
}
