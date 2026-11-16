import { useId, useMemo, useRef, useState } from 'react'
import { fechaES } from '../lib/format'
import { hoyISO, incidenciasDeTexto, textoDeIncidencias, type Incidencia } from '../lib/incidencias'

const Icono = ({ d, ancho = 2.2 }: { d: string; ancho?: number }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={ancho} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
)

const clave = (x: Incidencia, i: number) => `${i}|${x.fecha}|${x.texto}`

/**
 * Incidencias en la tramitación: se escribe una (con su fecha) y se pulsa Intro; quedan ordenadas por fecha,
 * unas debajo de otras, con una marca a la izquierda para indicar que la deficiencia está subsanada.
 * Solo informativo: no sale en los documentos.
 */
export function ListaIncidencias({ id, valor, onCambio, className = '' }: {
  id: string; valor: string; onCambio: (texto: string) => void; className?: string
}) {
  const lista = useMemo(() => incidenciasDeTexto(valor), [valor])
  const [texto, setTexto] = useState('')
  const [fecha, setFecha] = useState(hoyISO)
  const [editando, setEditando] = useState<{ i: number; campo: 'texto' | 'fecha'; valor: string } | null>(null)
  const [recien, setRecien] = useState<string | null>(null) // la que se acaba de añadir, para destacarla al entrar
  const [nota, setNota] = useState('')
  const entrada = useRef<HTMLInputElement>(null)
  const uid = useId()

  const pendientes = lista.filter((x) => !x.subsanada).length
  const subsanadas = lista.length - pendientes
  const guardar = (nueva: Incidencia[]) => onCambio(textoDeIncidencias(nueva))

  const anadir = () => {
    const t = texto.trim()
    if (!t) { entrada.current?.focus(); return }
    const nueva: Incidencia = { fecha, texto: t, subsanada: '' }
    guardar([...lista, nueva])
    // Tras ordenar por fecha, se busca dónde ha quedado para destacarla
    const orden = incidenciasDeTexto(textoDeIncidencias([...lista, nueva]))
    const i = orden.findIndex((y) => y.texto === t && y.fecha === fecha && !y.subsanada)
    setRecien(i >= 0 ? clave(orden[i], i) : null)
    setNota(`Incidencia añadida${fecha ? ` con fecha ${fechaES(fecha)}` : ''}.`)
    setTexto('')
    entrada.current?.focus()
  }

  const alternar = (i: number) => {
    const x = lista[i]
    const subsanada = x.subsanada ? '' : hoyISO()
    guardar(lista.map((y, j) => (j === i ? { ...y, subsanada } : y)))
    const quedan = pendientes + (subsanada ? -1 : 1)
    setNota(subsanada
      ? (quedan === 0 ? 'Subsanada. No queda ninguna incidencia pendiente.' : `Subsanada. ${quedan === 1 ? 'Queda 1 pendiente' : `Quedan ${quedan} pendientes`}.`)
      : 'Vuelve a estar pendiente.')
    setRecien(null)
  }

  const quitar = (i: number) => {
    guardar(lista.filter((_, j) => j !== i))
    setNota(`Quitada: ${lista[i].texto}.`)
    setRecien(null)
    entrada.current?.focus()
  }

  const terminarEdicion = (confirmar: boolean) => {
    if (!editando) return
    const { i, campo, valor: v } = editando
    setEditando(null)
    if (!confirmar || v === lista[i][campo]) return
    if (campo === 'texto' && !v.trim()) { quitar(i); return }
    guardar(lista.map((x, j) => (j === i ? { ...x, [campo]: campo === 'texto' ? v.trim() : v } : x)))
    setRecien(null)
  }

  // Estado de conjunto, junto al título
  const estado = !lista.length
    ? { texto: 'Sin incidencias', clase: 'bg-papel text-tinta/55' }
    : pendientes === 0
      ? { texto: lista.length === 1 ? 'Subsanada' : 'Todo subsanado', clase: 'bg-ok/10 text-ok' }
      : { texto: pendientes === 1 ? '1 pendiente' : `${pendientes} pendientes`, clase: 'bg-aviso/10 text-aviso' }

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="etiqueta !mb-0">Incidencias en la tramitación</label>
        <span key={estado.texto} role="status"
          className={`inline-flex shrink-0 animate-aparecer items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[0.8rem] font-semibold leading-none ${estado.clase}`}>
          {lista.length > 0 && pendientes === 0 && <Icono d="m5 12.5 4.5 4.5L19 7.5" ancho={3} />}
          {estado.texto}
        </span>
      </div>

      <div className="mt-2 overflow-hidden rounded-lg border border-linea bg-white transition-colors focus-within:border-indigo focus-within:ring-[3px] focus-within:ring-indigo/15 hover:border-tinta/25">
        {lista.length > 0 && (
          <>
            {/* Avance: la parte subsanada de la barra crece al marcar cada incidencia */}
            <div className="h-[3px] bg-aviso/15" aria-hidden="true">
              <div className="h-full bg-ok transition-[width] duration-500 ease-out" style={{ width: `${(subsanadas / lista.length) * 100}%` }} />
            </div>
            <ol className="divide-y divide-linea/70 border-b border-linea" aria-label="Incidencias, de la más antigua a la más reciente">
              {lista.map((x, i) => {
                const k = clave(x, i)
                const hecha = !!x.subsanada
                return (
                  <li key={k} className={`group flex items-start gap-2.5 py-2 pl-2.5 pr-1.5 transition-colors ${hecha ? 'bg-ok/[.035]' : ''} ${recien === k ? 'animate-fila' : ''}`}>
                    {/* Marca de subsanada */}
                    <button type="button" role="checkbox" aria-checked={hecha} onClick={() => alternar(i)}
                      aria-label={`${hecha ? 'Subsanada' : 'Pendiente'}: ${x.texto}`}
                      title={hecha ? 'Marcar otra vez como pendiente' : 'Marcar como subsanada'}
                      className={`mt-[3px] grid size-[1.35rem] shrink-0 place-items-center rounded-full border-2 transition-[background-color,border-color,transform] duration-200 enabled:active:scale-90
                        ${hecha ? 'border-ok bg-ok text-white' : 'border-tinta/25 bg-white text-transparent enabled:hover:border-ok enabled:hover:text-ok/40'}`}>
                      <span key={hecha ? 'si' : 'no'} className={hecha ? 'animate-marca' : ''}><Icono d="m5 12.5 4.5 4.5L19 7.5" ancho={3.4} /></span>
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        {editando?.i === i && editando.campo === 'fecha' ? (
                          <input type="date" autoFocus aria-label="Fecha de la incidencia" value={editando.valor}
                            className="rounded border border-indigo/50 px-1 py-px text-[0.82rem] focus:outline-none"
                            onChange={(e) => setEditando({ i, campo: 'fecha', valor: e.target.value })}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); terminarEdicion(true) } if (e.key === 'Escape') { e.preventDefault(); terminarEdicion(false) } }}
                            onBlur={() => terminarEdicion(true)} />
                        ) : (
                          <button type="button" onClick={() => setEditando({ i, campo: 'fecha', valor: x.fecha })} title="Pulsa para cambiar la fecha"
                            className={`shrink-0 rounded px-1 py-px font-display text-[0.92rem] font-semibold tabular-nums tracking-[0.01em] hover:bg-indigo-claro/60 ${hecha ? 'text-tinta/45' : 'text-indigo'}`}>
                            {x.fecha ? fechaES(x.fecha) : 'Sin fecha'}
                          </button>
                        )}
                        {hecha && <span className="text-[0.8rem] font-medium text-ok">Subsanada el {fechaES(x.subsanada)}</span>}
                      </div>
                      {editando?.i === i && editando.campo === 'texto' ? (
                        <input autoFocus aria-label={`Editar incidencia ${i + 1}`} value={editando.valor}
                          className="mt-0.5 w-full rounded border border-indigo/50 px-1.5 py-[3px] text-[0.93rem] leading-snug focus:outline-none"
                          onChange={(e) => setEditando({ i, campo: 'texto', valor: e.target.value })}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); terminarEdicion(true) } if (e.key === 'Escape') { e.preventDefault(); terminarEdicion(false) } }}
                          onBlur={() => terminarEdicion(true)} />
                      ) : (
                        <button type="button" onClick={() => setEditando({ i, campo: 'texto', valor: x.texto })} title="Pulsa para corregir el texto"
                          className={`mt-0.5 block w-full cursor-text rounded px-1 py-[2px] text-left text-[0.93rem] leading-snug transition-colors hover:bg-indigo-claro/60
                            ${hecha ? 'text-tinta/45 line-through decoration-tinta/30' : 'text-tinta'}`}>
                          {x.texto}
                        </button>
                      )}
                    </div>

                    <button type="button" onClick={() => quitar(i)} aria-label={`Quitar «${x.texto}»`}
                      className="mt-0.5 shrink-0 rounded p-1 text-tinta/55 opacity-0 transition-opacity hover:bg-error/10 hover:text-error focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
                      <Icono d="M18 6 6 18M6 6l12 12" />
                    </button>
                  </li>
                )
              })}
            </ol>
          </>
        )}

        {/* Nueva incidencia: fecha (hoy por defecto) y descripción */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-2 py-1.5">
          <label htmlFor={`${uid}-fecha`} className="sr-only">Fecha de la nueva incidencia</label>
          <input id={`${uid}-fecha`} type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
            className="rounded-md bg-papel/70 px-2 py-1 text-[0.86rem] text-tinta/80 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo/25" />
          <input ref={entrada} id={id} type="text" autoComplete="off" value={texto}
            onChange={(e) => { setTexto(e.target.value); setNota('') }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); anadir() } }}
            placeholder={lista.length ? 'Añadir otra incidencia…' : 'Describe la incidencia y pulsa Intro'}
            className="min-w-[12rem] flex-1 bg-transparent px-1 py-1.5 text-[0.95rem] placeholder:text-tinta/40 focus:outline-none" />
          <button type="button" className="btn-texto btn-sm" onClick={anadir} disabled={!texto.trim()}>Añadir</button>
        </div>
      </div>
      <p className="mt-1.5 min-h-[1.15rem] text-[0.82rem] leading-snug text-tinta/55" aria-live="polite">
        {nota || (lista.length
          ? 'Marca el círculo cuando se subsane. Pulsa la fecha o el texto para corregirlos.'
          : 'Solo para el seguimiento del expediente: no sale en los documentos.')}
      </p>
    </div>
  )
}
