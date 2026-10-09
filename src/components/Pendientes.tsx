import { useMemo } from 'react'
import { diasEntre, hoyISO, pendientes } from '../lib/control'
import { eur } from '../lib/format'
import { useStore } from '../lib/store'
import type { Patrocinio } from '../types'
import { Dorsal, EstadoChip } from './ui'

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** La fecha como en un calendario de competiciones: día grande y mes debajo */
export function Fecha({ iso, apagada = false }: { iso: string | null; apagada?: boolean }) {
  if (!iso) {
    return <span className="flex h-[3.1rem] w-[3.1rem] shrink-0 items-center justify-center rounded-md border border-dashed border-linea text-[0.72rem] text-tinta/40">sin fecha</span>
  }
  const [a, m, d] = iso.split('-').map(Number)
  return (
    <time dateTime={iso} className={`flex h-[3.1rem] w-[3.1rem] shrink-0 flex-col items-center justify-center rounded-md border leading-none ${apagada ? 'border-linea bg-papel text-tinta/55' : 'border-indigo/20 bg-indigo-claro/70 text-tinta'}`}>
      <span className="font-display text-[1.45rem] font-bold">{d}</span>
      <span className="mt-0.5 text-[0.7rem] font-medium">{MESES[m - 1]}{a !== new Date().getFullYear() ? ` ${String(a).slice(2)}` : ''}</span>
    </time>
  )
}

export function cuando(iso: string | null, hoy: string, pasado = 'hace'): string {
  if (!iso) return 'Sin fecha del evento'
  const n = diasEntre(hoy, iso)
  if (n === 0) return 'Hoy'
  if (n === 1) return 'Mañana'
  if (n === -1) return 'Ayer'
  return n > 0 ? `Dentro de ${n} días` : `${pasado} ${-n} días`.replace(/^./, (c) => c.toUpperCase())
}

function Fila({ r, nota, urgente = false }: { r: Patrocinio; nota: string; urgente?: boolean }) {
  return (
    <li>
      <a href={`#/registro/${r.id}`} className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-indigo-claro/45 sm:px-5">
        <Fecha iso={r.fecha_inicio} />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold leading-snug text-tinta group-hover:text-indigo">{r.entidad || '(sin entidad)'}</span>
          <span className="mt-0.5 block truncate text-[0.86rem] text-tinta/60" title={r.evento}>{r.evento}</span>
          <span className={`mt-1 block text-[0.84rem] font-medium ${urgente ? 'text-aviso' : 'text-tinta/60'}`}>{nota}</span>
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

function Grupo({ titulo, descripcion, filas, children }: { titulo: string; descripcion: string; filas: number; children: React.ReactNode }) {
  if (filas === 0) return null
  return (
    <section aria-label={titulo} className="mt-8">
      <div className="mb-3 flex items-baseline gap-3">
        <h2 className="font-display text-[1.55rem] font-semibold leading-tight">{titulo}</h2>
        <span className="rounded-full bg-tinta/[.07] px-2 py-0.5 text-[0.8rem] font-semibold text-tinta/70">{filas}</span>
      </div>
      <p className="-mt-1 mb-3 text-[0.9rem] text-tinta/60">{descripcion}</p>
      <ul className="divide-y divide-linea/70 overflow-hidden rounded-xl border border-linea bg-white">{children}</ul>
    </section>
  )
}

export function Pendientes() {
  const { registros } = useStore()
  const hoy = hoyISO()
  const p = useMemo(() => pendientes(registros, hoy), [registros, hoy])
  const nada = p.firmaUrgente.length + p.porJustificar.length + p.proximos.length + p.sinFirmar.length === 0

  return (
    <main className="mx-auto max-w-4xl px-4 pb-16 pt-7 sm:px-8 lg:pt-10">
      <h1 className="titulo">Pendientes</h1>
      <p className="mt-2 max-w-2xl text-tinta/65">
        Lo que queda por hacer en los expedientes que aún no están tramitados, empezando por lo más urgente.
      </p>

      {nada && (
        <div className="mt-8 rounded-xl border border-linea bg-white px-6 py-14 text-center">
          <p className="font-display text-2xl font-semibold">Todo al día</p>
          <p className="mt-2 text-tinta/65">No hay firmas pendientes ni eventos sin justificar.</p>
        </div>
      )}

      <Grupo titulo="Firmar antes del evento" filas={p.firmaUrgente.length}
        descripcion="En preparación o pendientes de firma, con el evento en los próximos 30 días o ya celebrado.">
        {p.firmaUrgente.map((r) => (
          <Fila key={r.id} r={r} urgente
            nota={`${r.estado === 'preparacion' ? 'En preparación' : 'Pendiente de firma'}. Evento: ${cuando(r.fecha_inicio, hoy).toLowerCase()}.`} />
        ))}
      </Grupo>

      <Grupo titulo="Por justificar" filas={p.porJustificar.length}
        descripcion="El evento ya se celebró (o venció el plazo de ejecución) y el expediente no está tramitado.">
        {p.porJustificar.map((r) => (
          <Fila key={r.id} r={r} urgente={diasEntre(r.fecha_fin ?? r.fecha_inicio ?? hoy, hoy) > 30}
            nota={`Terminó ${cuando(r.fecha_fin ?? r.fecha_inicio, hoy).toLowerCase()}. Falta el informe de justificación y tramitarlo.`} />
        ))}
      </Grupo>

      <Grupo titulo="Próximos eventos" filas={p.proximos.length}
        descripcion="Firmados, con el evento en los próximos 30 días.">
        {p.proximos.map((r) => <Fila key={r.id} r={r} nota={`Empieza ${cuando(r.fecha_inicio, hoy).toLowerCase()}.`} />)}
      </Grupo>

      <Grupo titulo="Sin firmar" filas={p.sinFirmar.length}
        descripcion="En preparación o pendientes de firma, con el evento más adelante.">
        {p.sinFirmar.map((r) => <Fila key={r.id} r={r} nota={r.fecha_inicio ? `Evento ${cuando(r.fecha_inicio, hoy).toLowerCase()}.` : 'Sin fecha del evento.'} />)}
      </Grupo>
    </main>
  )
}
