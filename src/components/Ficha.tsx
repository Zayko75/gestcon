import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { aBorrador, borradorVacio, deBorrador, type Borrador } from '../lib/borrador'
import { eur, importeSinIva } from '../lib/format'
import { parseImporte } from '../lib/format'
import { useStore } from '../lib/store'
import type { Patrocinio } from '../types'
import { PanelDocumentos } from './PanelDocumentos'
import { Dialogo, Dorsal, useAviso } from './ui'

function Campo({ id, etiqueta, ayuda, aviso, children, className = '' }: { id: string; etiqueta: string; ayuda?: string; aviso?: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="etiqueta">{etiqueta}</label>
      {children}
      {aviso ? <p className="mt-1.5 text-[0.82rem] font-medium text-aviso">{aviso}</p> : ayuda ? <p className="mt-1.5 text-[0.82rem] leading-snug text-tinta/55">{ayuda}</p> : null}
    </div>
  )
}

function Seccion({ titulo, descripcion, children }: { titulo: string; descripcion: string; children: ReactNode }) {
  return (
    <section aria-label={titulo} className="grid gap-x-8 gap-y-5 border-t border-linea px-5 py-7 first:border-t-0 sm:px-7 xl:grid-cols-[10.5rem_minmax(0,1fr)]">
      <div>
        <h2 className="font-display text-[1.4rem] font-semibold leading-tight">{titulo}</h2>
        <p className="mt-1 text-[0.85rem] leading-snug text-tinta/55">{descripcion}</p>
      </div>
      <div className="grid content-start gap-x-4 gap-y-5 sm:grid-cols-2">{children}</div>
    </section>
  )
}

export function Ficha({ id }: { id: number | null }) {
  const { registros, crear, actualizar, eliminar, copiaAhora, ivaPct } = useStore()
  const aviso = useAviso()
  const guardado = id !== null ? registros.find((r) => r.id === id) : undefined

  const [b, setB] = useState<Borrador>(() => (guardado ? aBorrador(guardado) : borradorVacio()))
  const [errorGuardar, setErrorGuardar] = useState('')
  const [confirmarBorrar, setConfirmarBorrar] = useState(false)
  const ultimo = useRef(JSON.stringify(b)) // última versión guardada
  const temporizador = useRef<number | undefined>(undefined)
  const bRef = useRef(b)
  bRef.current = b

  const set = <K extends keyof Borrador>(k: K, v: Borrador[K]) => setB((x) => ({ ...x, [k]: v }))
  const texto = (k: keyof Borrador) => ({
    id: 'f-' + k, className: 'campo', value: b[k] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, e.target.value as never),
  })

  const parsed = useMemo(() => deBorrador(b), [b])

  /** Guarda ya (sin esperar al temporizador). Devuelve true si los datos quedaron guardados. */
  const guardarAhora = useCallback(async (): Promise<boolean> => {
    window.clearTimeout(temporizador.current)
    if (id === null) return false
    const actual = bRef.current
    const r = deBorrador(actual)
    if ('error' in r) { setErrorGuardar(r.error); return false }
    setErrorGuardar('')
    if (JSON.stringify(actual) === ultimo.current) return true
    try {
      await actualizar(id, r.datos)
      ultimo.current = JSON.stringify(actual)
      return true
    } catch (e) {
      setErrorGuardar('No se pudo guardar: ' + (e instanceof Error ? e.message : String(e)))
      return false
    }
  }, [id, actualizar])

  // Guardado automático tras cada cambio (0,7 s después de dejar de escribir)
  useEffect(() => {
    if (id === null) return
    if (JSON.stringify(b) === ultimo.current) return
    const r = deBorrador(b)
    if ('error' in r) { setErrorGuardar(r.error); return }
    setErrorGuardar('')
    window.clearTimeout(temporizador.current)
    temporizador.current = window.setTimeout(() => { void guardarAhora() }, 700)
    return () => window.clearTimeout(temporizador.current)
  }, [b, id, guardarAhora])

  // Al salir de la ficha, no se pierde nada pendiente
  useEffect(() => () => { void guardarAhora() }, [guardarAhora])

  if (id !== null && !guardado) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-8">
        <p className="font-display text-3xl font-semibold">Este patrocinio no existe</p>
        <p className="mt-2 text-tinta/65">Puede que se haya eliminado o que el enlace sea antiguo.</p>
        <a className="btn-primario mt-6" href="#/">Ver todos los patrocinios</a>
      </main>
    )
  }

  // Navegación entre fichas (por orden de alta)
  const idx = guardado ? registros.findIndex((r) => r.id === guardado.id) : -1
  const anterior = idx > 0 ? registros[idx - 1] : null
  const siguiente = idx >= 0 && idx < registros.length - 1 ? registros[idx + 1] : null

  const crearNuevo = async () => {
    if ('error' in parsed) { setErrorGuardar(parsed.error); return }
    try {
      const nuevoId = await crear(parsed.datos)
      aviso('Patrocinio creado.')
      location.hash = `#/registro/${nuevoId}`
    } catch (e) {
      setErrorGuardar('No se pudo guardar: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  const duplicar = async () => {
    if (!guardado || 'error' in parsed) return
    if (!(await guardarAhora())) return
    const copia = { ...parsed.datos, tramitado: 0, num_contrato: null, fecha_firma: null }
    const nuevoId = await crear(copia)
    aviso('Se ha creado una copia sin nº de contrato ni fecha de firma. Ya puedes editarla.')
    location.hash = `#/registro/${nuevoId}`
  }

  const borrar = async () => {
    if (!guardado) return
    setConfirmarBorrar(false)
    try {
      await copiaAhora('antes-de-eliminar')
      await eliminar(guardado.id)
      aviso('Patrocinio eliminado. Queda una copia de seguridad anterior.')
      location.hash = '#/'
    } catch (e) {
      aviso('No se pudo eliminar: ' + (e instanceof Error ? e.message : String(e)), 'error')
    }
  }

  // Avisos de coherencia (no bloquean)
  const num = b.num_contrato.trim() === '' ? null : Number(b.num_contrato)
  const contratoRepetido = num !== null && registros.some((r) => r.id !== id && r.num_contrato === num)
  const avisoAplicacion = b.aplicacion && !/^\d{4}\/\d{4}\/\d{4}\/\d{5}$/.test(b.aplicacion) ? 'Formato habitual: 0000/0000/0000/00000' : undefined
  const total = parseImporte(b.importe_total)
  const sinIva = total !== null ? importeSinIva(total, ivaPct) : null

  const registroParaDocs: Patrocinio | null = guardado && 'datos' in parsed ? { ...guardado, ...parsed.datos } : null

  const flecha = (d: 'izq' | 'der') => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d === 'izq' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} />
    </svg>
  )

  return (
    <main className="mx-auto max-w-7xl px-4 pb-16 pt-5 sm:px-8 lg:pt-8">
      <nav className="mb-5 flex flex-wrap items-center gap-2" aria-label="Navegación de la ficha">
        <a href="#/" className="btn-texto -ml-2">{flecha('izq')} Patrocinios</a>
        {guardado && (
          <span className="ml-auto flex items-center gap-1.5">
            <a className={`btn-sec btn-sm ${anterior ? '' : 'pointer-events-none opacity-40'}`} href={anterior ? `#/registro/${anterior.id}` : undefined} aria-label="Patrocinio anterior" aria-disabled={!anterior}>{flecha('izq')}<span className="max-sm:hidden">Anterior</span></a>
            <a className={`btn-sec btn-sm ${siguiente ? '' : 'pointer-events-none opacity-40'}`} href={siguiente ? `#/registro/${siguiente.id}` : undefined} aria-label="Patrocinio siguiente" aria-disabled={!siguiente}><span className="max-sm:hidden">Siguiente</span>{flecha('der')}</a>
          </span>
        )}
      </nav>

      <div className="mb-7 flex flex-wrap items-center gap-x-6 gap-y-5">
        {id !== null && <Dorsal numero={num !== null && Number.isInteger(num) ? num : null} tamano="lg" />}
        <div className="min-w-0 flex-1 basis-72">
          <h1 className="titulo break-words">{id === null ? 'Nuevo patrocinio' : b.entidad || '(sin entidad)'}</h1>
          <p className="mt-1.5 max-w-3xl text-tinta/65">
            {id === null ? 'Rellena los datos y pulsa «Crear patrocinio». A partir de ahí, los cambios se guardan solos.' : b.evento}
          </p>
        </div>
        <label className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${b.tramitado ? 'border-ok/30 bg-ok/[.07]' : 'border-aviso/30 bg-aviso/[.07]'}`}>
          <input type="checkbox" role="switch" className="peer sr-only" checked={b.tramitado} onChange={(e) => set('tramitado', e.target.checked)} />
          <span aria-hidden="true" className={`relative h-6 w-11 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-indigo peer-focus-visible:ring-offset-2 ${b.tramitado ? 'bg-ok' : 'bg-tinta/25'}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left] ${b.tramitado ? 'left-[1.375rem]' : 'left-0.5'}`} />
          </span>
          <span className="leading-tight">
            <span className={`block font-semibold ${b.tramitado ? 'text-ok' : 'text-aviso'}`}>{b.tramitado ? 'Tramitado' : 'Pendiente'}</span>
            <span className="block text-[0.8rem] text-tinta/55">Marca si el expediente está tramitado</span>
          </span>
        </label>
      </div>

      {errorGuardar && (
        <p role="alert" className="mb-5 rounded-xl border border-error/30 bg-error/[.06] px-4 py-3 text-[0.92rem] font-medium text-error">{errorGuardar}</p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div>
          <div className="overflow-hidden rounded-xl border border-linea bg-white">
          <Seccion titulo="Entidad" descripcion="Quién recibe el patrocinio y cómo contactar.">
            <Campo id="f-entidad" etiqueta="Entidad" className="sm:col-span-2"><input {...texto('entidad')} autoFocus={id === null} /></Campo>
            <Campo id="f-cif" etiqueta="CIF"><input {...texto('cif')} /></Campo>
            <Campo id="f-representante_legal" etiqueta="Representante legal"><input {...texto('representante_legal')} /></Campo>
            <Campo id="f-dni_nie_representante" etiqueta="DNI/NIE del representante"><input {...texto('dni_nie_representante')} /></Campo>
            <Campo id="f-telefono" etiqueta="Teléfono"><input {...texto('telefono')} inputMode="tel" /></Campo>
            <Campo id="f-email" etiqueta="Email" className="sm:col-span-2"><input {...texto('email')} type="email" /></Campo>
          </Seccion>

          <Seccion titulo="Evento" descripcion="Qué se patrocina, cuándo, dónde y con qué soportes.">
            <Campo id="f-anualidad" etiqueta="Anualidad"><input {...texto('anualidad')} inputMode="numeric" /></Campo>
            <Campo id="f-plazo_ejecucion" etiqueta="Plazo de ejecución"><input {...texto('plazo_ejecucion')} type="date" /></Campo>
            <Campo id="f-evento" etiqueta="Evento" className="sm:col-span-2"><textarea {...texto('evento')} rows={2} /></Campo>
            <Campo id="f-fecha_celebracion" etiqueta="Fecha de celebración" ayuda="Texto libre, tal como saldrá en los documentos. Ejemplo: el 23 y 24 de septiembre de 2023">
              <input {...texto('fecha_celebracion')} />
            </Campo>
            <Campo id="f-municipios" etiqueta="Municipios"><input {...texto('municipios')} /></Campo>
            <Campo id="f-soportes_cedidos" etiqueta="Soportes cedidos por la Diputación" ayuda="Uno por línea">
              <textarea {...texto('soportes_cedidos')} rows={5} />
            </Campo>
            <Campo id="f-soportes_propios" etiqueta="Soportes propios de la entidad" ayuda="Uno por línea">
              <textarea {...texto('soportes_propios')} rows={5} />
            </Campo>
            <Campo id="f-soportes_enumerados" etiqueta="Soportes enumerados" ayuda="La misma lista en una sola línea, separada por comas (Informes económico y de justificación)" className="sm:col-span-2">
              <textarea {...texto('soportes_enumerados')} rows={3} />
            </Campo>
          </Seccion>

          <Seccion titulo="Contrato e importes" descripcion="Datos del expediente para anexos y contrato.">
            <Campo id="f-num_contrato" etiqueta="Nº de contrato" aviso={contratoRepetido ? 'Ya existe otro patrocinio con este número de contrato.' : undefined}>
              <input {...texto('num_contrato')} inputMode="numeric" />
            </Campo>
            <Campo id="f-aplicacion" etiqueta="Aplicación presupuestaria" aviso={avisoAplicacion}>
              <input {...texto('aplicacion')} placeholder="2026/1301/3411/22608" />
            </Campo>
            <Campo id="f-importe_total" etiqueta="Importe total (IVA incluido)" ayuda={sinIva !== null && total ? `Sin IVA: ${eur(sinIva)}. IVA (${ivaPct} %): ${eur(Math.round(((total ?? 0) - sinIva) * 100) / 100)}.` : undefined}>
              <input {...texto('importe_total')} inputMode="decimal" placeholder="0,00" />
            </Campo>
            <Campo id="f-importe_reding" etiqueta="Importe REDING"><input {...texto('importe_reding')} inputMode="decimal" placeholder="0,00" /></Campo>
            <Campo id="f-importe_letra" etiqueta="Importe total en letra" className="sm:col-span-2"><input {...texto('importe_letra')} placeholder="Dos mil cuatrocientos veinte euros" /></Campo>
            <Campo id="f-importe_letra_sin_iva" etiqueta="Importe sin IVA en letra" ayuda="Solo se usa en el Anexo I" className="sm:col-span-2"><input {...texto('importe_letra_sin_iva')} /></Campo>
            <Campo id="f-fecha_firma" etiqueta="Fecha de firma" ayuda="Solo se usa en el Informe de justificación"><input {...texto('fecha_firma')} type="date" /></Campo>
          </Seccion>

          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {id === null ? (
              <button className="btn-primario" onClick={crearNuevo}>Crear patrocinio</button>
            ) : (
              <>
                <button className="btn-sec" onClick={duplicar}>Duplicar</button>
                <button className="btn-peligro ml-auto" onClick={() => setConfirmarBorrar(true)}>Eliminar</button>
              </>
            )}
          </div>
        </div>

        <div className="lg:sticky lg:top-6">
          <PanelDocumentos
            registro={registroParaDocs}
            listoParaGenerar={id !== null && 'datos' in parsed}
            antesDeGenerar={guardarAhora}
          />
          {id !== null && <p className="mt-3 px-1 text-[0.82rem] text-tinta/55">Los cambios se guardan solos en la carpeta de datos.</p>}
        </div>
      </div>

      {confirmarBorrar && (
        <Dialogo titulo="¿Eliminar este patrocinio?" onCerrar={() => setConfirmarBorrar(false)}
          acciones={<>
            <button className="btn-sec" onClick={() => setConfirmarBorrar(false)}>Cancelar</button>
            <button className="btn-peligro" onClick={borrar}>Eliminar</button>
          </>}>
          <p>Se eliminará el patrocinio de <strong>{guardado?.entidad}</strong>{guardado?.evento ? ` («${guardado.evento}»)` : ''}.</p>
          <p>Antes se guarda una copia de seguridad, por si hay que recuperarlo. Los documentos ya generados no se borran.</p>
        </Dialogo>
      )}
    </main>
  )
}
