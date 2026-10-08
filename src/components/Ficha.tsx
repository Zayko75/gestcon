import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { aBorrador, borradorVacio, deBorrador, letrasDe, type Borrador } from '../lib/borrador'
import { eur, importeSinIva, parseImporte } from '../lib/format'
import { MUNICIPIOS } from '../lib/municipios'
import { useStore } from '../lib/store'
import { claveCif, emailValido, soportesEnumerados, textoDeFechas, variasLineas } from '../lib/textos'
import type { Entidad, Estado, Patrocinio } from '../types'
import { PanelDocumentos } from './PanelDocumentos'
import { Dialogo, Dorsal, ESTADOS, useAviso } from './ui'

function Campo({ id, etiqueta, ayuda, aviso, accion, children, className = '' }: { id: string; etiqueta: string; ayuda?: ReactNode; aviso?: ReactNode; accion?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="etiqueta">{etiqueta}</label>
        {accion}
      </div>
      {children}
      {aviso ? <p className="mt-1.5 text-[0.82rem] font-medium text-aviso">{aviso}</p> : ayuda ? <p className="mt-1.5 text-[0.82rem] leading-snug text-tinta/55">{ayuda}</p> : null}
    </div>
  )
}

/** Botón pequeño junto a la etiqueta de un campo */
const Accion = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
  <button type="button" onClick={onClick} className="mb-1.5 rounded text-[0.8rem] font-semibold text-indigo hover:underline">{children}</button>
)

/** Aplicación presupuestaria propuesta para un año: la más usada ese año o la última con el año cambiado */
function aplicacionPara(anio: number, registros: Patrocinio[]): string {
  const delAnio = registros.filter((r) => r.anualidad === anio && /^\d{4}\//.test(r.aplicacion))
  if (delAnio.length) {
    const cuenta = new Map<string, number>()
    for (const r of delAnio) cuenta.set(r.aplicacion, (cuenta.get(r.aplicacion) ?? 0) + 1)
    return [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0][0]
  }
  const ultima = [...registros].reverse().find((r) => /^\d{4}\//.test(r.aplicacion))
  return ultima ? `${anio}${ultima.aplicacion.slice(4)}` : ''
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
  const { registros, entidades, crear, actualizar, eliminar, copiaAhora, ivaPct } = useStore()
  const aviso = useAviso()
  const guardado = id !== null ? registros.find((r) => r.id === id) : undefined

  const [b, setB] = useState<Borrador>(() => (guardado ? aBorrador(guardado) : borradorVacio(ivaPct)))
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

  /** Rellena los datos de la entidad (solo en patrocinios nuevos) */
  const usarEntidad = (e: Entidad) => setB((x) => ({
    ...x, entidad: e.nombre, cif: e.cif, representante_legal: e.representante_legal,
    dni_nie_representante: e.dni_nie_representante, telefono: e.telefono, email: e.email,
  }))
  const cambiarEntidad = (v: string) => {
    set('entidad', v)
    const e = id === null ? entidades.find((x) => x.nombre === v) : undefined
    if (e) usarEntidad(e)
  }
  const entidadDelCif = id === null && b.cif.trim() ? entidades.find((e) => e.clave_cif === claveCif(b.cif)) : undefined
  const sugerirEntidad = entidadDelCif && (entidadDelCif.representante_legal !== b.representante_legal || entidadDelCif.email !== b.email)

  const cambiarAnualidad = (v: string) => {
    setB((x) => {
      const n = Number(v)
      const prop = Number.isInteger(n) && n >= 2000 && n <= 2100 ? aplicacionPara(n, registros) : ''
      // Propone la aplicación si está vacía o era la propuesta del año anterior
      const anterior = Number(x.anualidad)
      const eraPropuesta = x.aplicacion === '' || (Number.isInteger(anterior) && x.aplicacion === aplicacionPara(anterior, registros))
      return { ...x, anualidad: v, aplicacion: prop && eraPropuesta ? prop : x.aplicacion }
    })
  }

  const cambiarFecha = (k: 'fecha_inicio' | 'fecha_fin', v: string) => {
    setB((x) => {
      const nuevo = { ...x, [k]: v }
      if (k === 'fecha_inicio' && v && (!x.fecha_fin || x.fecha_fin < v)) nuevo.fecha_fin = v
      // Si el texto estaba vacío o era el propuesto con las fechas anteriores, se actualiza
      const propuestoAntes = textoDeFechas(x.fecha_inicio, x.fecha_fin)
      if (!x.fecha_celebracion.trim() || x.fecha_celebracion === propuestoAntes) nuevo.fecha_celebracion = textoDeFechas(nuevo.fecha_inicio, nuevo.fecha_fin)
      return nuevo
    })
  }

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

  // Guardado automático: 2 s después de dejar de escribir, o al salir del campo
  useEffect(() => {
    if (id === null) return
    if (JSON.stringify(b) === ultimo.current) return
    const r = deBorrador(b)
    if ('error' in r) { setErrorGuardar(r.error); return }
    setErrorGuardar('')
    window.clearTimeout(temporizador.current)
    temporizador.current = window.setTimeout(() => { void guardarAhora() }, 2000)
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
    const copia = { ...parsed.datos, estado: 'preparacion' as Estado, num_contrato: null, fecha_firma: null }
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
  const anioNum = b.anualidad.trim() === '' ? null : Number(b.anualidad)
  // El nº de contrato se reinicia cada año: solo se avisa si se repite dentro de la misma anualidad
  const contratoRepetido = num !== null && registros.some((r) => r.id !== id && r.num_contrato === num && r.anualidad === anioNum)
  const avisoAplicacion = !b.aplicacion ? undefined
    : !/^\d{4}\/\d{4}\/\d{4}\/\d{5}$/.test(b.aplicacion) ? 'Formato habitual: 0000/0000/0000/00000'
      : anioNum !== null && b.aplicacion.slice(0, 4) !== String(anioNum) ? `La aplicación es de ${b.aplicacion.slice(0, 4)} y la anualidad, ${anioNum}.` : undefined
  const total = parseImporte(b.importe_total)
  const ivaB = parseImporte(b.iva_pct) ?? ivaPct
  const sinIva = total !== null ? importeSinIva(total, ivaB) : null
  const letras = letrasDe(b)
  const enumeradosPropuestos = soportesEnumerados(variasLineas(b.soportes_cedidos), variasLineas(b.soportes_propios))
  const textoFechas = textoDeFechas(b.fecha_inicio, b.fecha_fin)

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
        <div className="w-full sm:w-auto">
          <span id="t-estado" className="etiqueta">Estado del expediente</span>
          <div className="segmento flex-wrap" role="group" aria-labelledby="t-estado">
            {ESTADOS.map((e) => (
              <button key={e.valor} type="button" aria-pressed={b.estado === e.valor} onClick={() => set('estado', e.valor)}>{e.texto}</button>
            ))}
          </div>
        </div>
      </div>

      {errorGuardar && (
        <p role="alert" className="mb-5 rounded-xl border border-error/30 bg-error/[.06] px-4 py-3 text-[0.92rem] font-medium text-error">{errorGuardar}</p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div>
          <div className="overflow-hidden rounded-xl border border-linea bg-white" onBlurCapture={() => { if (id !== null) void guardarAhora() }}>
          <Seccion titulo="Entidad" descripcion="Quién recibe el patrocinio y cómo contactar.">
            <Campo id="f-entidad" etiqueta="Entidad" className="sm:col-span-2"
              ayuda={id === null ? 'Si la entidad ya ha tenido patrocinios, elígela de la lista y se rellenarán sus datos.' : undefined}>
              <input {...texto('entidad')} onChange={(e) => cambiarEntidad(e.target.value)} list="lista-entidades" autoComplete="off" autoFocus={id === null} />
              <datalist id="lista-entidades">
                {entidades.map((e) => <option key={e.id} value={e.nombre}>{e.cif}</option>)}
              </datalist>
            </Campo>
            <Campo id="f-cif" etiqueta="CIF"
              aviso={sugerirEntidad ? <>Este CIF es de <strong>{entidadDelCif!.nombre}</strong>. <button type="button" className="underline" onClick={() => usarEntidad(entidadDelCif!)}>Usar sus datos</button></> : undefined}>
              <input {...texto('cif')} />
            </Campo>
            <Campo id="f-representante_legal" etiqueta="Representante legal"><input {...texto('representante_legal')} /></Campo>
            <Campo id="f-dni_nie_representante" etiqueta="DNI/NIE del representante"><input {...texto('dni_nie_representante')} /></Campo>
            <Campo id="f-telefono" etiqueta="Teléfono"><input {...texto('telefono')} inputMode="tel" /></Campo>
            <Campo id="f-email" etiqueta="Email" className="sm:col-span-2"
              aviso={!emailValido(b.email) ? 'El email no parece válido.' : undefined}
              ayuda="Si hay varios, sepáralos con punto y coma.">
              <input {...texto('email')} type="text" inputMode="email" />
            </Campo>
          </Seccion>

          <Seccion titulo="Evento" descripcion="Qué se patrocina, cuándo, dónde y con qué soportes.">
            <Campo id="f-anualidad" etiqueta="Anualidad"><input {...texto('anualidad')} onChange={(e) => cambiarAnualidad(e.target.value)} inputMode="numeric" /></Campo>
            <Campo id="f-plazo_ejecucion" etiqueta="Plazo de ejecución"><input {...texto('plazo_ejecucion')} type="date" /></Campo>
            <Campo id="f-evento" etiqueta="Evento" className="sm:col-span-2"><textarea {...texto('evento')} rows={2} /></Campo>
            <Campo id="f-fecha_inicio" etiqueta="Primer día del evento">
              <input {...texto('fecha_inicio')} onChange={(e) => cambiarFecha('fecha_inicio', e.target.value)} type="date" />
            </Campo>
            <Campo id="f-fecha_fin" etiqueta="Último día del evento">
              <input {...texto('fecha_fin')} onChange={(e) => cambiarFecha('fecha_fin', e.target.value)} type="date" min={b.fecha_inicio || undefined} />
            </Campo>
            <Campo id="f-fecha_celebracion" etiqueta="Fecha de celebración (texto de los documentos)" className="sm:col-span-2"
              accion={textoFechas && textoFechas !== b.fecha_celebracion ? <Accion onClick={() => set('fecha_celebracion', textoFechas)}>Escribir a partir de las fechas</Accion> : undefined}
              ayuda="Tal como saldrá en los documentos. Para días sueltos escríbelo a mano, por ejemplo: el 4, 11, 18 y 25 de julio de 2026">
              <input {...texto('fecha_celebracion')} />
            </Campo>
            <Campo id="f-municipios" etiqueta="Municipios" className="sm:col-span-2" ayuda="Elige de la lista o escribe varios separados por comas.">
              <input {...texto('municipios')} list="lista-municipios" autoComplete="off" />
              <datalist id="lista-municipios">
                {MUNICIPIOS.map((m) => <option key={m} value={m} />)}
              </datalist>
            </Campo>
            <Campo id="f-soportes_cedidos" etiqueta="Soportes cedidos por la Diputación" ayuda="Uno por línea">
              <textarea {...texto('soportes_cedidos')} rows={5} />
            </Campo>
            <Campo id="f-soportes_propios" etiqueta="Soportes propios de la entidad" ayuda="Uno por línea">
              <textarea {...texto('soportes_propios')} rows={5} />
            </Campo>
            <Campo id="f-soportes_enumerados" etiqueta="Soportes enumerados" className="sm:col-span-2"
              accion={enumeradosPropuestos && enumeradosPropuestos !== b.soportes_enumerados ? <Accion onClick={() => set('soportes_enumerados', enumeradosPropuestos)}>Rellenar a partir de las listas</Accion> : undefined}
              ayuda="Las dos listas en una frase (Informes económico y de justificación). Si lo dejas vacío, se rellena solo.">
              <textarea {...texto('soportes_enumerados')} rows={3} />
            </Campo>
          </Seccion>

          <Seccion titulo="Contrato e importes" descripcion="Datos del expediente para anexos y contrato.">
            <Campo id="f-num_contrato" etiqueta="Nº de contrato" ayuda="Se reinicia cada año."
              aviso={contratoRepetido ? `Ya hay otro patrocinio de ${anioNum} con este número de contrato.` : undefined}>
              <input {...texto('num_contrato')} inputMode="numeric" />
            </Campo>
            <Campo id="f-aplicacion" etiqueta="Aplicación presupuestaria" aviso={avisoAplicacion}
              accion={anioNum && b.aplicacion && b.aplicacion.slice(0, 4) !== String(anioNum) && aplicacionPara(anioNum, registros) ? <Accion onClick={() => set('aplicacion', aplicacionPara(anioNum, registros))}>Usar la de {anioNum}</Accion> : undefined}>
              <input {...texto('aplicacion')} placeholder="2026/1301/3411/22608" />
            </Campo>
            <Campo id="f-importe_total" etiqueta="Importe total (IVA incluido)" ayuda={sinIva !== null && total ? `Sin IVA: ${eur(sinIva)}. IVA: ${eur(Math.round(((total ?? 0) - sinIva) * 100) / 100)}.` : undefined}>
              <input {...texto('importe_total')} inputMode="decimal" placeholder="0,00" />
            </Campo>
            <Campo id="f-iva_pct" etiqueta="Tipo de IVA (%)" ayuda="Se guarda en cada patrocinio, para que un cambio futuro del IVA no altere los expedientes ya firmados.">
              <input {...texto('iva_pct')} inputMode="decimal" />
            </Campo>
            <div className="rounded-lg bg-papel px-4 py-3 sm:col-span-2" aria-live="polite">
              <div className="text-[0.84rem] font-medium text-tinta/70">Importe en letra (se escribe solo)</div>
              <p className="mt-1">{total ? letras.total : <span className="text-tinta/45">Escribe el importe total.</span>}</p>
              {total ? <p className="mt-1 text-[0.9rem] text-tinta/70">Sin IVA: {letras.sinIva}</p> : null}
            </div>
            <Campo id="f-importe_reding" etiqueta="Importe REDING"><input {...texto('importe_reding')} inputMode="decimal" placeholder="0,00" /></Campo>
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
