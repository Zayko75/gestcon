// Ajustes sobre el HTML de docx-preview para que la vista previa (y el PDF que se imprime
// desde ella) respete la maquetación de Word en las plantillas con tablas (anexos).
import PizZip from 'pizzip'

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

/** Sangría (w:tblInd, en pt) de cada tabla de primer nivel del documento, en orden; null si está centrada */
function sangriasDeTablas(docx: Uint8Array): (number | null)[] | null {
  try {
    const xml = new PizZip(docx).file('word/document.xml')?.asText()
    if (!xml) return null
    const doc = new DOMParser().parseFromString(xml, 'application/xml')
    const body = doc.getElementsByTagNameNS(W, 'body')[0]
    if (!body) return null
    return Array.from(body.children)
      .filter((e) => e.localName === 'tbl')
      .map((t) => {
        const pr = Array.from(t.children).find((e) => e.localName === 'tblPr')
        const hijo = (n: string) => (pr ? Array.from(pr.children).find((e) => e.localName === n) : undefined)
        if (hijo('jc')?.getAttributeNS(W, 'val') === 'center') return null
        const ind = Number(hijo('tblInd')?.getAttributeNS(W, 'w') ?? 0)
        return Number.isFinite(ind) ? ind / 20 : 0
      })
  } catch {
    return null
  }
}

/** Corrige la vista previa ya renderizada dentro de `raiz` (docx = el mismo documento) */
export function ajustarMaquetacion(raiz: HTMLElement, docx?: Uint8Array): void {
  // La alineación de fila de Word (w:trPr/w:jc) coloca la fila, no el texto:
  // docx-preview la traduce a text-align y centra párrafos que en Word van a la izquierda.
  raiz.querySelectorAll<HTMLTableRowElement>('section.docx tr').forEach((tr) => {
    tr.style.textAlign = ''
  })

  // Solo tablas de primer nivel (una tabla anidada se ajusta a su celda)
  const tablas = Array.from(raiz.querySelectorAll<HTMLTableElement>('section.docx table'))
    .filter((t) => t.parentElement?.tagName === 'ARTICLE')

  // Word centra sobre la página las tablas centradas más anchas que el área de texto;
  // en HTML, margin:auto no puede centrar algo más ancho que su contenedor y la tabla se desplaza a la derecha.
  for (const t of tablas) {
    if (t.style.marginLeft !== 'auto') continue
    const exceso = t.offsetWidth - t.parentElement!.clientWidth
    if (exceso > 0) {
      t.style.marginLeft = `${-exceso / 2}px`
      t.style.marginRight = `${-exceso / 2}px`
    }
  }

  // docx-preview no aplica la sangría de tabla (w:tblInd), que en las plantillas suele ser negativa
  const sangrias = docx ? sangriasDeTablas(docx) : null
  if (sangrias && sangrias.length === tablas.length) {
    tablas.forEach((t, i) => {
      const s = sangrias[i]
      if (s !== null && s !== 0 && t.style.marginLeft !== 'auto') t.style.marginLeft = `${s}pt`
    })
  }
}
