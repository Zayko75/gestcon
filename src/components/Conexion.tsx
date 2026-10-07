import { useState } from 'react'
import { clientId, clientIdDeConfiguracion, guardarClientId, type CandidatoDrive } from '../lib/drive'
import { fechaHoraES } from '../lib/format'
import { soportado } from '../lib/fs'
import { useStore } from '../lib/store'
import { Marca } from './Cabecera'

function IconoDrive({ blanco = false }: { blanco?: boolean }) {
  const svg = (
    <svg width={blanco ? 14 : 20} height={blanco ? 14 : 20} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 3h8l6 10.5h-8z" fill="#fbbc04" /><path d="M2 13.5 8 3l4 7-6 10.5z" fill="#34a853" /><path d="M6 20.5h12l4-7H10z" fill="#4285f4" />
    </svg>
  )
  return blanco ? <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white">{svg}</span> : svg
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e))

function BloqueDrive() {
  const { buscarEnDrive, abrirEnDrive } = useStore()
  const [id, setId] = useState(clientId())
  const [editandoId, setEditandoId] = useState(!clientId())
  const [nombre, setNombre] = useState('Patrocinios')
  const [buscando, setBuscando] = useState(false)
  const [error, setError] = useState('')
  const [candidatos, setCandidatos] = useState<CandidatoDrive[] | null>(null)

  if (editandoId) {
    return (
      <div className="space-y-3">
        <p className="text-[0.92rem] leading-relaxed text-tinta/75">
          Para conectar con Google Drive, pega aquí el <strong>ID de cliente</strong> de Google
          (termina en <code>.apps.googleusercontent.com</code>). Se configura una sola vez; las instrucciones están en el README.
        </p>
        <label className="block">
          <span className="etiqueta">ID de cliente de Google</span>
          <input className="campo" value={id} onChange={(e) => setId(e.target.value)}
            placeholder="123456789-abc.apps.googleusercontent.com" />
        </label>
        <div className="flex gap-2">
          <button className="btn-primario" disabled={!/\.apps\.googleusercontent\.com$/.test(id.trim())}
            onClick={() => { guardarClientId(id); setEditandoId(false) }}>Guardar</button>
          {clientId() && <button className="btn-sec" onClick={() => { setId(clientId()); setEditandoId(false) }}>Cancelar</button>}
        </div>
      </div>
    )
  }

  const buscar = async () => {
    setBuscando(true)
    setError('')
    setCandidatos(null)
    try {
      const r = await buscarEnDrive(nombre)
      const conDatos = r.filter((c) => c.tieneDatos)
      if (r.length === 1) await abrirEnDrive(r[0])
      else if (conDatos.length === 1) await abrirEnDrive(conDatos[0])
      else setCandidatos(r)
    } catch (e) {
      setError(msg(e))
    } finally {
      setBuscando(false)
    }
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="etiqueta">Nombre de la carpeta en tu Google Drive</span>
        <input className="campo" value={nombre} onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && nombre.trim() && !buscando && buscar()} />
      </label>
      {error && <p role="alert" className="rounded-lg border border-error/30 bg-error/[.06] px-3 py-2.5 text-[0.9rem] text-error">{error}</p>}
      <button className="btn-primario w-full sm:w-auto" disabled={!nombre.trim() || buscando} onClick={buscar}>
        <IconoDrive blanco /> {buscando ? 'Conectando…' : 'Conectar con Google Drive'}
      </button>

      {candidatos && candidatos.length === 0 && (
        <p className="text-[0.9rem] text-aviso">
          No hay ninguna carpeta llamada «{nombre.trim()}» en tu Google Drive. Comprueba el nombre o súbela primero a Drive.
        </p>
      )}
      {candidatos && candidatos.length > 1 && (
        <div className="space-y-2">
          <p className="text-[0.92rem]">Hay varias carpetas con ese nombre. Elige cuál usar:</p>
          <ul className="divide-y divide-linea overflow-hidden rounded-lg border border-linea">
            {candidatos.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <div>
                  <div className="font-medium">{c.nombre}</div>
                  <div className="text-xs text-tinta/60">
                    Modificada el {fechaHoraES(c.modificado)} · {c.tieneDatos ? 'contiene datos.sqlite' : 'sin datos.sqlite'}
                  </div>
                </div>
                <button className="btn-sec !px-2.5 !py-1.5" onClick={() => abrirEnDrive(c).catch((e) => setError(msg(e)))}>Usar esta</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!clientIdDeConfiguracion() && (
        <button className="text-[0.82rem] text-tinta/55 underline underline-offset-4 hover:text-tinta" onClick={() => setEditandoId(true)}>Cambiar el ID de cliente de Google</button>
      )}
    </div>
  )
}

export function PantallaConexion() {
  const { fase, error, carpetaGuardada, continuar, elegirOtra, crearBDVacia, nombreCarpeta, dirRaiz } = useStore()
  const local = soportado()

  return (
    <main className="min-h-full lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="relative flex flex-col justify-between gap-10 overflow-hidden bg-noche px-6 py-8 text-white sm:px-10 lg:min-h-full lg:px-12 lg:py-12">
        <Marca claro />
        <div className="relative max-lg:hidden">
          <p className="max-w-md font-display text-[2.9rem] font-semibold leading-[1.02] tracking-[-0.01em]">
            Cada patrocinio, con su expediente completo.
          </p>
          <p className="mt-5 max-w-sm leading-relaxed text-white/65">
            Datos de la entidad y del evento, anexos, contrato e informes listos para firmar. Los datos se guardan en tu carpeta, no en ningún servidor.
          </p>
        </div>
        <p className="relative text-[0.82rem] text-white/45 max-lg:hidden">Servicio de Deportes, Diputación de Málaga</p>
      </aside>

      <div className="flex justify-center px-5 py-10 sm:px-10 lg:items-center lg:py-16">
        <div className="w-full max-w-lg">
          {fase === 'cargando' ? (
            <div role="status">
              <h1 className="titulo">Abriendo los datos…</h1>
              <p className="mt-3 text-tinta/65">Se está leyendo <code>datos.sqlite</code> y creando la copia de seguridad del día.</p>
            </div>
          ) : fase === 'sin-bd' ? (
            <div className="space-y-5">
              <h1 className="titulo">No hay base de datos</h1>
              <p className="leading-relaxed text-tinta/75">
                En la carpeta <strong>{nombreCarpeta}</strong>{dirRaiz?.tipo === 'drive' ? ' de Google Drive' : ''} no hay ningún archivo <code>datos.sqlite</code>.
                Si ya lo tienes, cópialo ahí y pulsa «Volver a comprobar». Si empiezas desde cero, crea una base de datos vacía.
              </p>
              <div className="flex flex-wrap gap-2">
                <button className="btn-primario" onClick={crearBDVacia}>Crear base de datos vacía</button>
                <button className="btn-sec" onClick={continuar}>Volver a comprobar</button>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <div>
                <h1 className="titulo">Abre tus datos</h1>
                <p className="mt-2 leading-relaxed text-tinta/65">Elige dónde está la carpeta con <code className="text-[0.9em]">datos.sqlite</code> y las plantillas.</p>
              </div>

              {error && (
                <p role="alert" className="rounded-lg border border-error/30 bg-error/[.06] px-4 py-3 text-[0.92rem] text-error">{error}</p>
              )}

              {carpetaGuardada && (carpetaGuardada.tipo === 'drive' || local) && (
                <div className="rounded-xl border border-indigo/25 bg-white p-5">
                  <p className="text-[0.88rem] text-tinta/60">Última carpeta usada</p>
                  <button className="btn-primario mt-3 w-full !py-3 text-base" onClick={continuar}>
                    {carpetaGuardada.tipo === 'drive' && <IconoDrive blanco />}
                    Continuar con «{carpetaGuardada.nombre}»
                  </button>
                  <p className="mt-3 text-[0.82rem] text-tinta/55">
                    {carpetaGuardada.tipo === 'drive'
                      ? 'Carpeta de Google Drive. Google te pedirá confirmar tu cuenta.'
                      : 'Carpeta del ordenador. El navegador te pedirá permiso para usarla.'}
                  </p>
                </div>
              )}

              <section className="space-y-4">
                <h2 className="flex items-center gap-2.5 font-display text-[1.4rem] font-semibold"><IconoDrive /> Google Drive</h2>
                <BloqueDrive />
              </section>

              <div className="flex items-center gap-4 text-[0.85rem] text-tinta/45" aria-hidden="true">
                <span className="h-px flex-1 bg-linea" />o bien<span className="h-px flex-1 bg-linea" />
              </div>

              <section className="space-y-3">
                <h2 className="font-display text-[1.4rem] font-semibold">Carpeta del ordenador o de red</h2>
                {local ? (
                  <>
                    <p className="text-[0.92rem] text-tinta/65">Para trabajar con una carpeta de este ordenador o de una unidad de red.</p>
                    <button className="btn-sec" onClick={elegirOtra}>Elegir carpeta</button>
                  </>
                ) : (
                  <p className="text-[0.92rem] text-tinta/65">Solo disponible con Google Chrome o Microsoft Edge en un ordenador.</p>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
