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

export function PantallaConexion() {
  const { fase, error, carpetaGuardada, continuar, elegirOtra, crearBDVacia, nombreCarpeta } = useStore()

  return (
    <main className="flex min-h-full items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-xl border border-linea bg-white p-8 shadow-sm">
        <Marca />

        {!soportado() ? (
          <div className="mt-8 rounded-md border border-error/30 bg-error/5 p-4 text-sm">
            <p className="font-medium text-error">Este navegador no puede abrir la carpeta de datos.</p>
            <p className="mt-1">Abre la aplicación con Google Chrome o Microsoft Edge en un ordenador.</p>
          </div>
        ) : fase === 'cargando' ? (
          <p className="mt-8 text-sm text-tinta/80" role="status">Abriendo los datos y creando la copia de seguridad…</p>
        ) : fase === 'sin-bd' ? (
          <div className="mt-8 space-y-4">
            <p className="text-sm">
              En la carpeta <strong>{nombreCarpeta}</strong> no hay ningún archivo <code>datos.sqlite</code>.
            </p>
            <p className="text-sm text-tinta/70">
              Si ya tienes el archivo, cópialo a esa carpeta y vuelve a abrirla. Si empiezas desde cero, crea una base de datos vacía.
            </p>
            <div className="flex flex-wrap gap-2">
              <button className="btn-primario" onClick={crearBDVacia}>Crear base de datos vacía</button>
              <button className="btn-sec" onClick={continuar}>Volver a comprobar</button>
              <button className="btn-sec" onClick={elegirOtra}>Elegir otra carpeta</button>
            </div>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            <p className="text-sm text-tinta/80">
              Elige la carpeta de red donde están <code>datos.sqlite</code>, <code>plantillas</code> y <code>documentos</code>.
              Los datos no salen de tu ordenador y esa carpeta.
            </p>
            {error && (
              <p role="alert" className="rounded-md border border-error/30 bg-error/5 p-3 text-sm text-error">{error}</p>
            )}
            <div className="flex flex-wrap gap-2">
              {carpetaGuardada && (
                <button className="btn-primario" onClick={continuar}>Continuar con «{carpetaGuardada}»</button>
              )}
              <button className={carpetaGuardada ? 'btn-sec' : 'btn-primario'} onClick={elegirOtra}>
                {carpetaGuardada ? 'Elegir otra carpeta' : 'Elegir carpeta de datos'}
              </button>
            </div>
            {carpetaGuardada && (
              <p className="text-xs text-tinta/60">El navegador te pedirá permiso para usar la carpeta cada vez que abras la aplicación.</p>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
