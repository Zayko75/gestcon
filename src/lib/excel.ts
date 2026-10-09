// Libro de Excel (.xlsx) mínimo, escrito a mano con PizZip: una hoja con cabecera fija, filtros y fila de totales.
import PizZip from 'pizzip'

export type TipoColumna = 'texto' | 'entero' | 'euro' | 'porcentaje' | 'fecha'
export interface Columna<T> { titulo: string; ancho: number; tipo: TipoColumna; valor: (fila: T) => string | number | null; total?: boolean }

const esc = (s: string) => s
  // eslint-disable-next-line no-control-regex
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** A, B, …, Z, AA… */
const letra = (i: number): string => (i < 26 ? String.fromCharCode(65 + i) : letra(Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26)))

/** Fecha AAAA-MM-DD → número de serie de Excel */
function serie(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return null
  return Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(1899, 11, 30)) / 86400000)
}

// Estilos (índices de cellXfs)
const E = { normal: 0, cabecera: 1, euro: 2, fecha: 3, porcentaje: 4, totalTexto: 5, totalEuro: 6, entero: 7 }

const ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3"><numFmt numFmtId="164" formatCode="#,##0.00\\ &quot;€&quot;"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/><numFmt numFmtId="166" formatCode="General&quot; %&quot;"/></numFmts>
<fonts count="3"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF2C3487"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE7E9F6"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top style="thin"><color rgb="FF2C3487"/></top><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="8">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="left" vertical="top"/></xf>
<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="164" fontId="2" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="left" vertical="top"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`

function celda(ref: string, v: string | number | null, tipo: TipoColumna): string {
  if (v === null || v === '') return ''
  if (tipo === 'fecha' && typeof v === 'string') {
    const n = serie(v)
    if (n !== null) return `<c r="${ref}" s="${E.fecha}"><v>${n}</v></c>`
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    const s = tipo === 'euro' ? E.euro : tipo === 'porcentaje' ? E.porcentaje : tipo === 'entero' ? E.entero : E.normal
    return `<c r="${ref}" s="${s}"><v>${v}</v></c>`
  }
  return `<c r="${ref}" t="inlineStr" s="${E.normal}"><is><t xml:space="preserve">${esc(String(v))}</t></is></c>`
}

/** Crea el .xlsx con una hoja. Si alguna columna lleva total, añade una fila de totales con fórmulas SUMA. */
export function libroExcel<T>(hoja: string, columnas: Columna<T>[], filas: T[]): Uint8Array {
  const ultimaCol = letra(columnas.length - 1)
  const rows: string[] = []
  rows.push(`<row r="1" ht="30" customHeight="1">${columnas.map((c, i) => `<c r="${letra(i)}1" t="inlineStr" s="${E.cabecera}"><is><t>${esc(c.titulo)}</t></is></c>`).join('')}</row>`)
  filas.forEach((f, k) => {
    const n = k + 2
    rows.push(`<row r="${n}">${columnas.map((c, i) => celda(`${letra(i)}${n}`, c.valor(f), c.tipo)).join('')}</row>`)
  })
  const hayTotales = filas.length > 0 && columnas.some((c) => c.total)
  if (hayTotales) {
    const n = filas.length + 2
    rows.push(`<row r="${n}">${columnas.map((c, i) => {
      const ref = `${letra(i)}${n}`
      if (i === 0) return `<c r="${ref}" t="inlineStr" s="${E.totalTexto}"><is><t>Total (${filas.length})</t></is></c>`
      if (!c.total) return `<c r="${ref}" s="${E.totalTexto}"/>`
      const suma = Math.round(filas.reduce((s, f) => s + (Number(c.valor(f)) || 0), 0) * 100) / 100
      return `<c r="${ref}" s="${E.totalEuro}"><f>SUM(${letra(i)}2:${letra(i)}${n - 1})</f><v>${suma}</v></c>`
    }).join('')}</row>`)
  }
  const fin = Math.max(filas.length + 1, 2)
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetPr filterMode="0"/><dimension ref="A1:${ultimaCol}${fin + (hayTotales ? 1 : 0)}"/>
<sheetViews><sheetView workbookViewId="0" tabSelected="1"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${columnas.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.ancho}" customWidth="1"/>`).join('')}</cols>
<sheetData>${rows.join('')}</sheetData>
<autoFilter ref="A1:${ultimaCol}${fin}"/>
<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>
<pageSetup paperSize="9" orientation="landscape" fitToHeight="0"/>
</worksheet>`
  const nombreHoja = esc(hoja.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31))
  const zip = new PizZip()
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`)
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`)
  zip.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${nombreHoja}" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${nombreHoja.replace(/'/g, "''")}'!$A$1:$${ultimaCol}$${fin}</definedName></definedNames></workbook>`)
  zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`)
  zip.file('xl/worksheets/sheet1.xml', sheet)
  zip.file('xl/styles.xml', ESTILOS)
  return zip.generate({ type: 'uint8array', compression: 'DEFLATE' })
}

/** Descarga un archivo desde el navegador */
export function descargar(nombre: string, datos: Uint8Array, tipo: string) {
  const url = URL.createObjectURL(new Blob([datos as BlobPart], { type: tipo }))
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
