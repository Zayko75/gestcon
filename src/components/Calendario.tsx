import { useEffect, useMemo, useRef, useState, type KeyboardEvent as KE } from 'react'
import { diasEntre, hoyISO, municipiosConNombre } from '../lib/control'
import { eur } from '../lib/format'
import { useStore } from '../lib/store'
import type { Estado, Patrocinio } from '../types'
import { ESTADOS, EstadoChip } from './ui'

// ---------- Fechas ----------
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const DIAS_CORTOS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const deIso = (s: string) => { const [a, m, d] = s.split('-').map(Number); return new Date(a, m - 1, d) }
const sumar = (s: string, n: number) => { const d = deIso(s); d.setDate(d.getDate() + n); return iso(d) }
/** «jueves, 12 de noviembre» */
const fechaLarga = (s: string) => { const d = deIso(s); return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}` }
const mayus = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
/** «del 10 al 14 de noviembre», «12 de noviembre», «del 30 de noviembre al 2 de diciembre» */
function rango(a: string, b: string): string {
  const x = deIso(a), y = deIso(b)
  if (a === b) return `${x.getDate()} de ${MESES[x.getMonth()]}`
  if (x.getMonth() === y.getMonth() && x.getFullYear() === y.getFullYear()) return `del ${x.getDate()} al ${y.getDate()} de ${MESES[y.getMonth()]}`
  return `del ${x.getDate()} de ${MESES[x.getMonth()]} al ${y.getDate()} de ${MESES[y.getMonth()]}${x.getFullYear() !== y.getFullYear() ? ` de ${y.getFullYear()}` : ''}`
}

/** Colores de cada estado para las barras de los eventos */
const TONO: Record<Estado, { barra: string; fondo: string; texto: string }> = {
  preparacion: { barra: '#a85f00', fondo: '#fbefdf', texto: '#6f4000' },
  pendiente_firma: { barra: '#2c3487', fondo: '#e7e9f6', texto: '#1f2566' },
  firmado: { barra: '#0f6283', fondo: '#e0f0f6', texto: '#0b4a63' },
  tramitado: { barra: '#1e7a52', fondo: '#e0f1e8', texto: '#145a3b' },
}

interface Evento { r: Patrocinio; desde: string; hasta: string }

/** Los patrocinios con fecha de evento, como intervalos de días */
function eventosDe(registros: Patrocinio[]): { eventos: Evento[]; sinFecha: number } {
  const eventos: Evento[] = []
  let sinFecha = 0
  for (const r of registros) {
    if (!r.fecha_inicio) { sinFecha++; continue }
    let desde = r.fecha_inicio.slice(0, 10)
    let hasta = (r.fecha_fin || r.fecha_inicio).slice(0, 10)
    if (hasta < desde) [desde, hasta] = [hasta, desde]
    eventos.push({ r, desde, hasta })
  }
  eventos.sort((a, b) => a.desde.localeCompare(b.desde) || b.hasta.localeCompare(a.hasta) || a.r.entidad.localeCompare(b.r.entidad))
  return { eventos, sinFecha }
}

/** Reparte los eventos de una semana en carriles para que las barras no se pisen */
function carriles(semana: string, eventos: Evento[]) {
  const fin = sumar(semana, 6)
  const tramos: { ev: Evento; c0: number; c1: number; carril: number; sigueAntes: boolean; sigueDespues: boolean }[] = []
  const ocupado: number[] = [] // última columna ocupada en cada carril
  for (const ev of eventos) {
    if (ev.hasta < semana || ev.desde > fin) continue
    const c0 = Math.max(0, diasEntre(semana, ev.desde))
    const c1 = Math.min(6, diasEntre(semana, ev.hasta))
    let carril = ocupado.findIndex((u) => u < c0)
    if (carril < 0) { carril = ocupado.length; ocupado.push(c1) } else ocupado[carril] = c1
    tramos.push({ ev, c0, c1, carril, sigueAntes: ev.desde < semana, sigueDespues: ev.hasta > fin })
  }
  return tramos
}

const CLAVE_MES = 'gestcon-calendario-mes'

export function Calendario() {
  const { registros } = useStore()
  const hoy = hoyISO()
  const [mes, setMes] = useState<string>(() => {
    try { const g = sessionStorage.getItem(CLAVE_MES); if (g && /^\d{4}-\d{2}$/.test(g)) return g } catch { /* sin almacenamiento */ }
    return hoy.slice(0, 7)
  })
  useEffect(() => { try { sessionStorage.setItem(CLAVE_MES, mes) } catch { /* sin almacenamiento */ } }, [mes])
  const [ocultos, setOcultos] = useState<Estado[]>([])
  const [elegido, setElegido] = useState<string>(() => (hoy.startsWith(mes) ? hoy : `${mes}-01`))
  const [encima, setEncima] = useState<{ dia: string; caja: DOMRect } | null>(null)
  const [foco, setFoco] = useState<string | null>(null)
  const rejilla = useRef<HTMLDivElement>(null)

  const { eventos: todos, sinFecha } = useMemo(() => eventosDe(registros), [registros])
  const eventos = useMemo(() => todos.filter((e) => !ocultos.includes(e.r.estado)), [todos, ocultos])

  const [anio, m] = mes.split('-').map(Number)
  const primero = `${mes}-01`
  const ultimo = iso(new Date(anio, m, 0))
  // La rejilla empieza en el lunes de la semana del día 1 y acaba en el domingo de la del último día
  const inicio = sumar(primero, -((deIso(primero).getDay() + 6) % 7))
  const semanas: string[] = []
  for (let s = inicio; s <= ultimo; s = sumar(s, 7)) semanas.push(s)

  const delDia = (dia: string) => eventos.filter((e) => e.desde <= dia && e.hasta >= dia)
  const delMes = todos.filter((e) => e.hasta >= primero && e.desde <= ultimo)
  const visiblesMes = delMes.filter((e) => !ocultos.includes(e.r.estado))
  const cuenta = (estado: Estado) => delMes.filter((e) => e.r.estado === estado).length

  const irMes = (n: number) => {
    const d = new Date(anio, m - 1 + n, 1)
    const nuevo = iso(d).slice(0, 7)
    setMes(nuevo)
    setElegido(hoy.startsWith(nuevo) ? hoy : `${nuevo}-01`)
    setEncima(null)
  }
  const irHoy = () => { setMes(hoy.slice(0, 7)); setElegido(hoy); setEncima(null) }

  // Con el teclado: flechas para moverse entre días (cambiando de mes si hace falta)
  const mover = (e: KE<HTMLButtonElement>, dia: string) => {
    const pasos: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
    if (!(e.key in pasos)) return
    e.preventDefault()
    const destino = sumar(dia, pasos[e.key])
    if (destino.slice(0, 7) !== mes) setMes(destino.slice(0, 7))
    setElegido(destino)
    setFoco(destino)
  }
  useEffect(() => {
    if (!foco) return
    rejilla.current?.querySelector<HTMLButtonElement>(`[data-dia="${foco}"]`)?.focus()
    setFoco(null)
  }, [foco, mes])

  const mostrar = (dia: string, el: HTMLElement) => setEncima({ dia, caja: el.getBoundingClientRect() })

  return (
    <main className="mx-auto max-w-[88rem] px-4 pb-16 pt-7 sm:px-8 lg:pt-10">
      <h1 className="titulo">Calendario</h1>
      <p className="mt-2 max-w-2xl text-tinta/65">
        Los eventos patrocinados, del primer al último día. Pasa el ratón por un día para ver sus eventos, o púlsalo para dejarlos fijos al lado.
      </p>

      {/* Mes y navegación */}
      <div className="mt-7 flex flex-wrap items-end gap-x-6 gap-y-4">
        <h2 className="flex items-baseline gap-3 font-display leading-none" aria-live="polite">
          <span className="text-[2.6rem] font-bold capitalize text-tinta sm:text-[3.4rem]">{MESES[m - 1]}</span>
          <span className="text-[1.9rem] font-semibold text-tinta/35 sm:text-[2.4rem]">{anio}</span>
        </h2>
        <div className="flex items-center gap-1.5 pb-1.5">
          <button className="btn-sec px-2.5" onClick={() => irMes(-1)} aria-label="Mes anterior">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <button className="btn-sec px-2.5" onClick={() => irMes(1)} aria-label="Mes siguiente">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
          </button>
          <button className="btn-sec" onClick={irHoy} disabled={mes === hoy.slice(0, 7) && elegido === hoy}>Hoy</button>
        </div>
        <p className="pb-2.5 text-[0.92rem] text-tinta/65 sm:ml-auto">
          {visiblesMes.length === 0 ? 'Ningún evento este mes' : `${visiblesMes.length} ${visiblesMes.length === 1 ? 'evento' : 'eventos'} este mes, ${eur(visiblesMes.reduce((t, e) => t + (e.r.importe_total || 0), 0))}`}
        </p>
      </div>

      {/* Leyenda que también filtra */}
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Mostrar eventos por estado">
        {ESTADOS.map(({ valor, texto }) => {
          const activo = !ocultos.includes(valor)
          const t = TONO[valor]
          return (
            <button key={valor} type="button" aria-pressed={activo}
              onClick={() => setOcultos((o) => (activo ? [...o, valor] : o.filter((x) => x !== valor)))}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[0.86rem] font-semibold transition-colors ${activo ? 'border-transparent' : 'border-linea bg-white text-tinta/45 line-through decoration-tinta/30'}`}
              style={activo ? { background: t.fondo, color: t.texto } : undefined}>
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-[3px]" style={{ background: activo ? t.barra : '#c5cad8' }} />
              {texto}
              <span className="font-medium opacity-70">{cuenta(valor)}</span>
            </button>
          )
        })}
      </div>

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Rejilla del mes */}
        <div ref={rejilla} className="overflow-hidden rounded-xl border border-linea bg-white" onMouseLeave={() => setEncima(null)}>
          <div className="grid grid-cols-7 border-b border-linea bg-papel/70 text-center text-[0.8rem] font-semibold text-tinta/55" aria-hidden="true">
            {DIAS_CORTOS.map((d, i) => <div key={d} className={`py-2 ${i > 4 ? 'text-tinta/40' : ''}`}>{d}</div>)}
          </div>
          {semanas.map((semana) => {
            const tramos = carriles(semana, eventos)
            const MAX = 3
            return (
              <div key={semana} className="relative grid grid-cols-7 border-b border-linea last:border-b-0 [--paso:1.32rem] [--top:2.25rem] sm:[--paso:1.5rem] sm:[--top:2.45rem]">
                {Array.from({ length: 7 }, (_, i) => {
                  const dia = sumar(semana, i)
                  const fuera = dia.slice(0, 7) !== mes
                  const lista = delDia(dia)
                  const ocultosDia = tramos.filter((t) => t.carril >= MAX && t.c0 <= i && t.c1 >= i).length
                  const esHoy = dia === hoy
                  const sel = dia === elegido
                  return (
                    <button key={dia} type="button" data-dia={dia}
                      tabIndex={sel && !fuera ? 0 : -1}
                      aria-pressed={sel}
                      aria-label={`${fechaLarga(dia)}: ${lista.length === 0 ? 'sin eventos' : lista.length === 1 ? '1 evento' : `${lista.length} eventos`}`}
                      onClick={() => { setElegido(dia); if (fuera) setMes(dia.slice(0, 7)) }}
                      onPointerEnter={(e) => { if (e.pointerType === 'mouse') { if (lista.length) mostrar(dia, e.currentTarget); else setEncima(null) } }}
                      onFocus={(e) => { if (lista.length && e.currentTarget.matches(':focus-visible')) mostrar(dia, e.currentTarget) }}
                      onBlur={() => setEncima(null)}
                      onKeyDown={(e) => mover(e, dia)}
                      className={`relative flex h-[6.9rem] flex-col items-start border-r border-linea p-1.5 text-left outline-none transition-colors last:border-r-0 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo sm:h-[8.3rem] sm:p-2
                        ${i > 4 ? 'bg-papel/45' : ''} ${sel ? '!bg-indigo-claro/70' : 'hover:bg-indigo-claro/35'}`}>
                      <span className={`flex h-7 min-w-7 items-center justify-center rounded-full px-1 font-display text-[1.05rem] font-semibold leading-none
                        ${esHoy ? 'bg-noche text-white' : fuera ? 'text-tinta/30' : 'text-tinta/80'}`}>
                        {deIso(dia).getDate()}
                      </span>
                      {ocultosDia > 0 && (
                        <span className="absolute bottom-1 left-1.5 text-[0.72rem] font-semibold leading-none text-tinta/60 sm:bottom-1.5 sm:left-2">+{ocultosDia} más</span>
                      )}
                    </button>
                  )
                })}
                {/* Barras de los eventos (no capturan el ratón: el día de debajo responde) */}
                {tramos.filter((t) => t.carril < MAX).map((t) => {
                  const tono = TONO[t.ev.r.estado]
                  const fueraMes = t.ev.hasta < primero || t.ev.desde > ultimo
                  return (
                    <span key={t.ev.r.id + '-' + semana} aria-hidden="true"
                      className={`pointer-events-none absolute flex h-[1.15rem] items-center overflow-hidden whitespace-nowrap px-1.5 text-[0.72rem] font-semibold leading-none sm:h-[1.3rem] sm:text-[0.76rem]
                        ${t.sigueAntes ? '' : 'rounded-l-[5px]'} ${t.sigueDespues ? '' : 'rounded-r-[5px]'} ${fueraMes ? 'opacity-45' : ''}`}
                      style={{
                        top: `calc(var(--top) + ${t.carril} * var(--paso))`,
                        left: `calc(${(t.c0 * 100) / 7}% + ${t.sigueAntes ? 0 : 4}px)`,
                        width: `calc(${((t.c1 - t.c0 + 1) * 100) / 7}% - ${(t.sigueAntes ? 0 : 4) + (t.sigueDespues ? 0 : 4)}px)`,
                        background: tono.fondo, color: tono.texto,
                        boxShadow: t.sigueAntes ? undefined : `inset 3px 0 0 ${tono.barra}`,
                      }}>
                      <span className="truncate max-sm:hidden">{t.ev.r.entidad || t.ev.r.evento || 'Sin entidad'}</span>
                    </span>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* Día elegido */}
        <PanelDia dia={elegido} lista={delDia(elegido)} />
      </div>

      {sinFecha > 0 && (
        <p className="mt-4 text-[0.88rem] text-tinta/55">
          {sinFecha === 1 ? '1 patrocinio no tiene' : `${sinFecha} patrocinios no tienen`} fecha de evento y no {sinFecha === 1 ? 'aparece' : 'aparecen'} en el calendario.
        </p>
      )}

      {encima && delDia(encima.dia).length > 0 && <Tarjeta dia={encima.dia} caja={encima.caja} lista={delDia(encima.dia)} />}
    </main>
  )
}

/** Datos de un evento, en el panel y en la tarjeta */
function LineaEvento({ e, enlace }: { e: Evento; enlace: boolean }) {
  const tono = TONO[e.r.estado]
  const municipios = municipiosConNombre(e.r.municipios).map((x) => x.nombre).join(', ')
  const cuerpo = (
    <>
      <span aria-hidden="true" className="mt-1 h-[2.6rem] w-1 shrink-0 rounded-full" style={{ background: tono.barra }} />
      <span className="min-w-0 flex-1">
        <span className={`block font-semibold leading-snug text-tinta ${enlace ? 'group-hover:text-indigo' : ''}`}>{e.r.entidad || '(sin entidad)'}</span>
        <span className="mt-0.5 block text-[0.86rem] leading-snug text-tinta/70">{e.r.evento || 'Evento sin nombre'}</span>
        <span className="mt-1 block text-[0.82rem] text-tinta/55">
          {rango(e.desde, e.hasta).replace(/^./, (c) => c.toUpperCase())}{municipios ? `, en ${municipios}` : ''}
        </span>
        <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <EstadoChip estado={e.r.estado} />
          <span className="font-display text-[1rem] font-semibold text-tinta/80">{eur(e.r.importe_total || 0)}</span>
        </span>
      </span>
    </>
  )
  return enlace
    ? <a href={`#/registro/${e.r.id}`} className="group flex gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-indigo-claro/45">{cuerpo}</a>
    : <div className="flex gap-3 px-1 py-2">{cuerpo}</div>
}

function PanelDia({ dia, lista }: { dia: string; lista: Evento[] }) {
  return (
    <aside className="rounded-xl border border-linea bg-white xl:sticky xl:top-6" aria-live="polite" aria-label="Eventos del día elegido">
      <div className="border-b border-linea px-4 py-3.5">
        <h2 className="font-display text-[1.5rem] font-semibold leading-tight">{mayus(fechaLarga(dia))}</h2>
        <p className="mt-0.5 text-[0.86rem] text-tinta/55">{lista.length === 0 ? 'Sin eventos' : lista.length === 1 ? '1 evento' : `${lista.length} eventos`}</p>
      </div>
      {lista.length === 0
        ? <p className="px-4 py-6 text-[0.92rem] text-tinta/55">Ningún evento patrocinado este día. Elige otro día en el calendario.</p>
        : <ul className="max-h-[34rem] divide-y divide-linea/70 overflow-y-auto p-1.5">{lista.map((e) => <li key={e.r.id}><LineaEvento e={e} enlace /></li>)}</ul>}
    </aside>
  )
}

/** Tarjeta flotante al pasar el ratón (o el foco) por un día */
function Tarjeta({ dia, caja, lista }: { dia: string; caja: DOMRect; lista: Evento[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const an = el.offsetWidth, al = el.offsetHeight, m = 8
    // Debajo del día si cabe; si no, encima. Pegada al día y dentro de la ventana.
    let top = caja.bottom + 6
    if (top + al > window.innerHeight - m) top = Math.max(m, caja.top - al - 6)
    let left = caja.left + caja.width / 2 - an / 2
    left = Math.min(Math.max(m, left), window.innerWidth - an - m)
    setPos({ top, left })
  }, [caja, dia, lista.length])
  const vistos = lista.slice(0, 4)
  return (
    <div ref={ref} role="tooltip"
      className="pointer-events-none fixed z-40 w-[20rem] max-w-[calc(100vw-1rem)] rounded-xl border border-linea bg-white p-3 shadow-[0_18px_44px_-18px_rgba(22,27,69,.45)]"
      style={pos ? { top: pos.top, left: pos.left } : { top: -9999, left: -9999 }}>
      <p className="px-1 font-display text-[1.15rem] font-semibold leading-tight">{mayus(fechaLarga(dia))}</p>
      <div className="mt-1 divide-y divide-linea/70">{vistos.map((e) => <LineaEvento key={e.r.id} e={e} enlace={false} />)}</div>
      {lista.length > vistos.length && <p className="px-1 pt-2 text-[0.82rem] font-medium text-tinta/60">y {lista.length - vistos.length} más: pulsa el día para verlos todos</p>}
    </div>
  )
}
