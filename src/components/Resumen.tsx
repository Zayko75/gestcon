import { useMemo, useState } from 'react'
import { CLAVE_LIMITE, claveCredito, FIRMES, LIMITE_MENOR_DEFECTO, limiteMenor, municipiosConNombre, sinIva, usoPorAplicacion, type UsoAplicacion } from '../lib/control'
import { eur, numeroES, parseImporte } from '../lib/format'
import { useStore } from '../lib/store'
import { claveCif, formatoAplicacion } from '../lib/textos'
import { EntradaMascara } from './EntradaMascara'
import { filtrarListado } from './Listado'
import { ESTADOS, EstadoChip, useAviso } from './ui'

// Colores de los gráficos: dos pasos del índigo de la aplicación (validados para daltonismo); el texto nunca va en color
const FIRME = '#4a55c8'
const EN_CURSO = '#9aa3f0'
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** Importe editable que se guarda al salir del campo o al pulsar Intro */
function CampoImporte({ id, etiqueta, valor, onGuardar, placeholder }: { id: string; etiqueta: string; valor: number | null; onGuardar: (v: number | null) => Promise<void>; placeholder?: string }) {
  const [texto, setTexto] = useState(valor === null ? '' : numeroES(valor))
  const [error, setError] = useState('')
  const guardar = async () => {
    const n = texto.trim() === '' ? null : parseImporte(texto)
    if (texto.trim() !== '' && (n === null || n < 0)) { setError('Escribe un importe, por ejemplo 400.000,00'); return }
    setError('')
    if (n === valor) return
    await onGuardar(n)
    setTexto(n === null ? '' : numeroES(n))
  }
  return (
    <div>
      <label htmlFor={id} className="text-[0.8rem] font-medium text-tinta/60">{etiqueta}</label>
      <input id={id} className="campo mt-1 !py-1.5 text-right" inputMode="decimal" value={texto} placeholder={placeholder}
        onChange={(e) => setTexto(e.target.value)} onBlur={() => void guardar()}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void guardar() } }} aria-invalid={!!error} />
      {error && <p className="mt-1 text-[0.78rem] font-medium text-error">{error}</p>}
    </div>
  )
}

function Presupuesto({ u, onCredito }: { u: UsoAplicacion; onCredito: (v: number | null) => Promise<void> }) {
  const escala = Math.max(u.credito ?? 0, u.total) || 1
  const pct = (n: number) => `${(n / escala) * 100}%`
  const quedan = u.credito !== null ? Math.round((u.credito - u.total) * 100) / 100 : null
  return (
    <li className="grid gap-x-6 gap-y-3 px-5 py-5 sm:grid-cols-[minmax(0,1fr)_11rem]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <a href="#/" onClick={() => filtrarListado({ aplicacion: u.aplicacion })} className="font-display text-[1.25rem] font-semibold tracking-[0.01em] hover:text-indigo">{u.aplicacion}</a>
          <span className="text-[0.88rem] text-tinta/65">{u.patrocinios === 1 ? '1 patrocinio' : `${u.patrocinios} patrocinios`}</span>
        </div>
        {/* Barra: comprometido en firme + en curso, sobre el crédito (raya vertical) */}
        <div className="relative mt-3 h-6" role="img"
          aria-label={`${eur(u.firme)} firmado o tramitado y ${eur(u.enCurso)} en curso${u.credito !== null ? ` de un crédito de ${eur(u.credito)}` : ''}`}>
          <div className="absolute inset-y-1 left-0 right-0 rounded bg-papel" />
          <div className="absolute inset-y-0 left-0 flex gap-[2px]" style={{ width: pct(u.total) }}>
            {u.firme > 0 && <div className="h-full rounded-l-[4px] last:rounded-r-[4px]" style={{ width: `${(u.firme / u.total) * 100}%`, background: FIRME }} title={`Firmado o tramitado: ${eur(u.firme)}`} />}
            {u.enCurso > 0 && <div className="h-full first:rounded-l-[4px] rounded-r-[4px]" style={{ width: `${(u.enCurso / u.total) * 100}%`, background: EN_CURSO }} title={`En curso: ${eur(u.enCurso)}`} />}
          </div>
          {u.credito !== null && (
            <div className="absolute -inset-y-1 w-[2px] bg-tinta" style={{ left: `calc(${pct(u.credito)} - 1px)` }} title={`Crédito: ${eur(u.credito)}`} />
          )}
        </div>
        <p className="mt-2.5 text-[0.9rem] leading-snug text-tinta/75">
          Comprometido <strong className="font-semibold text-tinta">{eur(u.total)}</strong>
          {u.enCurso > 0 && <> ({eur(u.firme)} en firme y {eur(u.enCurso)} en curso)</>}
          {u.credito !== null && quedan !== null && (quedan >= 0
            ? <>. Quedan <strong className="font-semibold text-tinta">{eur(quedan)}</strong> ({Math.round((u.total / u.credito) * 100)} % usado).</>
            : <>. <strong className="font-semibold text-error">Supera el crédito en {eur(-quedan)}.</strong></>)}
          {u.credito === null && <>. Indica el crédito para ver lo que queda.</>}
        </p>
      </div>
      <CampoImporte key={u.credito ?? 'x'} id={`credito-${u.aplicacion}`} etiqueta="Crédito (€)" valor={u.credito} onGuardar={onCredito} placeholder="Sin indicar" />
    </li>
  )
}

export function Resumen() {
  const { registros, config, guardarConfig } = useStore()
  const aviso = useAviso()
  const anioActual = new Date().getFullYear()
  const anios = useMemo(() => {
    const s = new Set(registros.map((r) => r.anualidad).filter((a): a is number => a !== null))
    s.add(anioActual)
    return [...s].sort((a, b) => b - a)
  }, [registros, anioActual])
  const [anio, setAnio] = useState(() => (registros.some((r) => r.anualidad === anioActual) ? anioActual : anios.find((a) => registros.some((r) => r.anualidad === a)) ?? anioActual))
  const [nuevaAplic, setNuevaAplic] = useState('')

  const delAnio = useMemo(() => registros.filter((r) => r.anualidad === anio), [registros, anio])
  const usos = useMemo(() => usoPorAplicacion(registros, config).filter((u) => u.anio === anio || (u.anio === null && delAnio.some((r) => r.aplicacion.trim() === u.aplicacion))), [registros, config, anio, delAnio])
  const limite = limiteMenor(config)

  const total = delAnio.reduce((s, r) => s + r.importe_total, 0)
  const totalSinIva = delAnio.reduce((s, r) => s + sinIva(r), 0)
  const nEntidades = new Set(delAnio.map((r) => claveCif(r.cif) || r.entidad)).size

  const porEstado = ESTADOS.map((e) => {
    const l = delAnio.filter((r) => r.estado === e.valor)
    return { ...e, n: l.length, importe: l.reduce((s, r) => s + r.importe_total, 0) }
  })
  const maxEstado = Math.max(1, ...porEstado.map((e) => e.importe))

  const porMes = MESES.map((_, i) => {
    const l = delAnio.filter((r) => r.fecha_inicio && Number(r.fecha_inicio.slice(5, 7)) === i + 1 && Number(r.fecha_inicio.slice(0, 4)) === anio)
    return { n: l.length, importe: l.reduce((s, r) => s + r.importe_total, 0) }
  })
  const maxMes = Math.max(1, ...porMes.map((m) => m.n))
  const sinFechaEnAnio = delAnio.filter((r) => !r.fecha_inicio || Number(r.fecha_inicio.slice(0, 4)) !== anio).length

  const municipios = useMemo(() => {
    const m = new Map<string, { n: number; importe: number; nombre: string }>()
    for (const r of delAnio) for (const { clave, nombre } of municipiosConNombre(r.municipios)) {
      const x = m.get(clave) ?? { n: 0, importe: 0, nombre }
      x.n++; x.importe += r.importe_total
      m.set(clave, x)
    }
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n || b[1].importe - a[1].importe).slice(0, 10)
  }, [delAnio])
  const maxMun = Math.max(1, ...municipios.map(([, v]) => v.n))

  // Entidades que en el año suman más que el límite del contrato menor
  const acumulados = useMemo(() => {
    const m = new Map<string, { nombre: string; n: number; sinIva: number; ids: number[] }>()
    for (const r of delAnio) {
      const k = claveCif(r.cif) || r.entidad
      const x = m.get(k) ?? { nombre: r.entidad, n: 0, sinIva: 0, ids: [] }
      x.n++; x.sinIva += sinIva(r); x.ids.push(r.entidad_id ?? 0)
      m.set(k, x)
    }
    return [...m.values()].filter((x) => x.n > 1 && x.sinIva > limite).sort((a, b) => b.sinIva - a.sinIva)
  }, [delAnio, limite])

  const guardarCredito = (aplicacion: string) => async (v: number | null) => {
    await guardarConfig(claveCredito(aplicacion), v === null ? null : String(v))
    aviso(v === null ? `Crédito de ${aplicacion} quitado.` : `Crédito de ${aplicacion}: ${eur(v)}.`)
  }

  const anadirAplicacion = async () => {
    if (!/^\d{4}\/\d{4}\/\d{4}\/\d{5}$/.test(nuevaAplic)) { aviso('Escribe la aplicación completa: 0000/0000/0000/00000', 'error'); return }
    if (!usos.some((u) => u.aplicacion === nuevaAplic)) await guardarConfig(claveCredito(nuevaAplic), '0')
    if (Number(nuevaAplic.slice(0, 4)) !== anio) setAnio(Number(nuevaAplic.slice(0, 4)))
    setNuevaAplic('')
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-7 sm:px-8 lg:pt-10">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <h1 className="titulo">Resumen de {anio}</h1>
          <p className="mt-2 text-tinta/65">
            {delAnio.length === 0 ? 'Aún no hay patrocinios este año.' : <>
              {delAnio.length === 1 ? '1 patrocinio' : `${delAnio.length} patrocinios`} a {nEntidades === 1 ? '1 entidad' : `${nEntidades} entidades`}: {eur(total)} con IVA, {eur(Math.round(totalSinIva * 100) / 100)} sin IVA.
            </>}
          </p>
        </div>
        <div className="segmento" role="group" aria-label="Año">
          {anios.slice(0, 6).map((a) => <button key={a} type="button" aria-pressed={anio === a} onClick={() => setAnio(a)}>{a}</button>)}
        </div>
      </div>

      {/* Presupuesto */}
      <section aria-labelledby="t-presupuesto" className="mt-8 overflow-hidden rounded-xl border border-linea bg-white">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-linea px-5 py-4">
          <div>
            <h2 id="t-presupuesto" className="font-display text-[1.55rem] font-semibold leading-tight">Crédito por aplicación presupuestaria</h2>
            <p className="mt-0.5 text-[0.88rem] text-tinta/60">Importes con IVA. El crédito se guarda en el archivo de datos.</p>
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[0.84rem] text-tinta/70" aria-label="Leyenda">
            <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{ background: FIRME }} aria-hidden="true" />Firmado o tramitado</li>
            <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{ background: EN_CURSO }} aria-hidden="true" />En preparación o pendiente de firma</li>
            <li className="flex items-center gap-1.5"><span className="h-3.5 w-[2px] bg-tinta" aria-hidden="true" />Crédito</li>
          </ul>
        </div>
        {usos.length === 0
          ? <p className="px-5 py-8 text-tinta/65">Ningún patrocinio de {anio} tiene aplicación presupuestaria todavía.</p>
          : <ul className="divide-y divide-linea/70">{usos.map((u) => <Presupuesto key={u.aplicacion} u={u} onCredito={guardarCredito(u.aplicacion)} />)}</ul>}
        <div className="flex flex-wrap items-end gap-3 border-t border-linea bg-papel/60 px-5 py-4">
          <div className="w-60">
            <label htmlFor="nueva-aplic" className="text-[0.8rem] font-medium text-tinta/60">Indicar el crédito de otra aplicación</label>
            <EntradaMascara id="nueva-aplic" className="campo mt-1 !py-1.5" valor={nuevaAplic} onCambio={setNuevaAplic} formatear={formatoAplicacion} inputMode="numeric" placeholder={`${anio + 1}/1301/3411/22608`}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void anadirAplicacion() } }} />
          </div>
          <button type="button" className="btn-sec btn-sm" onClick={() => void anadirAplicacion()}>Añadir</button>
        </div>
      </section>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        {/* Por estado */}
        <section aria-labelledby="t-estado" className="rounded-xl border border-linea bg-white px-5 py-5">
          <h2 id="t-estado" className="font-display text-[1.4rem] font-semibold leading-tight">Por estado del expediente</h2>
          <table className="mt-3 w-full text-[0.9rem]">
            <thead className="sr-only"><tr><th>Estado</th><th>Patrocinios</th><th>Importe</th></tr></thead>
            <tbody>
              {porEstado.map((e) => (
                <tr key={e.valor} className="border-t border-linea/60 first:border-0">
                  <td className="w-44 py-2.5 pr-3"><a href="#/" onClick={() => filtrarListado({ anio: String(anio), estado: e.valor })}><EstadoChip estado={e.valor} /></a></td>
                  <td className="w-10 py-2.5 text-right tabular-nums text-tinta/75">{e.n}</td>
                  <td className="py-2.5 pl-4">
                    <div className="flex items-center gap-3">
                      <div className="h-3 flex-1"><div className="h-full rounded-r-[4px]" style={{ width: `${(e.importe / maxEstado) * 100}%`, background: FIRMES.includes(e.valor) ? FIRME : EN_CURSO, minWidth: e.importe ? 2 : 0 }} /></div>
                      <span className="w-28 text-right tabular-nums">{eur(e.importe)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Por mes */}
        <section aria-labelledby="t-mes" className="rounded-xl border border-linea bg-white px-5 py-5">
          <h2 id="t-mes" className="font-display text-[1.4rem] font-semibold leading-tight">Eventos por mes</h2>
          <p className="mt-0.5 text-[0.86rem] text-tinta/60">Patrocinios según el mes en que empieza el evento.</p>
          <div className="mt-4 flex h-40 items-end gap-1.5 border-b border-linea" role="img" aria-label={porMes.map((m, i) => `${MESES_LARGOS[i]}: ${m.n}`).join(', ')}>
            {porMes.map((m, i) => (
              <div key={i} className="flex h-full flex-1 flex-col items-center justify-end" title={`${MESES_LARGOS[i]}: ${m.n === 1 ? '1 patrocinio' : `${m.n} patrocinios`}, ${eur(m.importe)}`}>
                {m.n > 0 && <span className="mb-1 text-[0.78rem] font-semibold tabular-nums text-tinta/75">{m.n}</span>}
                <div className="w-full max-w-[24px] rounded-t-[4px]" style={{ height: `${(m.n / maxMes) * 82}%`, background: FIRME }} />
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex gap-1.5" aria-hidden="true">
            {MESES.map((m) => <span key={m} className="flex-1 text-center text-[0.72rem] text-tinta/55">{m}</span>)}
          </div>
          {sinFechaEnAnio > 0 && <p className="mt-2 text-[0.8rem] text-tinta/55">{sinFechaEnAnio === 1 ? '1 patrocinio no tiene' : `${sinFechaEnAnio} patrocinios no tienen`} la fecha del evento en {anio}.</p>}
        </section>

        {/* Municipios */}
        <section aria-labelledby="t-mun" className="rounded-xl border border-linea bg-white px-5 py-5">
          <h2 id="t-mun" className="font-display text-[1.4rem] font-semibold leading-tight">Municipios con más patrocinios</h2>
          {municipios.length === 0 ? <p className="mt-3 text-tinta/60">Sin datos.</p> : (
            <ol className="mt-3 space-y-2 text-[0.9rem]">
              {municipios.map(([k, v]) => (
                <li key={k} className="grid grid-cols-[minmax(0,9.5rem)_1fr_2rem] items-center gap-3" title={`${eur(v.importe)} en total`}>
                  <span className="truncate" title={v.nombre}>{v.nombre}</span>
                  <span className="h-3"><span className="block h-full rounded-r-[4px]" style={{ width: `${(v.n / maxMun) * 100}%`, background: FIRME }} /></span>
                  <span className="text-right tabular-nums text-tinta/75">{v.n}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Contrato menor */}
        <section aria-labelledby="t-menor" className="rounded-xl border border-linea bg-white px-5 py-5">
          <h2 id="t-menor" className="font-display text-[1.4rem] font-semibold leading-tight">Límite del contrato menor</h2>
          <p className="mt-1 text-[0.88rem] leading-snug text-tinta/65">
            La ficha avisa si un patrocinio supera este importe sin IVA, o si la entidad lo supera sumando todos los suyos del año.
          </p>
          <div className="mt-3 w-48">
            <CampoImporte key={limite} id="limite-menor" etiqueta="Límite sin IVA (€)" valor={limite}
              onGuardar={async (v) => { await guardarConfig(CLAVE_LIMITE, v === null || v === LIMITE_MENOR_DEFECTO ? null : String(v)); aviso(`Límite del contrato menor: ${eur(v ?? LIMITE_MENOR_DEFECTO)} sin IVA.`) }} />
          </div>
          <h3 className="mt-5 text-[0.95rem] font-semibold">Entidades que lo superan sumando sus patrocinios de {anio}</h3>
          {acumulados.length === 0 ? <p className="mt-1 text-[0.9rem] text-tinta/60">Ninguna.</p> : (
            <ul className="mt-2 divide-y divide-linea/60 text-[0.9rem]">
              {acumulados.map((x) => (
                <li key={x.nombre} className="flex items-baseline justify-between gap-3 py-2">
                  <a className="min-w-0 truncate hover:text-indigo hover:underline" href={x.ids[0] ? `#/entidad/${x.ids[0]}` : '#/entidades'}>{x.nombre}</a>
                  <span className="shrink-0 tabular-nums text-tinta/75">{x.n} patrocinios, <strong className="font-semibold text-aviso">{eur(Math.round(x.sinIva * 100) / 100)}</strong></span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
