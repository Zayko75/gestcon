/** Importe en formato moneda español con separador de miles siempre: 4.235,00 € */
export function eur(n: number): string {
  const [ent, dec] = Math.abs(n).toFixed(2).split('.')
  return (n < 0 ? '-' : '') + ent.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + dec + ' €'
}

/** Número para mostrar en un campo de edición: 4235,5 → "4.235,50" */
export function numeroES(n: number): string {
  if (!n) return ''
  const [ent, dec] = n.toFixed(2).split('.')
  return ent.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + dec
}

/** Acepta "4.235,50", "4235,5", "4235.50", "4 235,50 €"… Devuelve null si no es un número */
export function parseImporte(texto: string): number | null {
  let t = texto.replace(/[€\s]/g, '')
  if (t === '') return 0
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  else if ((t.match(/\./g) || []).length > 1) t = t.replace(/\./g, '')
  else if (/^\d{1,3}\.\d{3}$/.test(t)) t = t.replace('.', '') // 4.235 → 4235
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null
  return Math.round(parseFloat(t) * 100) / 100
}

export function fechaES(iso: string | null | undefined): string {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

export function importeSinIva(total: number, ivaPct: number): number {
  return Math.round((total / (1 + ivaPct / 100)) * 100) / 100
}

/** Tramos de campaña del Informe de Justificación (misma lógica que el VBA) */
export function campania(total: number): string {
  if (total > 400000) return 'Campaña A: > 400.000 € como ejemplo de campaña con índice muy alto de impactos.'
  if (total >= 100000) return 'Campaña B: Entre 100.000 y 400.000 € como ejemplo de campaña con índice alto de impactos.'
  if (total >= 25000) return 'Campaña C: Entre 25.000 y 100.000 € como ejemplo de campaña con índice medio de impactos.'
  if (total >= 6250) return 'Campaña D: Entre 6.250 y 25.000 € como ejemplo de campaña con índice medio-bajo de impactos.'
  if (total >= 1562) return 'Campaña E: Entre 1.562 y 6.250 € como ejemplo de campaña con índice bajo de impactos.'
  return 'Campaña F: Menos de 1.562 € como ejemplo de campaña con índice muy bajo de impactos.'
}

export function horaCorta(d: Date): string {
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

export function fechaHoraES(d: Date): string {
  return d.toLocaleDateString('es-ES') + ' ' + horaCorta(d)
}

export function tamanoLegible(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}
