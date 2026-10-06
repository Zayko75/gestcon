import { horaCorta } from '../lib/format'
import { useStore } from '../lib/store'
import { useAviso } from './ui'

export function Cabecera({ ruta }: { ruta: string }) {
  const { nombreCarpeta, guardado, cambiarCarpeta, origen, sesionCaducada, reconectar } = useStore()
  const aviso = useAviso()
  const nav = (href: string, texto: string, activa: boolean) => (
    <a href={href} aria-current={activa ? 'page' : undefined}
      className={`rounded-md px-3 py-1.5 text-sm font-medium ${activa ? 'bg-white/15 text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}>
      {texto}
    </a>
  )
  return (
    <header className="no-imprimir bg-indigo-oscuro text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
        <a href="#/" className="flex items-center gap-2.5">
          <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="#fff" /><path d="M8 22V10l8 8 8-8v12" fill="none" stroke="#33378f" strokeWidth="3" strokeLinejoin="round" /></svg>
          <span className="text-base font-semibold tracking-wide">GESTCON</span>
        </a>
        <nav className="flex gap-1" aria-label="Secciones">
          {nav('#/', 'Patrocinios', !ruta.startsWith('/copias'))}
          {nav('#/copias', 'Copias de seguridad', ruta.startsWith('/copias'))}
        </nav>
        <div className="ml-auto flex items-center gap-4 text-sm">
          <span role="status" aria-live="polite"
            className={guardado.estado === 'error' ? 'font-medium text-red-200' : 'text-white/80'}>
            {guardado.estado === 'guardando' && 'Guardando…'}
            {guardado.estado === 'guardado' && (guardado.hora ? `Guardado a las ${horaCorta(guardado.hora)}` : 'Datos al día')}
            {guardado.estado === 'error' && (guardado.mensaje ?? 'Error al guardar')}
          </span>
          {sesionCaducada && (
            <button onClick={() => reconectar().catch((e) => aviso(e instanceof Error ? e.message : String(e), 'error'))}
              className="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-indigo-oscuro hover:bg-white/90">
              Reconectar con Google
            </button>
          )}
          <span className="hidden text-white/70 sm:inline" title="Carpeta de datos">
            {origen === 'drive' ? 'Google Drive' : 'Carpeta'}: {nombreCarpeta}
          </span>
          <button onClick={cambiarCarpeta} className="rounded-md border border-white/30 px-2.5 py-1 text-xs text-white/90 hover:bg-white/10">Cambiar carpeta</button>
        </div>
      </div>
    </header>
  )
}
