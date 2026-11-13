import { useMemo, useState } from 'react'
import { diasEntre, enCurso, finEvento, hoyISO, municipiosConNombre, terminadosSinPagar } from '../lib/control'
import { eur } from '../lib/format'
import { useStore } from '../lib/store'
import type { Estado, Patrocinio } from '../types'
import { Fecha } from './Pendientes'
import { Dorsal, ESTADOS, EstadoChip, TONO_ESTADO, textoEstado } from './ui'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const deIso = (s: string) => { const [a, m, d] = s.split('-').map(Number); return new Date(a, m - 1, d) }
/** «el domingo 22 de noviembre» */
const elDia = (s: string) => { const d = deIso(s); return `el ${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}` }
const municipios = (r: Patrocinio) => municipiosConNombre(r.municipios).map((x) => x.nombre).join(', ')

/** Recorrido del evento día a día: los días ya celebrados, rellenos; hoy, marcado */
function Recorrido({ r, hoy }: { r: Patrocinio; hoy: string }) {
  const inicio = r.fecha_inicio!
  const fin = finEvento(r)!
  const total = diasEntre(inicio, fin) + 1
  const dia = diasEntre(inicio, hoy) + 1
  const tono = TONO_ESTADO[r.estado]
  const texto = total === 1 ? 'Se celebra hoy' : `Día ${dia} de ${total}`
  const termina = fin === hoy ? 'Hoy es el último día' : `Termina ${elDia(fin)}`
  return (
    <div className="w-full sm:w-[15rem]">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-display text-[1.25rem] font-semibold leading-none text-tinta">{texto}</span>
        {total > 1 && <span className="text-[0.8rem] font-medium text-tinta/55">{Math.round((dia / total) * 100)} %</span>}
      </div>
      <div className="mt-2 flex h-2.5 gap-[3px]" role="img" aria-label={`${texto}. ${termina}.`}>
        {total <= 31
          ? Array.from({ length: total }, (_, i) => (
            <span key={i} className={`h-full flex-1 rounded-[2px] ${i + 1 === dia && total > 1 ? 'ring-2 ring-offset-1' : ''}`}
              style={{ background: i + 1 <= dia ? tono.barra : tono.fondo, ['--tw-ring-color' as string]: tono.barra }} />
          ))
          : (
            <span className="relative h-full flex-1 overflow-hidden rounded-[3px]" style={{ background: tono.fondo }}>
              <span className="absolute inset-y-0 left-0 rounded-[3px]" style={{ width: `${(dia / total) * 100}%`, background: tono.barra }} />
            </span>
          )}
      </div>
      <p className="mt-1.5 text-[0.82rem] text-tinta/60">{termina}</p>
    </div>
  )
}

function FilaEnCurso({ r, hoy }: { r: Patrocinio; hoy: string }) {
  const m = municipios(r)
  return (
    <li>
      <a href={`#/registro/${r.id}`} className="group flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-4 transition-colors hover:bg-indigo-claro/45 sm:flex-nowrap sm:px-5">
        <Fecha iso={r.fecha_inicio} />
        <span className="min-w-0 flex-1 basis-48">
          <span className="block font-semibold leading-snug text-tinta group-hover:text-indigo">{r.entidad || '(sin entidad)'}</span>
          <span className="mt-0.5 block text-[0.88rem] leading-snug text-tinta/70">{r.evento || 'Evento sin nombre'}</span>
          <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <EstadoChip estado={r.estado} />
            {m && <span className="text-[0.84rem] text-tinta/55">{m}</span>}
          </span>
        </span>
        <Recorrido r={r} hoy={hoy} />
      </a>
    </li>
  )
}

/** Días de espera desde que terminó: el número crece en tono según lo que lleva sin pagar */
function Espera({ dias }: { dias: number }) {
  const color = dias > 60 ? 'text-error' : dias > 30 ? 'text-aviso' : 'text-tinta/75'
  return (
    <span className="flex w-[4.2rem] shrink-0 flex-col items-center leading-none" aria-label={`Terminó hace ${dias} ${dias === 1 ? 'día' : 'días'}`}>
      <span className={`font-display text-[2rem] font-bold tabular-nums ${color}`}>{dias}</span>
      <span className="mt-1 text-[0.72rem] font-medium text-tinta/55">{dias === 1 ? 'día' : 'días'}</span>
    </span>
  )
}

function FilaSinPagar({ r, hoy }: { r: Patrocinio; hoy: string }) {
  const fin = finEvento(r)!
  const dias = diasEntre(fin, hoy)
  return (
    <li>
      <a href={`#/registro/${r.id}`} className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-indigo-claro/45 sm:px-5">
        <Espera dias={dias} />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold leading-snug text-tinta group-hover:text-indigo">{r.entidad || '(sin entidad)'}</span>
          <span className="mt-0.5 block truncate text-[0.86rem] text-tinta/65" title={r.evento}>{r.evento || 'Evento sin nombre'}</span>
          <span className="mt-1 block text-[0.84rem] text-tinta/55">Terminó {elDia(fin)}{deIso(fin).getFullYear() !== deIso(hoy).getFullYear() ? ` de ${deIso(fin).getFullYear()}` : ''}</span>
          <span className="mt-1.5 flex items-center gap-3 sm:hidden">
            <EstadoChip estado={r.estado} />
            <span className="font-display text-[1rem] font-semibold text-tinta/80">{eur(r.importe_total)}</span>
          </span>
        </span>
        <span className="hidden shrink-0 flex-col items-end gap-1.5 sm:flex">
          <EstadoChip estado={r.estado} />
          <span className="font-display text-[1.05rem] font-semibold text-tinta/80">{eur(r.importe_total)}</span>
        </span>
        <span className="max-md:hidden"><Dorsal numero={r.num_contrato} /></span>
      </a>
    </li>
  )
}

export function Eventos() {
  const { registros } = useStore()
  const hoy = hoyISO()
  const ahora = useMemo(() => enCurso(registros, hoy), [registros, hoy])
  const sinPagar = useMemo(() => terminadosSinPagar(registros, hoy), [registros, hoy])
  const [filtro, setFiltro] = useState<Estado | ''>('')
  const estados = ESTADOS.map((e) => e.valor).filter((e) => sinPagar.some((r) => r.estado === e))
  const vistos = filtro ? sinPagar.filter((r) => r.estado === filtro) : sinPagar
  const total = vistos.reduce((t, r) => t + r.importe_total, 0)

  return (
    <main className="mx-auto max-w-5xl px-4 pb-16 pt-7 sm:px-8 lg:pt-10">
      <h1 className="titulo">Eventos</h1>
      <p className="mt-2 max-w-2xl text-tinta/65">Los eventos que se están celebrando ahora y los que ya terminaron sin estar pagados.</p>

      <section aria-labelledby="t-ahora" className="mt-8">
        <div className="mb-3 flex items-baseline gap-3">
          <h2 id="t-ahora" className="font-display text-[1.7rem] font-semibold leading-tight">Celebrándose ahora</h2>
          <span className="text-[0.95rem] font-medium text-tinta/50">{ahora.length}</span>
        </div>
        {ahora.length === 0
          ? <p className="rounded-xl border border-dashed border-linea bg-white/60 px-5 py-6 text-tinta/60">Hoy no se está celebrando ningún evento patrocinado.</p>
          : <ul className="divide-y divide-linea/70 overflow-hidden rounded-xl border border-linea bg-white">{ahora.map((r) => <FilaEnCurso key={r.id} r={r} hoy={hoy} />)}</ul>}
      </section>

      <section aria-labelledby="t-sinpagar" className="mt-11">
        <div className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 id="t-sinpagar" className="font-display text-[1.7rem] font-semibold leading-tight">Terminados sin pagar</h2>
          <span className="text-[0.95rem] font-medium text-tinta/50">{sinPagar.length}</span>
        </div>
        <p className="mb-4 max-w-2xl text-[0.92rem] text-tinta/60">
          El evento ya terminó y el expediente no está pagado: falta que la entidad presente la factura o que se pague. Los que llevan más tiempo esperando, primero.
        </p>

        {sinPagar.length === 0 ? (
          <p className="rounded-xl border border-dashed border-linea bg-white/60 px-5 py-6 text-tinta/60">Todos los eventos que ya terminaron están pagados.</p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar por estado">
              <button type="button" aria-pressed={filtro === ''} onClick={() => setFiltro('')}
                className={`rounded-full border px-3 py-1.5 text-[0.86rem] font-semibold ${filtro === '' ? 'border-noche bg-noche text-white' : 'border-linea bg-white text-tinta/70 hover:border-tinta/30'}`}>
                Todos <span className="font-medium opacity-70">{sinPagar.length}</span>
              </button>
              {estados.map((e) => {
                const t = TONO_ESTADO[e]
                const activo = filtro === e
                return (
                  <button key={e} type="button" aria-pressed={activo} onClick={() => setFiltro(activo ? '' : e)}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[0.86rem] font-semibold ${activo ? 'border-transparent' : 'border-linea bg-white text-tinta/70 hover:border-tinta/30'}`}
                    style={activo ? { background: t.fondo, color: t.texto, boxShadow: `inset 0 0 0 1.5px ${t.barra}` } : undefined}>
                    <span aria-hidden="true" className="h-2.5 w-2.5 rounded-[3px]" style={{ background: t.barra }} />
                    {textoEstado(e)} <span className="font-medium opacity-70">{sinPagar.filter((r) => r.estado === e).length}</span>
                  </button>
                )
              })}
              <span className="ml-auto text-[0.92rem] text-tinta/65">{vistos.length === 1 ? '1 evento' : `${vistos.length} eventos`}, {eur(total)} sin pagar</span>
            </div>
            <ul className="divide-y divide-linea/70 overflow-hidden rounded-xl border border-linea bg-white">{vistos.map((r) => <FilaSinPagar key={r.id} r={r} hoy={hoy} />)}</ul>
          </>
        )}
      </section>
    </main>
  )
}
