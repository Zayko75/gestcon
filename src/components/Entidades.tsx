import { useMemo, useState } from 'react'
import { aBorrador, deBorrador } from '../lib/borrador'
import { limiteMenor, sinIva } from '../lib/control'
import { eur } from '../lib/format'
import { useStore } from '../lib/store'
import { aplicacionPorDefecto, claveCif } from '../lib/textos'
import type { Patrocinio } from '../types'
import { Fecha } from './Pendientes'
import { Dialogo, Dorsal, EstadoChip, useAviso } from './ui'

const sinTildes = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Patrocinios de cada entidad (por su id o, si falta, por CIF), del más reciente al más antiguo */
function useHistorial() {
  const { registros, entidades } = useStore()
  return useMemo(() => {
    const porClave = new Map(entidades.map((e) => [e.clave_cif, e.id]))
    const m = new Map<number, Patrocinio[]>()
    for (const r of registros) {
      const id = r.entidad_id ?? porClave.get(claveCif(r.cif))
      if (id === undefined) continue
      m.set(id, [...(m.get(id) ?? []), r])
    }
    for (const l of m.values()) l.sort((a, b) => (b.anualidad ?? 0) - (a.anualidad ?? 0) || (b.fecha_inicio ?? '').localeCompare(a.fecha_inicio ?? '') || b.id - a.id)
    return m
  }, [registros, entidades])
}

export function Entidades() {
  const { entidades } = useStore()
  const historial = useHistorial()
  const [q, setQ] = useState('')
  const filas = useMemo(() => {
    const t = sinTildes(q.trim())
    return entidades
      .map((e) => {
        const ps = historial.get(e.id) ?? []
        return { e, n: ps.length, ultimo: ps[0]?.anualidad ?? null, total: ps.reduce((s, r) => s + r.importe_total, 0) }
      })
      .filter(({ e }) => !t || t.split(/\s+/).every((p) => sinTildes(`${e.nombre} ${e.cif} ${e.representante_legal}`).includes(p)))
      .sort((a, b) => (b.ultimo ?? 0) - (a.ultimo ?? 0) || a.e.nombre.localeCompare(b.e.nombre, 'es'))
  }, [entidades, historial, q])

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-7 sm:px-8 lg:pt-10">
      <h1 className="titulo">Entidades</h1>
      <p className="mt-2 text-tinta/65">{entidades.length} entidades patrocinadas. Abre una para ver su historial o renovar su patrocinio.</p>
      <div className="relative mt-7 max-w-xl">
        <label htmlFor="buscar-entidad" className="sr-only">Buscar entidad</label>
        <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tinta/40" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <input id="buscar-entidad" type="search" className="campo !py-2.5 pl-10" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, CIF o representante" autoFocus />
      </div>
      <div className="mt-5 overflow-hidden rounded-xl border border-linea bg-white">
        {filas.length === 0 ? (
          <p className="px-6 py-14 text-center text-tinta/65">Ninguna entidad coincide con «{q}».</p>
        ) : (
          <table className="w-full text-[0.92rem]">
            <thead className="border-b border-linea text-left text-[0.84rem] text-tinta/55">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Entidad</th>
                <th scope="col" className="w-28 px-4 py-3 text-right font-medium max-sm:hidden">Patrocinios</th>
                <th scope="col" className="w-24 px-4 py-3 text-right font-medium max-sm:hidden">Último año</th>
                <th scope="col" className="w-40 px-4 py-3 text-right font-medium max-md:hidden">Importe total</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(({ e, n, ultimo, total }) => (
                <tr key={e.id} className="group cursor-pointer border-b border-linea/70 last:border-0 hover:bg-indigo-claro/45" onClick={() => (location.hash = `#/entidad/${e.id}`)}>
                  <td className="px-4 py-3">
                    <a href={`#/entidad/${e.id}`} onClick={(x) => x.stopPropagation()} className="font-semibold leading-snug group-hover:text-indigo">{e.nombre || '(sin nombre)'}</a>
                    <div className="mt-0.5 text-[0.86rem] text-tinta/60">{e.cif}<span className="sm:hidden">{n ? `. ${n} patrocinios, el último en ${ultimo}` : ''}</span></div>
                  </td>
                  <td className="px-4 py-3 text-right text-tinta/75 max-sm:hidden">{n}</td>
                  <td className="px-4 py-3 text-right text-tinta/75 max-sm:hidden">{ultimo ?? ''}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-display text-[1.1rem] font-semibold max-md:hidden">{eur(total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  )
}

/** Año para el que se renueva: el siguiente al último patrocinio, nunca anterior al año en curso */
const anioRenovacion = (ultimo: Patrocinio) => Math.max((ultimo.anualidad ?? new Date().getFullYear()) + 1, new Date().getFullYear())

export function FichaEntidad({ id }: { id: number }) {
  const { entidades, config, crear, puede } = useStore()
  const aviso = useAviso()
  const historial = useHistorial()
  const [confirmar, setConfirmar] = useState(false)
  const e = entidades.find((x) => x.id === id)
  const ps = historial.get(id) ?? []
  const limite = limiteMenor(config)

  const porAnio = useMemo(() => {
    const m = new Map<number | null, Patrocinio[]>()
    for (const r of ps) m.set(r.anualidad, [...(m.get(r.anualidad) ?? []), r])
    return [...m.entries()].map(([anio, l]) => ({
      anio, l,
      total: l.reduce((s, r) => s + r.importe_total, 0),
      sinIva: Math.round(l.reduce((s, r) => s + sinIva(r), 0) * 100) / 100,
    }))
  }, [ps])

  if (!e) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-8">
        <p className="font-display text-3xl font-semibold">Esta entidad no existe</p>
        <a className="btn-primario mt-6" href="#/entidades">Ver todas las entidades</a>
      </main>
    )
  }

  const ultimo = ps[0]
  const objetivo = ultimo ? anioRenovacion(ultimo) : null

  const renovar = async () => {
    setConfirmar(false)
    if (!ultimo || objetivo === null) return
    const b = aBorrador(ultimo)
    const antes = ultimo.anualidad
    const r = deBorrador({
      ...b,
      // Datos de la entidad al día (los de su último patrocinio)
      entidad: e.nombre || b.entidad, cif: e.cif || b.cif, representante_legal: e.representante_legal, dni_nie_representante: e.dni_nie_representante,
      telefono: e.telefono, email: e.email,
      estado: 'preparacion', anualidad: String(objetivo), num_contrato: '', fecha_firma: '',
      evento: antes ? b.evento.replace(new RegExp(`\\b${antes}\\b`, 'g'), String(objetivo)) : b.evento,
      fecha_inicio: '', fecha_fin: '', fecha_celebracion: '', plazo_ejecucion: '',
      aplicacion: /^\d{4}\//.test(b.aplicacion) && antes && b.aplicacion.startsWith(String(antes)) ? String(objetivo) + b.aplicacion.slice(4) : aplicacionPorDefecto(objetivo),
    })
    if ('error' in r) { aviso(r.error, 'error'); return }
    try {
      const nuevo = await crear(r.datos)
      aviso(`Patrocinio de ${objetivo} creado. Revisa las fechas, el importe y los soportes.`)
      location.hash = `#/registro/${nuevo}`
    } catch (x) {
      aviso('No se pudo crear: ' + (x instanceof Error ? x.message : String(x)), 'error')
    }
  }

  const dato = (t: string, v: string) => (
    <div>
      <dt className="text-[0.82rem] text-tinta/55">{t}</dt>
      <dd className="mt-0.5 break-words font-medium">{v || <span className="font-normal text-tinta/40">Sin dato</span>}</dd>
    </div>
  )

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-5 sm:px-8 lg:pt-8">
      <a href="#/entidades" className="btn-texto -ml-2 mb-5">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        Entidades
      </a>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <h1 className="titulo break-words">{e.nombre}</h1>
          <p className="mt-1.5 text-tinta/65">{ps.length === 0 ? 'Sin patrocinios.' : ps.length === 1 ? '1 patrocinio' : `${ps.length} patrocinios desde ${ps[ps.length - 1].anualidad ?? '—'}`}. CIF {e.cif}</p>
        </div>
        {ultimo && puede('editar') && <button className="btn-primario" onClick={() => setConfirmar(true)}>Renovar para {objetivo}</button>}
      </div>

      <div className="mt-7 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          {porAnio.map(({ anio, l, total, sinIva: si }) => (
            <section key={anio ?? 'x'} aria-label={`Año ${anio ?? 'sin anualidad'}`} className="overflow-hidden rounded-xl border border-linea bg-white">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-linea px-5 py-3">
                <h2 className="font-display text-[1.5rem] font-semibold">{anio ?? 'Sin anualidad'}</h2>
                <span className="text-[0.9rem] text-tinta/65">{l.length === 1 ? '1 patrocinio' : `${l.length} patrocinios`}: {eur(total)} ({eur(si)} sin IVA)</span>
                {l.length > 1 && si > limite && (
                  <span className="w-full text-[0.84rem] font-medium text-aviso">Suma más que el límite del contrato menor ({eur(limite)} sin IVA). Comprueba que son objetos distintos.</span>
                )}
              </div>
              <ul className="divide-y divide-linea/70">
                {l.map((r) => (
                  <li key={r.id}>
                    <a href={`#/registro/${r.id}`} className="group flex items-center gap-4 px-5 py-3 hover:bg-indigo-claro/45">
                      <Fecha iso={r.fecha_inicio} apagada={r.estado === 'tramitado'} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium leading-snug group-hover:text-indigo">{r.evento || '(sin evento)'}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.86rem] text-tinta/60">
                          <EstadoChip estado={r.estado} /><span>{r.fecha_celebracion}</span>
                        </span>
                      </span>
                      <span className="shrink-0 text-right font-display text-[1.1rem] font-semibold">{eur(r.importe_total)}</span>
                      <span className="max-sm:hidden"><Dorsal numero={r.num_contrato} /></span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <aside className="rounded-xl border border-linea bg-white p-5" aria-label="Datos de la entidad">
          <h2 className="font-display text-[1.3rem] font-semibold">Datos de contacto</h2>
          <p className="mt-1 text-[0.84rem] leading-snug text-tinta/55">Los de su último patrocinio. Se usan al crear uno nuevo.</p>
          <dl className="mt-4 space-y-3 text-[0.92rem]">
            {dato('Representante legal', e.representante_legal)}
            {dato('DNI/NIE', e.dni_nie_representante)}
            {dato('Teléfono', e.telefono)}
            {dato('Email', e.email)}
          </dl>
        </aside>
      </div>

      {confirmar && ultimo && (
        <Dialogo titulo={`Renovar para ${objetivo}`} onCerrar={() => setConfirmar(false)}
          acciones={<>
            <button className="btn-sec" onClick={() => setConfirmar(false)}>Cancelar</button>
            <button className="btn-primario" onClick={renovar}>Crear patrocinio de {objetivo}</button>
          </>}>
          <p>Se crea un patrocinio nuevo copiando el de {ultimo.anualidad} («{ultimo.evento}»): entidad, evento, municipios, soportes e importe.</p>
          <p>Quedan vacíos el nº de contrato, las fechas del evento y la fecha de firma. El estado será «En preparación».</p>
        </Dialogo>
      )}
    </main>
  )
}

