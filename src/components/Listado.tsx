import { useMemo, useState } from 'react'
import { eur } from '../lib/format'
import { useStore } from '../lib/store'
import { EstadoChip } from './ui'

type Col = 'id' | 'num_contrato' | 'entidad' | 'anualidad' | 'importe_total'

const sinTildes = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function Listado() {
  const { registros } = useStore()
  const [q, setQ] = useState('')
  const [anio, setAnio] = useState('')
  const [estado, setEstado] = useState('')
  const [orden, setOrden] = useState<{ col: Col; asc: boolean }>({ col: 'id', asc: false })

  const anios = useMemo(
    () => [...new Set(registros.map((r) => r.anualidad).filter((a): a is number => a !== null))].sort((a, b) => b - a),
    [registros],
  )

  const filas = useMemo(() => {
    const termino = sinTildes(q.trim())
    const f = registros.filter((r) => {
      if (anio && String(r.anualidad) !== anio) return false
      if (estado === 'pendiente' && r.tramitado) return false
      if (estado === 'tramitado' && !r.tramitado) return false
      if (!termino) return true
      const pajar = sinTildes([r.entidad, r.evento, r.cif, r.municipios, r.num_contrato ?? '', r.representante_legal, r.aplicacion].join(' '))
      return termino.split(/\s+/).every((t) => pajar.includes(t))
    })
    const dir = orden.asc ? 1 : -1
    return [...f].sort((a, b) => {
      const x = a[orden.col], y = b[orden.col]
      if (x === y) return 0
      if (x === null) return 1
      if (y === null) return -1
      return (typeof x === 'string' ? x.localeCompare(y as string, 'es') : (x as number) - (y as number)) * dir
    })
  }, [registros, q, anio, estado, orden])

  const cab = (col: Col, texto: string, clase = '') => {
    const activa = orden.col === col
    return (
      <th scope="col" aria-sort={activa ? (orden.asc ? 'ascending' : 'descending') : 'none'} className={`whitespace-nowrap px-3 py-2 text-left font-medium ${clase}`}>
        <button className="inline-flex items-center gap-1 hover:text-indigo" onClick={() => setOrden({ col, asc: activa ? !orden.asc : col === 'entidad' })}>
          {texto}
          <span aria-hidden="true" className={activa ? 'text-indigo' : 'text-tinta/25'}>{activa ? (orden.asc ? '▲' : '▼') : '↕'}</span>
        </button>
      </th>
    )
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[260px] flex-1">
          <label htmlFor="buscar" className="etiqueta">Buscar</label>
          <input id="buscar" type="search" className="campo" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Entidad, evento, CIF, municipio o nº de contrato" autoFocus />
        </div>
        <div>
          <label htmlFor="anio" className="etiqueta">Anualidad</label>
          <select id="anio" className="campo" value={anio} onChange={(e) => setAnio(e.target.value)}>
            <option value="">Todas</option>
            {anios.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="estado" className="etiqueta">Estado</label>
          <select id="estado" className="campo" value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">Todos</option>
            <option value="pendiente">Pendientes</option>
            <option value="tramitado">Tramitados</option>
          </select>
        </div>
        <a href="#/nuevo" className="btn-primario">Nuevo patrocinio</a>
      </div>

      <p className="mt-4 text-sm text-tinta/70" role="status">
        {filas.length === registros.length ? `${registros.length} patrocinios` : `${filas.length} de ${registros.length} patrocinios`}
      </p>

      <div className="mt-2 overflow-x-auto rounded-lg border border-linea bg-white">
        {filas.length === 0 ? (
          <div className="px-6 py-14 text-center text-sm text-tinta/70">
            {registros.length === 0 ? (
              <>Todavía no hay patrocinios. <a className="font-medium text-indigo underline" href="#/nuevo">Crea el primero</a>.</>
            ) : (
              <>Ningún patrocinio coincide con la búsqueda. Prueba con menos palabras o quita los filtros.</>
            )}
          </div>
        ) : (
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-linea bg-papel text-tinta/80">
              <tr>
                {cab('num_contrato', 'Nº contrato', 'w-28')}
                {cab('entidad', 'Entidad')}
                <th scope="col" className="px-3 py-2 text-left font-medium">Evento</th>
                {cab('anualidad', 'Año', 'w-20')}
                {cab('importe_total', 'Importe', 'w-36 [&>button]:ml-auto')}
                <th scope="col" className="w-32 px-3 py-2 text-left font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((r) => (
                <tr key={r.id} className="cursor-pointer border-b border-linea/70 last:border-0 hover:bg-indigo-claro/60"
                  onClick={() => (location.hash = `#/registro/${r.id}`)}>
                  <td className="px-3 py-2.5">{r.num_contrato ?? <span className="text-tinta/35">—</span>}</td>
                  <td className="px-3 py-2.5 font-medium">
                    <a href={`#/registro/${r.id}`} onClick={(e) => e.stopPropagation()} className="hover:text-indigo hover:underline">{r.entidad || '(sin entidad)'}</a>
                  </td>
                  <td className="max-w-md truncate px-3 py-2.5 text-tinta/80" title={r.evento}>{r.evento}</td>
                  <td className="px-3 py-2.5">{r.anualidad ?? ''}</td>
                  <td className="px-3 py-2.5 text-right">{eur(r.importe_total)}</td>
                  <td className="px-3 py-2.5"><EstadoChip tramitado={!!r.tramitado} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  )
}
