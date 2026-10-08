import { useMemo, useState } from 'react'
import { eur } from '../lib/format'
import { useStore } from '../lib/store'
import { Dorsal, EstadoChip } from './ui'

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
      if (estado === 'pendiente' && r.estado === 'tramitado') return false
      if (estado === 'tramitado' && r.estado !== 'tramitado') return false
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

  const pendientes = registros.filter((r) => r.estado !== 'tramitado').length
  const filtrado = q.trim() !== '' || anio !== '' || estado !== ''

  const cab = (col: Col, texto: string, clase = '') => {
    const activa = orden.col === col
    return (
      <th scope="col" aria-sort={activa ? (orden.asc ? 'ascending' : 'descending') : 'none'} className={`whitespace-nowrap px-4 py-3 text-left font-medium ${clase}`}>
        <button className={`inline-flex items-center gap-1.5 rounded hover:text-tinta ${activa ? 'text-tinta' : ''}`} onClick={() => setOrden({ col, asc: activa ? !orden.asc : col === 'entidad' })}>
          {texto}
          <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden="true" className={activa ? 'text-indigo' : 'text-tinta/25'}>
            <path d="M5 1 9 5H1z" fill="currentColor" opacity={activa && !orden.asc ? 0.25 : 1} />
            <path d="M5 11 1 7h8z" fill="currentColor" opacity={activa && orden.asc ? 0.25 : 1} />
          </svg>
        </button>
      </th>
    )
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-7 sm:px-8 lg:pt-10">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <h1 className="titulo">Patrocinios</h1>
          <p className="mt-2 text-tinta/65">
            {registros.length === 0 ? 'Aún no hay ningún patrocinio.' : <>{registros.length} patrocinios, {pendientes === 0 ? 'todos tramitados' : <><strong className="font-semibold text-aviso">{pendientes} pendientes</strong> de tramitar</>}.</>}
          </p>
        </div>
        <a href="#/nuevo" className="btn-primario">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          Nuevo patrocinio
        </a>
      </div>

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <label htmlFor="buscar" className="sr-only">Buscar</label>
          <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tinta/40" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input id="buscar" type="search" className="campo !py-2.5 pl-10" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por entidad, evento, CIF, municipio o nº de contrato" autoFocus />
        </div>
        <div>
          <label htmlFor="anio" className="sr-only">Anualidad</label>
          <select id="anio" className="campo !w-auto !py-2.5 pr-9" value={anio} onChange={(e) => setAnio(e.target.value)}>
            <option value="">Todos los años</option>
            {anios.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="segmento" role="group" aria-label="Estado">
          {([['', 'Todos'], ['pendiente', 'Pendientes'], ['tramitado', 'Tramitados']] as const).map(([v, t]) => (
            <button key={v} type="button" aria-pressed={estado === v} onClick={() => setEstado(v)}>{t}</button>
          ))}
        </div>
      </div>

      <p className="mt-4 min-h-[1.25rem] text-[0.88rem] text-tinta/60" role="status">
        {filtrado && (filas.length === 1 ? '1 patrocinio coincide' : `${filas.length} patrocinios coinciden`)}
      </p>

      <div className="mt-1 overflow-hidden rounded-xl border border-linea bg-white">
        {filas.length === 0 ? (
          <div className="px-6 py-16 text-center">
            {registros.length === 0 ? (
              <>
                <p className="font-display text-2xl font-semibold">Empieza por el primer patrocinio</p>
                <p className="mt-2 text-tinta/65">Con sus datos podrás generar los anexos, el contrato y los informes.</p>
                <a className="btn-primario mt-5" href="#/nuevo">Nuevo patrocinio</a>
              </>
            ) : (
              <>
                <p className="font-display text-2xl font-semibold">Ningún patrocinio coincide</p>
                <p className="mt-2 text-tinta/65">Prueba con menos palabras o quita los filtros.</p>
                <button className="btn-sec mt-5" onClick={() => { setQ(''); setAnio(''); setEstado('') }}>Quitar filtros</button>
              </>
            )}
          </div>
        ) : (
          <table className="w-full text-[0.92rem]">
            <thead className="border-b border-linea text-[0.84rem] text-tinta/55">
              <tr>
                {cab('num_contrato', 'Contrato', 'w-24')}
                {cab('entidad', 'Patrocinio')}
                {cab('anualidad', 'Año', 'w-20 max-sm:hidden')}
                {cab('importe_total', 'Importe', 'w-40 text-right max-md:hidden [&>button]:ml-auto')}
                <th scope="col" className="w-36 px-4 py-3 text-left font-medium max-sm:hidden">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((r) => (
                <tr key={r.id} className="group cursor-pointer border-b border-linea/70 transition-colors last:border-0 hover:bg-indigo-claro/45"
                  onClick={() => (location.hash = `#/registro/${r.id}`)}>
                  <td className="py-3 pl-4 pr-2 align-middle"><Dorsal numero={r.num_contrato} /></td>
                  <td className="px-4 py-3 align-middle">
                    <a href={`#/registro/${r.id}`} onClick={(e) => e.stopPropagation()} className="font-semibold leading-snug text-tinta group-hover:text-indigo">
                      {r.entidad || '(sin entidad)'}
                    </a>
                    <div className="mt-0.5 line-clamp-1 text-[0.86rem] text-tinta/60" title={r.evento}>{r.evento}</div>
                    <div className="mt-1.5 flex items-center gap-3 md:hidden">
                      <span className="font-display text-[1.05rem] font-semibold">{eur(r.importe_total)}</span>
                      <span className="sm:hidden"><EstadoChip estado={r.estado} /></span>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-middle text-tinta/70 max-sm:hidden">{r.anualidad ?? ''}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right align-middle font-display text-[1.15rem] font-semibold max-md:hidden">{eur(r.importe_total)}</td>
                  <td className="px-4 py-3 align-middle max-sm:hidden"><EstadoChip estado={r.estado} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  )
}
