import { useState } from 'react'
import { clientId, clientIdDeConfiguracion, guardarClientId, type CandidatoDrive } from '../lib/drive'
import { fechaHoraES } from '../lib/format'
import { soportado } from '../lib/fs'
import { useStore } from '../lib/store'

function Marca() {
  return (
    <div className="flex items-center gap-3">
      <svg width="40" height="40" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="#33378f" /><path d="M8 22V10l8 8 8-8v12" fill="none" stroke="white" strokeWidth="3" strokeLinejoin="round" /></svg>
      <div>
        <div className="text-xl font-semibold leading-tight">GESTCON</div>
        <div className="text-sm text-tinta/70">Gestión de patrocinios deportivos</div>
      </div>
    </div>
  )
}

function IconoDrive() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 3h8l6 10.5h-8z" fill="#fbbc04" /><path d="M2 13.5 8 3l4 7-6 10.5z" fill="#34a853" /><path d="M6 20.5h12l4-7H10z" fill="#4285f4" />
    </svg>
  )
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
        <p className="text-sm text-tinta/80">
          Para conectar con Google Drive, pega aquí el <strong>ID de cliente</strong> de Google
          (termina en <code>.apps.googleusercontent.com</code>). Se configura una sola vez; las instrucciones están en el README.
        </p>
        <label className="block text-sm">
          <span className="text-tinta/70">ID de cliente de Google</span>
          <input className="campo mt-1 w-full" value={id} onChange={(e) => setId(e.target.value)}
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
      <label className="block text-sm">
        <span className="text-tinta/70">Nombre de la carpeta en tu Google Drive</span>
        <input className="campo mt-1 w-full" value={nombre} onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && nombre.trim() && !buscando && buscar()} />
      </label>
      {error && <p role="alert" className="rounded-md border border-error/30 bg-error/5 p-3 text-sm text-error">{error}</p>}
      <button className="btn-primario inline-flex items-center gap-2" disabled={!nombre.trim() || buscando} onClick={buscar}>
        <IconoDrive /> {buscando ? 'Conectando…' : 'Conectar con Google Drive'}
      </button>

      {candidatos && candidatos.length === 0 && (
        <p className="text-sm text-aviso">
          No hay ninguna carpeta llamada «{nombre.trim()}» en tu Google Drive. Comprueba el nombre o súbela primero a Drive.
        </p>
      )}
      {candidatos && candidatos.length > 1 && (
        <div className="space-y-2">
          <p className="text-sm">Hay varias carpetas con ese nombre. Elige cuál usar:</p>
          <ul className="divide-y divide-linea rounded-md border border-linea">
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
        <button className="text-xs text-tinta/60 underline" onClick={() => setEditandoId(true)}>Cambiar el ID de cliente de Google</button>
      )}
    </div>
  )
}

export function PantallaConexion() {
  const { fase, error, carpetaGuardada, continuar, elegirOtra, crearBDVacia, nombreCarpeta, dirRaiz } = useStore()
  const local = soportado()

  return (
    <main className="flex min-h-full items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-xl border border-linea bg-white p-8 shadow-sm">
        <Marca />

        {fase === 'cargando' ? (
          <p className="mt-8 text-sm text-tinta/80" role="status">Abriendo los datos y creando la copia de seguridad…</p>
        ) : fase === 'sin-bd' ? (
          <div className="mt-8 space-y-4">
            <p className="text-sm">
              En la carpeta <strong>{nombreCarpeta}</strong>{dirRaiz?.tipo === 'drive' ? ' de Google Drive' : ''} no hay ningún archivo <code>datos.sqlite</code>.
            </p>
            <p className="text-sm text-tinta/70">
              Si ya tienes el archivo, cópialo a esa carpeta y pulsa «Volver a comprobar». Si empiezas desde cero, crea una base de datos vacía.
            </p>
            <div className="flex flex-wrap gap-2">
              <button className="btn-primario" onClick={crearBDVacia}>Crear base de datos vacía</button>
              <button className="btn-sec" onClick={continuar}>Volver a comprobar</button>
            </div>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            {error && (
              <p role="alert" className="rounded-md border border-error/30 bg-error/5 p-3 text-sm text-error">{error}</p>
            )}

            {carpetaGuardada && (carpetaGuardada.tipo === 'drive' || local) && (
              <div className="space-y-2">
                <button className="btn-primario inline-flex items-center gap-2" onClick={continuar}>
                  {carpetaGuardada.tipo === 'drive' && <IconoDrive />}
                  Continuar con «{carpetaGuardada.nombre}»
                </button>
                <p className="text-xs text-tinta/60">
                  {carpetaGuardada.tipo === 'drive'
                    ? 'Carpeta de Google Drive. Google te pedirá confirmar tu cuenta.'
                    : 'Carpeta del ordenador. El navegador te pedirá permiso para usarla.'}
                </p>
              </div>
            )}

            <section className="space-y-3 rounded-lg border border-linea p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold"><IconoDrive /> Google Drive</h2>
              <BloqueDrive />
            </section>

            <section className="space-y-3 rounded-lg border border-linea p-4">
              <h2 className="text-sm font-semibold">Carpeta del ordenador o de red</h2>
              {local ? (
                <>
                  <p className="text-sm text-tinta/70">
                    Elige la carpeta donde están <code>datos.sqlite</code> y <code>plantillas</code>.
                  </p>
                  <button className="btn-sec" onClick={elegirOtra}>Elegir carpeta</button>
                </>
              ) : (
                <p className="text-sm text-tinta/70">Solo disponible con Google Chrome o Microsoft Edge en un ordenador.</p>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  )
}
