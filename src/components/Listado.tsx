import { useMemo, useState } from 'react'
import { municipiosConNombre, municipiosDe, sinIva } from '../lib/control'
import { descargar, libroExcel, TIPO_XLSX, type Columna } from '../lib/excel'
import { eur, fechaES, parseImporte } from '../lib/format'
import { useStore } from '../lib/store'
import type { Patrocinio } from '../types'
import { Dorsal, ESTADOS, EstadoChip, textoEstado, useAviso } from './ui'

type Col = 'id' | 'num_contrato' | 'entidad' | 'anualidad' | 'importe_total' | 'fecha_inicio'

/** Columnas de la hoja de Excel: todos los datos del patrocinio */
const COLUMNAS_EXCEL: Columna<Patrocinio>[] = [
  { titulo: 'Nº contrato', ancho: 10, tipo: 'entero', valor: (r) => r.num_contrato },
  { titulo: 'Anualidad', ancho: 10, tipo: 'entero', valor: (r) => r.anualidad },
  { titulo: 'Estado', ancho: 17, tipo: 'texto', valor: (r) => textoEstado(r.estado) },
  { titulo: 'Entidad', ancho: 40, tipo: 'texto', valor: (r) => r.entidad },
  { titulo: 'CIF', ancho: 13, tipo: 'texto', valor: (r) => r.cif },
  { titulo: 'Representante legal', ancho: 30, tipo: 'texto', valor: (r) => r.representante_legal },
  { titulo: 'DNI/NIE', ancho: 14, tipo: 'texto', valor: (r) => r.dni_nie_representante },
  { titulo: 'Teléfono', ancho: 14, tipo: 'texto', valor: (r) => r.telefono },
  { titulo: 'Email', ancho: 30, tipo: 'texto', valor: (r) => r.email },
  { titulo: 'Evento', ancho: 45, tipo: 'texto', valor: (r) => r.evento },
  { titulo: 'Fecha de celebración', ancho: 28, tipo: 'texto', valor: (r) => r.fecha_celebracion },
  { titulo: 'Inicio', ancho: 11, tipo: 'fecha', valor: (r) => r.fecha_inicio },
  { titulo: 'Fin', ancho: 11, tipo: 'fecha', valor: (r) => r.fecha_fin },
  { titulo: 'Municipios', ancho: 28, tipo: 'texto', valor: (r) => r.municipios },
  { titulo: 'Soportes', ancho: 60, tipo: 'texto', valor: (r) => r.soportes_enumerados },
  { titulo: 'Aplicación presupuestaria', ancho: 22, tipo: 'texto', valor: (r) => r.aplicacion },
  { titulo: 'Importe sin IVA', ancho: 15, tipo: 'euro', valor: (r) => sinIva(r), total: true },
  { titulo: 'IVA', ancho: 7, tipo: 'porcentaje', valor: (r) => r.iva_pct },
  { titulo: 'Importe total', ancho: 15, tipo: 'euro', valor: (r) => r.importe_total, total: true },
  { titulo: 'Importe REDING', ancho: 15, tipo: 'euro', valor: (r) => r.importe_reding, total: true },
  { titulo: 'Plazo de ejecución', ancho: 11, tipo: 'fecha', valor: (r) => r.plazo_ejecucion },
  { titulo: 'Fecha de firma', ancho: 11, tipo: 'fecha', valor: (r) => r.fecha_firma },
]

interface Filtros { municipio: string; aplicacion: string; importeDesde: string; importeHasta: string; fechaDesde: string; fechaHasta: string }
/** Abre el listado con filtros puestos (desde el Resumen) */
export function filtrarListado(x: { anio?: string; estado?: string; aplicacion?: string }) {
  try { sessionStorage.setItem('gestcon-filtro', JSON.stringify(x)) } catch { /* sin almacenamiento: se abre sin filtrar */ }
}
function filtroInicial(): { anio?: string; estado?: string; aplicacion?: string } {
  try {
    const v = sessionStorage.getItem('gestcon-filtro')
    sessionStorage.removeItem('gestcon-filtro')
    return v ? JSON.parse(v) : {}
  } catch { return {} }
}

const SIN_FILTROS: Filtros = { municipio: '', aplicacion: '', importeDesde: '', importeHasta: '', fechaDesde: '', fechaHasta: '' }

const sinTildes = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function Listado() {
  const { registros } = useStore()
  const aviso = useAviso()
  const [inicial] = useState(filtroInicial)
  const [q, setQ] = useState('')
  const [f, setF] = useState<Filtros>({ ...SIN_FILTROS, aplicacion: inicial.aplicacion ?? '' })
  const [masFiltros, setMasFiltros] = useState(!!inicial.aplicacion)
  const setFiltro = (k: keyof Filtros, v: string) => setF((x) => ({ ...x, [k]: v }))
  const [anio, setAnio] = useState(inicial.anio ?? '')
  const [estado, setEstado] = useState(inicial.estado ?? '')
  const [orden, setOrden] = useState<{ col: Col; asc: boolean }>({ col: 'id', asc: false })

  const anios = useMemo(
    () => [...new Set(registros.map((r) => r.anualidad).filter((a): a is number => a !== null))].sort((a, b) => b - a),
    [registros],
  )

  const municipios = useMemo(() => {
    const m = new Map<string, { n: number; nombre: string }>()
    for (const r of registros) for (const { clave, nombre } of municipiosConNombre(r.municipios)) m.set(clave, { n: (m.get(clave)?.n ?? 0) + 1, nombre: m.get(clave)?.nombre ?? nombre })
    return [...m.values()].sort((a, b) => b.n - a.n).map((x) => x.nombre)
  }, [registros])
  const aplicaciones = useMemo(() => [...new Set(registros.map((r) => r.aplicacion.trim()).filter(Boolean))].sort().reverse(), [registros])
  const nFiltrosExtra = Object.values(f).filter(Boolean).length

  const filas = useMemo(() => {
    const mun = f.municipio ? municipiosDe(f.municipio)[0] ?? '' : ''
    const desde = f.importeDesde ? parseImporte(f.importeDesde) : null
    const hasta = f.importeHasta ? parseImporte(f.importeHasta) : null
    const termino = sinTildes(q.trim())
    const encontrados = registros.filter((r) => {
      if (anio && String(r.anualidad) !== anio) return false
      if (estado === 'sin_tramitar' && r.estado === 'tramitado') return false
      if (estado && estado !== 'sin_tramitar' && r.estado !== estado) return false
      if (mun && !municipiosDe(r.municipios).includes(mun)) return false
      if (f.aplicacion && r.aplicacion.trim() !== f.aplicacion) return false
      if (desde !== null && r.importe_total < desde) return false
      if (hasta !== null && r.importe_total > hasta) return false
      if (f.fechaDesde && (r.fecha_fin ?? r.fecha_inicio ?? '') < f.fechaDesde) return false
      if (f.fechaHasta && (r.fecha_inicio ?? '9999') > f.fechaHasta) return false
      if (!termino) return true
      const pajar = sinTildes([r.entidad, r.evento, r.cif, r.municipios, r.num_contrato ?? '', r.representante_legal, r.aplicacion].join(' '))
      return termino.split(/\s+/).every((t) => pajar.includes(t))
    })
    const dir = orden.asc ? 1 : -1
    return [...encontrados].sort((a, b) => {
      const x = a[orden.col], y = b[orden.col]
      if (x === y) return 0
      if (x === null) return 1
      if (y === null) return -1
      return (typeof x === 'string' ? x.localeCompare(y as string, 'es') : (x as number) - (y as number)) * dir
    })
  }, [registros, q, anio, estado, orden, f])

  const pendientes = registros.filter((r) => r.estado !== 'tramitado').length
  const filtrado = q.trim() !== '' || anio !== '' || estado !== '' || nFiltrosExtra > 0
  const quitarFiltros = () => { setQ(''); setAnio(''); setEstado(''); setF(SIN_FILTROS) }

  const exportar = () => {
    const partes = ['patrocinios', anio || 'todos', filtrado ? 'filtrado' : ''].filter(Boolean)
    descargar(`${partes.join('_')}.xlsx`, libroExcel(anio ? `Patrocinios ${anio}` : 'Patrocinios', COLUMNAS_EXCEL, filas), TIPO_XLSX)
    aviso(filas.length === 1 ? 'Exportado 1 patrocinio a Excel.' : `Exportados ${filas.length} patrocinios a Excel.`)
  }

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
        <div>
          <label htmlFor="estado" className="sr-only">Estado</label>
          <select id="estado" className="campo !w-auto !py-2.5 pr-9" value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="sin_tramitar">Sin tramitar</option>
            {ESTADOS.map((e) => <option key={e.valor} value={e.valor}>{e.texto}</option>)}
          </select>
        </div>
        <button type="button" className="btn-sec !py-2.5" aria-expanded={masFiltros} aria-controls="mas-filtros" onClick={() => setMasFiltros((x) => !x)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
          Más filtros{nFiltrosExtra > 0 && <span className="rounded-full bg-indigo px-1.5 text-[0.75rem] font-bold text-white">{nFiltrosExtra}</span>}
        </button>
      </div>

      {masFiltros && (
        <div id="mas-filtros" className="mt-3 grid gap-x-4 gap-y-4 rounded-xl border border-linea bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="f-municipio" className="etiqueta">Municipio</label>
            <input id="f-municipio" className="campo" list="lista-mun-filtro" value={f.municipio} onChange={(e) => setFiltro('municipio', e.target.value)} placeholder="Cualquiera" autoComplete="off" />
            <datalist id="lista-mun-filtro">{municipios.map((m) => <option key={m} value={m} />)}</datalist>
          </div>
          <div>
            <label htmlFor="f-aplic" className="etiqueta">Aplicación presupuestaria</label>
            <select id="f-aplic" className="campo" value={f.aplicacion} onChange={(e) => setFiltro('aplicacion', e.target.value)}>
              <option value="">Cualquiera</option>
              {aplicaciones.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <fieldset>
            <legend className="etiqueta">Importe total (€)</legend>
            <div className="flex items-center gap-2">
              <input aria-label="Importe desde" className="campo min-w-0" inputMode="decimal" placeholder="Desde" value={f.importeDesde} onChange={(e) => setFiltro('importeDesde', e.target.value)} />
              <input aria-label="Importe hasta" className="campo min-w-0" inputMode="decimal" placeholder="Hasta" value={f.importeHasta} onChange={(e) => setFiltro('importeHasta', e.target.value)} />
            </div>
          </fieldset>
          <fieldset>
            <legend className="etiqueta">Fecha del evento</legend>
            <div className="flex items-center gap-2">
              <input aria-label="Evento desde" type="date" className="campo min-w-0 !px-2" value={f.fechaDesde} onChange={(e) => setFiltro('fechaDesde', e.target.value)} />
              <input aria-label="Evento hasta" type="date" className="campo min-w-0 !px-2" value={f.fechaHasta} min={f.fechaDesde || undefined} onChange={(e) => setFiltro('fechaHasta', e.target.value)} />
            </div>
          </fieldset>
        </div>
      )}

      <div className="mt-4 flex min-h-[2.25rem] flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-[0.88rem] text-tinta/60" role="status">
          {filtrado ? <>
            {filas.length === 1 ? '1 patrocinio coincide' : `${filas.length} patrocinios coinciden`}, {eur(filas.reduce((s, r) => s + r.importe_total, 0))}.
            {' '}<button type="button" className="font-medium text-indigo underline underline-offset-2" onClick={quitarFiltros}>Quitar filtros</button>
          </> : <>{eur(registros.reduce((s, r) => s + r.importe_total, 0))} en total.</>}
        </p>
        <button type="button" className="btn-texto btn-sm" onClick={exportar} disabled={filas.length === 0}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" /></svg>
          Exportar {filtrado ? 'lo filtrado' : 'todo'} a Excel
        </button>
      </div>

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
                <button className="btn-sec mt-5" onClick={quitarFiltros}>Quitar filtros</button>
              </>
            )}
          </div>
        ) : (
          <table className="w-full text-[0.92rem]">
            <thead className="border-b border-linea text-[0.84rem] text-tinta/55">
              <tr>
                {cab('num_contrato', 'Contrato', 'w-24')}
                {cab('entidad', 'Patrocinio')}
                {cab('fecha_inicio', 'Evento', 'w-32 max-lg:hidden')}
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
                  <td className="whitespace-nowrap px-4 py-3 align-middle text-tinta/70 max-lg:hidden">{fechaES(r.fecha_inicio)}</td>
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
