// Textos que se derivan de los datos: importe en letra, fecha de celebración y soportes enumerados.

// ---------- Importe en letra ----------
const UNIDADES = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece',
  'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés',
  'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve']
const DECENAS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
const CENTENAS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos']

/** 0..999 en letra ("uno" al final; se apocopa después) */
function hasta999(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'cien'
  const c = Math.floor(n / 100)
  const r = n % 100
  let resto: string
  if (r < 30) resto = UNIDADES[r]
  else {
    const d = Math.floor(r / 10), u = r % 10
    resto = DECENAS[d] + (u ? ' y ' + UNIDADES[u] : '')
  }
  return [CENTENAS[c], resto].filter(Boolean).join(' ')
}

/** «uno» → «un» delante de un sustantivo (mil, millones, euros…) */
const apocope = (s: string) => s.replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un')

/** Número entero en letra, en la forma que precede a un sustantivo: 21 → «veintiún» */
export function enteroEnLetra(n: number): string {
  if (n === 0) return 'cero'
  const millones = Math.floor(n / 1_000_000)
  const miles = Math.floor((n % 1_000_000) / 1000)
  const resto = n % 1000
  const partes: string[] = []
  if (millones) partes.push(millones === 1 ? 'un millón' : `${apocope(hasta999(millones))} millones`)
  if (miles) partes.push(miles === 1 ? 'mil' : `${apocope(hasta999(miles))} mil`)
  if (resto) partes.push(apocope(hasta999(resto)))
  return partes.join(' ')
}

/** 4235.5 → «Cuatro mil doscientos treinta y cinco euros con cincuenta céntimos» */
export function importeEnLetra(importe: number): string {
  const centimosTotales = Math.round(importe * 100)
  const euros = Math.floor(centimosTotales / 100)
  const centimos = centimosTotales % 100
  const millonExacto = euros >= 1_000_000 && euros % 1_000_000 === 0
  let s = `${enteroEnLetra(euros)} ${millonExacto ? 'de ' : ''}${euros === 1 ? 'euro' : 'euros'}`
  if (centimos) s += ` con ${enteroEnLetra(centimos)} ${centimos === 1 ? 'céntimo' : 'céntimos'}`
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const normal = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim().replace(/\.$/, '')

/** ¿El texto en letra dice exactamente ese importe? (sin distinguir mayúsculas, tildes ni espacios) */
export function letraCoincide(texto: string, importe: number): boolean {
  return texto.trim() !== '' && normal(texto) === normal(importeEnLetra(importe))
}

/** Conserva el texto guardado si es correcto (para que los documentos no cambien) y si no, lo calcula */
export function letraCoherente(guardado: string, importe: number): string {
  return letraCoincide(guardado, importe) ? guardado : importeEnLetra(importe)
}

// ---------- Fechas del evento ----------
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const iso = (a: number, m: number, d: number) => `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const valida = (a: number, m: number, d: number) => {
  const f = new Date(Date.UTC(a, m - 1, d))
  return f.getUTCFullYear() === a && f.getUTCMonth() === m - 1 && f.getUTCDate() === d
}

/** Saca la primera y la última fecha de un texto como «del 11 de abril a 30 de noviembre de 2026» */
export function fechasDeTexto(texto: string, anioPorDefecto: number | null): { inicio: string; fin: string } | null {
  const t = normal(texto).replace(/setiembre/g, 'septiembre')
  const anios = [...t.matchAll(/\b(20\d\d)\b/g)].map((m) => Number(m[1]))
  const anio = anios.length ? anios[anios.length - 1] : anioPorDefecto
  if (!anio) return null
  const fechas: string[] = []
  let dias: number[] = []
  for (const m of t.matchAll(/\b(\d{1,2})\b|\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/g)) {
    if (m[1]) {
      const d = Number(m[1])
      if (d >= 1 && d <= 31) dias.push(d)
    } else if (m[2]) {
      const mes = MESES.indexOf(m[2]) + 1
      for (const d of dias) if (valida(anio, mes, d)) fechas.push(iso(anio, mes, d))
      dias = []
    }
  }
  if (!fechas.length) return null
  fechas.sort()
  return { inicio: fechas[0], fin: fechas[fechas.length - 1] }
}

/** Propone el texto de celebración a partir de las fechas: «del 2 al 4 de abril de 2026» */
export function textoDeFechas(inicio: string, fin: string): string {
  if (!inicio) return ''
  const [a1, m1, d1] = inicio.split('-').map(Number)
  const [a2, m2, d2] = (fin || inicio).split('-').map(Number)
  if (inicio === (fin || inicio)) return `el ${d1} de ${MESES[m1 - 1]} de ${a1}`
  if (a1 === a2 && m1 === m2) return `del ${d1} al ${d2} de ${MESES[m1 - 1]} de ${a1}`
  if (a1 === a2) return `del ${d1} de ${MESES[m1 - 1]} al ${d2} de ${MESES[m2 - 1]} de ${a1}`
  return `del ${d1} de ${MESES[m1 - 1]} de ${a1} al ${d2} de ${MESES[m2 - 1]} de ${a2}`
}

// ---------- Soportes ----------
/** Viñeta al principio de una línea: «- », «–\t», «• », «1. », «2) »… */
const VINETA = /^\s*(?:[-–•·*]|\d{1,2}[.)])\s*/

/** Un soporte de la lista: el texto original (tal cual se guarda e imprime) y el texto limpio para mostrar */
export interface Soporte { original: string; texto: string }

const limpioSoporte = (s: string) => s.replace(VINETA, '').replace(/\s+/g, ' ').trim().replace(/[.;,]+$/, '').trim()

/**
 * Separa una lista de soportes en elementos sin cambiar su texto: si las líneas llevan viñeta, una línea sin
 * viñeta continúa el soporte anterior (textos partidos en dos líneas); si no hay viñetas, cada línea es un soporte.
 * Un «.» suelto (lista vacía en los expedientes antiguos) no cuenta como soporte.
 */
export function soportesDeTexto(texto: string): Soporte[] {
  const lineas = texto.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim() !== '' && l.trim() !== '.')
  const conVineta = lineas.some((l) => VINETA.test(l))
  const out: string[] = []
  for (const l of lineas) {
    if (conVineta && !VINETA.test(l) && out.length) out[out.length - 1] += '\n' + l
    else out.push(l)
  }
  return out.map((original) => ({ original, texto: limpioSoporte(original) })).filter((x) => x.texto !== '')
}

/** Texto de la lista, tal como se guarda: los soportes que ya estaban conservan su texto exacto */
export const textoDeSoportes = (lista: Soporte[]) => lista.map((x) => x.original).join('\n')

/** Soporte nuevo con el formato habitual de los expedientes: «- Presencia en cartel del evento.» */
export function nuevoSoporte(texto: string): Soporte {
  const t = limpioSoporte(texto)
  return { original: `- ${t}${/[.!?)»"]$/.test(t) ? '' : '.'}`, texto: t }
}

/** Clave para comparar soportes sin distinguir mayúsculas, tildes, puntuación ni singular/plural («Pancarta» = «Pancartas») */
export const claveSoporte = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9ñ]+/g, ' ').trim()
  .split(' ').map((p) => (p.length > 3 ? p.replace(/s$/, '') : p)).join(' ')

/** Elementos de una lista escrita uno por línea («- Pancartas.» → «Pancartas») */
export const elementosLista = (texto: string): string[] => soportesDeTexto(texto).map((x) => x.texto)

/** Une cedidos y propios en una frase, separados por comas y tal como están escritos (como en los expedientes) */
export function soportesEnumerados(cedidos: string, propios: string): string {
  return [...elementosLista(cedidos), ...elementosLista(propios)].join(', ')
}

// ---------- Máscaras de entrada ----------
const LETRAS_DNI = 'TRWAGMYFPDXBNJZSQVHLCKE'

/**
 * DNI «12.345.678-Z» y NIE «X-1234567-L». Se aplica mientras se escribe; si el texto no empieza
 * por número ni por X, Y o Z (pasaporte, etc.) solo se pasa a mayúsculas.
 */
export function formatoDni(valor: string): string {
  const s = valor.toUpperCase().replace(/[^0-9A-Z]/g, '')
  if (/^[XYZ]/.test(s)) {
    const num = /^\d{0,7}/.exec(s.slice(1))![0]
    const letra = /^[A-Z]/.exec(s.slice(1 + num.length))?.[0] ?? ''
    return s[0] + (num ? '-' + num : '') + (letra ? '-' + letra : '')
  }
  if (/^\d/.test(s)) {
    const num = /^\d{0,8}/.exec(s)![0]
    const letra = /^[A-Z]/.exec(s.slice(num.length))?.[0] ?? ''
    // Completo (con letra): miles agrupados desde la derecha (5.380.138-V); mientras se escribe, 12.345.678
    const grupos = letra ? num.replace(/\B(?=(\d{3})+$)/g, '.') : num.slice(0, 2) + (num.length > 2 ? '.' + num.slice(2, 5) : '') + (num.length > 5 ? '.' + num.slice(5, 8) : '')
    return grupos + (letra ? '-' + letra : '')
  }
  return valor.toUpperCase().trim()
}

/** Letra que corresponde a un DNI/NIE completo, o null si el texto no es un DNI/NIE completo */
export function letraDni(valor: string): { correcta: string; escrita: string } | null {
  const s = valor.toUpperCase().replace(/[^0-9A-Z]/g, '')
  const m = /^([XYZ]\d{7}|\d{7,8})([A-Z])$/.exec(s)
  if (!m) return null
  const n = Number(m[1].replace(/^X/, '0').replace(/^Y/, '1').replace(/^Z/, '2'))
  return { correcta: LETRAS_DNI[n % 23], escrita: m[2] }
}

/** Aplicación presupuestaria «2026/1301/3411/22608»: solo cifras, las barras se ponen solas */
export function formatoAplicacion(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 17)
  return [d.slice(0, 4), d.slice(4, 8), d.slice(8, 12), d.slice(12, 17)].filter(Boolean).join('/')
}

/** Aplicación presupuestaria por defecto de una anualidad */
export const aplicacionPorDefecto = (anio: number | string) => `${anio}/1301/3411/22608`

// ---------- Limpieza ----------
/** Quita espacios al principio y al final y deja un solo espacio entre palabras (textos de una línea) */
export const unaLinea = (s: string) => s.replace(/\s+/g, ' ').trim()

/** Texto de varias líneas: sin espacios sobrantes al final de cada línea ni líneas vacías al principio o al final */
export const variasLineas = (s: string) => s.replace(/\r\n/g, '\n').split('\n').map((l) => l.replace(/[ \t]+$/, '')).join('\n').trim()

export function emailValido(s: string): boolean {
  if (!s.trim()) return true
  return s.split(/[;,]\s*|\s+/).filter(Boolean).every((e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e))
}

/** Clave para agrupar entidades por CIF sin modificar cómo está escrito (solo comparación) */
export const claveCif = (cif: string) => cif.toUpperCase().replace(/[^A-Z0-9]/g, '')
