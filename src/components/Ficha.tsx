import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { aBorrador, borradorVacio, deBorrador, type Borrador } from '../lib/borrador'
import { eur, importeSinIva } from '../lib/format'
import { parseImporte } from '../lib/format'
import { useStore } from '../lib/store'
import type { Patrocinio } from '../types'
import { PanelDocumentos } from './PanelDocumentos'
import { Dialogo, useAviso } from './ui'

function Campo({ id, etiqueta, ayuda, aviso, children, className = '' }: { id: string; etiqueta: string; ayuda?: string; aviso?: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="etiqueta">{etiqueta}</label>
      {children}
      {aviso ? <p className="mt-1 text-xs text-aviso">{aviso}</p> : ayuda ? <p className="mt-1 text-xs text-tinta/55">{ayuda}</p> : null}
    </div>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-linea bg-white p-5" aria-label={titulo}>
      <h2 className="mb-4 text-base font-semibold">{titulo}</h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
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
      <main className="mx-auto max-w-3xl px-5 py-10">
        <p className="rounded-md border border-linea bg-white p-5 text-sm">
          No existe el patrocinio solicitado. <a className="font-medium text-indigo underline" href="#/">Volver al listado</a>
        </p>
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

  return (
    <main className="mx-auto max-w-7xl px-5 py-6">
      <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm" aria-label="Navegación de la ficha">
        <a href="#/" className="text-indigo hover:underline">← Listado</a>
        {guardado && (
          <span className="ml-auto flex items-center gap-1">
            <a className={`btn-sec !px-2.5 !py-1.5 ${anterior ? '' : 'pointer-events-none opacity-40'}`} href={anterior ? `#/registro/${anterior.id}` : undefined} aria-label="Patrocinio anterior" aria-disabled={!anterior}>‹ Anterior</a>
            <a className={`btn-sec !px-2.5 !py-1.5 ${siguiente ? '' : 'pointer-events-none opacity-40'}`} href={siguiente ? `#/registro/${siguiente.id}` : undefined} aria-label="Patrocinio siguiente" aria-disabled={!siguiente}>Siguiente ›</a>
          </span>
        )}
      </nav>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{id === null ? 'Nuevo patrocinio' : b.entidad || '(sin entidad)'}</h1>
          {id !== null && <p className="mt-0.5 text-sm text-tinta/70">{b.evento}</p>}
        </div>
        <label className="flex cursor-pointer items-center gap-2.5 rounded-md border border-linea bg-white px-3.5 py-2 text-sm font-medium">
          <input type="checkbox" className="h-4 w-4 accent-indigo" checked={b.tramitado} onChange={(e) => set('tramitado', e.target.checked)} />
          Marcar si se ha tramitado
        </label>
      </div>

      {errorGuardar && (
        <p role="alert" className="mb-4 rounded-md border border-error/30 bg-white px-4 py-3 text-sm text-error">{errorGuardar}</p>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <Seccion titulo="Datos de la entidad">
            <Campo id="f-entidad" etiqueta="Entidad" className="sm:col-span-2"><input {...texto('entidad')} autoFocus={id === null} /></Campo>
            <Campo id="f-cif" etiqueta="CIF"><input {...texto('cif')} /></Campo>
            <Campo id="f-representante_legal" etiqueta="Representante legal"><input {...texto('representante_legal')} /></Campo>
            <Campo id="f-dni_nie_representante" etiqueta="DNI/NIE del representante"><input {...texto('dni_nie_representante')} /></Campo>
            <Campo id="f-telefono" etiqueta="Teléfono"><input {...texto('telefono')} inputMode="tel" /></Campo>
            <Campo id="f-email" etiqueta="Email" className="sm:col-span-2"><input {...texto('email')} type="email" /></Campo>
          </Seccion>

          <Seccion titulo="Datos del evento">
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

          <Seccion titulo="Datos económicos">
            <Campo id="f-num_contrato" etiqueta="Nº de contrato" aviso={contratoRepetido ? 'Ya existe otro patrocinio con este número de contrato.' : undefined}>
              <input {...texto('num_contrato')} inputMode="numeric" />
            </Campo>
            <Campo id="f-aplicacion" etiqueta="Aplicación presupuestaria" aviso={avisoAplicacion}>
              <input {...texto('aplicacion')} placeholder="2026/1301/3411/22608" />
            </Campo>
            <Campo id="f-importe_total" etiqueta="Importe total (IVA incluido)" ayuda={sinIva !== null && total ? `Sin IVA (${ivaPct} %): ${eur(sinIva)} · IVA: ${eur(Math.round(((total ?? 0) - sinIva) * 100) / 100)}` : undefined}>
              <input {...texto('importe_total')} inputMode="decimal" placeholder="0,00" />
            </Campo>
            <Campo id="f-importe_reding" etiqueta="Importe REDING"><input {...texto('importe_reding')} inputMode="decimal" placeholder="0,00" /></Campo>
            <Campo id="f-importe_letra" etiqueta="Importe total en letra" className="sm:col-span-2"><input {...texto('importe_letra')} placeholder="Dos mil cuatrocientos veinte euros" /></Campo>
            <Campo id="f-importe_letra_sin_iva" etiqueta="Importe sin IVA en letra" ayuda="Solo se usa en el Anexo I" className="sm:col-span-2"><input {...texto('importe_letra_sin_iva')} /></Campo>
            <Campo id="f-fecha_firma" etiqueta="Fecha de firma" ayuda="Solo se usa en el Informe de justificación"><input {...texto('fecha_firma')} type="date" /></Campo>
          </Seccion>

          <div className="flex flex-wrap items-center gap-2 pb-8">
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

        <div className="lg:sticky lg:top-4">
          <PanelDocumentos
            registro={registroParaDocs}
            listoParaGenerar={id !== null && 'datos' in parsed}
            antesDeGenerar={guardarAhora}
          />
          {id !== null && <p className="mt-3 text-xs text-tinta/55">Los cambios se guardan solos en la carpeta de datos.</p>}
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
