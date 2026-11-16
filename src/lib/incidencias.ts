// Incidencias en la tramitación de un patrocinio: solo para el seguimiento interno, no salen en los documentos.
// Se guardan en la columna «incidencias» como JSON, ordenadas por fecha: [{ fecha, texto, subsanada }].

export interface Incidencia {
  /** Fecha de la incidencia (AAAA-MM-DD) */
  fecha: string
  texto: string
  /** Fecha en que se marcó como subsanada (AAAA-MM-DD), o vacío si sigue pendiente */
  subsanada: string
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/

export const hoyISO = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Lee las incidencias guardadas; lo que no se entiende se descarta sin romper la ficha */
export function incidenciasDeTexto(texto: string | null | undefined): Incidencia[] {
  if (!texto || !texto.trim()) return []
  try {
    const v: unknown = JSON.parse(texto)
    if (!Array.isArray(v)) return []
    return ordenar(v.flatMap((x) => {
      if (!x || typeof x !== 'object') return []
      const o = x as Record<string, unknown>
      const t = typeof o.texto === 'string' ? o.texto.trim() : ''
      if (!t) return []
      return [{
        fecha: typeof o.fecha === 'string' && FECHA.test(o.fecha) ? o.fecha : '',
        texto: t,
        subsanada: typeof o.subsanada === 'string' && FECHA.test(o.subsanada) ? o.subsanada : '',
      }]
    }))
  } catch {
    return []
  }
}

/** Por fecha, de la más antigua a la más reciente; las que no tienen fecha, al final. Mantiene el orden entre iguales. */
export function ordenar(lista: Incidencia[]): Incidencia[] {
  return lista.map((x, i) => ({ x, i }))
    .sort((a, b) => (a.x.fecha || '9999') .localeCompare(b.x.fecha || '9999') || a.i - b.i)
    .map(({ x }) => x)
}

/** Texto que se guarda (vacío si no hay ninguna) */
export function textoDeIncidencias(lista: Incidencia[]): string {
  const limpias = ordenar(lista.filter((x) => x.texto.trim())).map((x) => ({ fecha: x.fecha, texto: x.texto.trim(), subsanada: x.subsanada }))
  return limpias.length ? JSON.stringify(limpias) : ''
}

/** Cuántas incidencias siguen sin subsanar */
export const incidenciasPendientes = (texto: string | null | undefined): number =>
  incidenciasDeTexto(texto).filter((x) => !x.subsanada).length

/** «Sin incidencias», «1 pendiente de 3», «Todas subsanadas (2)» */
export function resumenIncidencias(texto: string | null | undefined): string {
  const lista = incidenciasDeTexto(texto)
  if (!lista.length) return 'Sin incidencias'
  const pendientes = lista.filter((x) => !x.subsanada).length
  if (!pendientes) return lista.length === 1 ? 'Subsanada' : `Todas subsanadas (${lista.length})`
  return `${pendientes} ${pendientes === 1 ? 'pendiente' : 'pendientes'} de ${lista.length}`
}
