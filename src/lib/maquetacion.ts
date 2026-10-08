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

/** Tamaño (pt) de la marca de párrafo de cada párrafo del cuerpo, en orden; null si no lo indica */
function tamanosDeParrafo(docx: Uint8Array): (number | null)[] | null {
  try {
    const xml = new PizZip(docx).file('word/document.xml')?.asText()
    if (!xml) return null
    const doc = new DOMParser().parseFromString(xml, 'application/xml')
    const body = doc.getElementsByTagNameNS(W, 'body')[0]
    if (!body) return null
    return Array.from(body.getElementsByTagNameNS(W, 'p'))
      .filter((p) => !p.closest?.('txbxContent'))
      .map((p) => {
        const pPr = Array.from(p.children).find((e) => e.localName === 'pPr')
        const rPr = pPr && Array.from(pPr.children).find((e) => e.localName === 'rPr')
        const sz = rPr && Array.from(rPr.children).find((e) => e.localName === 'sz')
        const v = Number(sz?.getAttributeNS(W, 'val'))
        return Number.isFinite(v) && v > 0 ? v / 2 : null
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

  // Altura de las líneas: en Word la marca de párrafo tiene su propio tamaño de letra (los párrafos vacíos
  // miden eso). docx-preview usa el tamaño por defecto del navegador (16 px), más alto, y el texto se alarga.
  const tamanos = docx ? tamanosDeParrafo(docx) : null
  const parrafos = Array.from(raiz.querySelectorAll<HTMLElement>('section.docx > article p'))
  if (tamanos && tamanos.length === parrafos.length) {
    parrafos.forEach((p, i) => { p.style.fontSize = `${tamanos[i] ?? 10}pt` })
  } else {
    parrafos.forEach((p) => { if (!p.style.fontSize) p.style.fontSize = '10pt' }) // tamaño por defecto de Word
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

// ---------- Paginación ----------
// docx-preview pinta cada sección de Word como una sola «página» que crece sin límite. Al imprimir,
// el navegador la corta donde cae, sin márgenes y sin repetir la cabecera. Aquí se reparte el contenido
// en páginas del tamaño real, con los márgenes de la plantilla y la cabecera (logotipo) en cada una.

const px = (v: string) => parseFloat(v) || 0

/** Crea una página vacía igual que `sec` (misma cabecera y pie) justo después de ella */
function nuevaPagina(sec: HTMLElement, art: HTMLElement): { sec: HTMLElement; art: HTMLElement } {
  const nueva = sec.cloneNode(false) as HTMLElement
  const nuevoArt = art.cloneNode(false) as HTMLElement
  for (const hijo of Array.from(sec.children)) {
    if (hijo === art) nueva.appendChild(nuevoArt)
    else if (hijo.tagName === 'HEADER' || hijo.tagName === 'FOOTER') nueva.appendChild(hijo.cloneNode(true))
  }
  if (!nuevoArt.parentElement) nueva.appendChild(nuevoArt)
  sec.after(nueva)
  return { sec: nueva, art: nuevoArt }
}

/** Filas de una tabla de docx-preview (las filas pueden estar directamente en <table> o en <tbody>) */
const filasDe = (t: HTMLTableElement) => Array.from(t.querySelectorAll<HTMLTableRowElement>(':scope > tr, :scope > tbody > tr'))

/** Parte una tabla: las filas que no caben pasan a una tabla nueva con las mismas columnas. Devuelve la tabla nueva o null. */
function partirTabla(t: HTMLTableElement, limite: number): HTMLTableElement | null {
  const filas = filasDe(t)
  const i = filas.findIndex((f) => f.getBoundingClientRect().bottom > limite + 1)
  if (i <= 0) return null
  const nueva = t.cloneNode(false) as HTMLTableElement
  const colgroup = t.querySelector(':scope > colgroup')
  if (colgroup) nueva.appendChild(colgroup.cloneNode(true))
  const destino = t.tBodies[0] ? nueva.appendChild(t.tBodies[0].cloneNode(false)) : nueva
  for (const f of filas.slice(i)) destino.appendChild(f)
  return nueva
}

/** Todos los caracteres de un párrafo, en orden: [nodo de texto, desplazamiento, carácter] */
function caracteres(p: HTMLElement): [Text, number, string][] {
  const out: [Text, number, string][] = []
  const w = document.createTreeWalker(p, NodeFilter.SHOW_TEXT)
  for (let n = w.nextNode() as Text | null; n; n = w.nextNode() as Text | null) {
    for (let k = 0; k < n.data.length; k++) out.push([n, k, n.data[k]])
  }
  return out
}

const esEspacio = (c: string) => /\s/.test(c)

/**
 * Parte un párrafo por líneas, como Word: lo que no cabe pasa a un párrafo nuevo.
 * Nunca corta una palabra: si la línea empieza con el final de una palabra partida con guion,
 * la palabra entera pasa a la página siguiente.
 * Deja al menos 2 líneas en cada página (control de líneas viudas y huérfanas). Devuelve el párrafo nuevo o null.
 */
function partirParrafo(p: HTMLElement, limite: number): HTMLElement | null {
  const chars = caracteres(p)
  const visibles = chars.map((c, i) => i).filter((i) => !esEspacio(chars[i][2]))
  if (visibles.length < 2) return null
  const r = document.createRange()
  const rect = (i: number) => { r.setStart(chars[i][0], chars[i][1]); r.setEnd(chars[i][0], chars[i][1] + 1); return r.getBoundingClientRect() }
  // Primer carácter visible que se sale de la página (búsqueda binaria: la posición vertical solo crece)
  let lo = 0, hi = visibles.length
  while (lo < hi) { const m = (lo + hi) >> 1; if (rect(visibles[m]).bottom > limite + 1) hi = m; else lo = m + 1 }
  if (lo === 0 || lo === visibles.length) return null
  // Comienzo de cada línea (en índices de `chars`)
  const lineas: number[] = [visibles[0]]
  for (let k = 1; k < visibles.length; k++) if (rect(visibles[k]).top > rect(visibles[k - 1]).top + 2) lineas.push(visibles[k])
  const primeroFuera = visibles[lo]
  let corte = lineas.filter((i) => i <= primeroFuera).pop() ?? 0
  const antes = lineas.filter((i) => i < corte).length
  const despues = lineas.filter((i) => i >= corte).length
  if (antes < 2) return null // menos de 2 líneas: el párrafo entero pasa a la página siguiente
  if (despues < 2 && antes >= 3) corte = lineas[lineas.indexOf(corte) - 1] // deja al menos 2 líneas en la siguiente
  // No cortar dentro de una palabra (división con guion al final de la línea anterior)
  const inicioLinea = corte
  while (corte > 0 && !esEspacio(chars[corte - 1][2]) && chars[corte - 1][2] !== '-') corte--
  const palabraMovida = corte !== inicioLinea
  if (corte === 0) return null
  r.setStart(chars[corte][0], chars[corte][1])
  r.setEnd(p, p.childNodes.length)
  const resto = p.cloneNode(false) as HTMLElement
  resto.appendChild(r.extractContents())
  resto.style.textIndent = '0' // la sangría de primera línea solo va al principio del párrafo
  resto.style.marginTop = '0'
  p.style.marginBottom = '0'
  // La última línea de la página sigue justificada, salvo que haya quedado corta al mover una palabra
  if (getComputedStyle(p).textAlign === 'justify' && !palabraMovida) p.style.textAlignLast = 'justify'
  return resto
}

export function paginar(raiz: HTMLElement): void {
  const pendientes = Array.from(raiz.querySelectorAll<HTMLElement>('section.docx'))
  let vueltas = 0
  while (pendientes.length && vueltas++ < 500) {
    const sec = pendientes.shift()!
    const art = sec.querySelector<HTMLElement>(':scope > article')
    if (!art) continue
    const estilo = getComputedStyle(sec)
    const alto = px(estilo.minHeight)
    if (!alto) continue
    const limite = sec.getBoundingClientRect().top + alto - px(estilo.paddingBottom)
    const bloques = Array.from(art.children) as HTMLElement[]
    const i = bloques.findIndex((b) => b.getBoundingClientRect().bottom > limite + 1)
    if (i < 0) continue

    let mover = bloques.slice(i)
    const primero = bloques[i]
    if (primero.tagName === 'TABLE') {
      const resto = partirTabla(primero as HTMLTableElement, limite)
      if (resto) mover = [resto, ...bloques.slice(i + 1)]
      else if (i === 0) continue // tabla que no cabe ni sola en una página: se deja
    } else if (primero.tagName === 'P') {
      const resto = partirParrafo(primero, limite)
      if (resto) mover = [resto, ...bloques.slice(i + 1)]
      else if (i === 0) continue
    } else if (i === 0) {
      continue // bloque más alto que una página: no se puede repartir
    }
    // Si lo que no cabe son solo párrafos vacíos del final, se quitan: no se crea una página en blanco
    const vacio = (b: HTMLElement) => !b.textContent?.trim() && !b.querySelector('img, svg, table, canvas')
    if (mover.every(vacio)) {
      mover.forEach((b) => b.remove())
      continue
    }
    const pagina = nuevaPagina(sec, art)
    for (const b of mover) pagina.art.appendChild(b)
    pendientes.unshift(pagina.sec)
  }
}
