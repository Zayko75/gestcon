import type { ReactNode } from 'react'
import { horaCorta } from '../lib/format'
import { useStore } from '../lib/store'
import { useAviso } from './ui'

/** Marca de la aplicación: un dorsal con las iniciales */
export function Marca({ claro = false }: { claro?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <svg width="34" height="38" viewBox="0 0 34 38" aria-hidden="true" className="shrink-0">
        <rect x="1" y="1" width="32" height="36" rx="5" fill={claro ? '#fff' : '#2c3487'} />
        <rect x="1" y="1" width="32" height="8" rx="4" fill={claro ? '#c9cdf0' : '#161b45'} />
        <circle cx="7" cy="5" r="1.4" fill={claro ? '#2c3487' : '#fff'} /><circle cx="27" cy="5" r="1.4" fill={claro ? '#2c3487' : '#fff'} />
        <text x="17" y="30" textAnchor="middle" fontFamily="'Barlow Condensed', sans-serif" fontWeight="700" fontSize="16" letterSpacing="0.5" fill={claro ? '#161b45' : '#fff'}>GC</text>
      </svg>
      <span className="leading-none">
        <span className="block font-display text-[1.45rem] font-bold tracking-[0.02em]">GESTCON</span>
        <span className={`mt-1 block text-[0.78rem] ${claro ? 'text-white/60' : 'text-tinta/55'}`}>Patrocinios deportivos</span>
      </span>
    </span>
  )
}

const IconoLista = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
)
const IconoCopias = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></svg>
)

export function Cabecera({ ruta }: { ruta: string }) {
  const { nombreCarpeta, guardado, cambiarCarpeta, origen, sesionCaducada, reconectar } = useStore()
  const aviso = useAviso()

  const nav = (href: string, texto: ReactNode, icono: ReactNode, activa: boolean) => (
    <a href={href} aria-current={activa ? 'page' : undefined}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[0.92rem] font-medium transition-colors ${activa ? 'bg-white/[.12] text-white' : 'text-white/65 hover:bg-white/[.06] hover:text-white'}`}>
      {icono}{texto}
    </a>
  )

  const estado = (
    <span role="status" aria-live="polite" className="flex items-center gap-2">
      <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${guardado.estado === 'error' ? 'bg-[#ff8a80]' : guardado.estado === 'guardando' ? 'animate-pulse bg-[#ffc266]' : 'bg-[#6fd3a2]'}`} />
      <span className={guardado.estado === 'error' ? 'font-medium text-[#ffb3ab]' : 'text-white/80'}>
        {guardado.estado === 'guardando' && 'Guardando…'}
        {guardado.estado === 'guardado' && (guardado.hora ? `Guardado a las ${horaCorta(guardado.hora)}` : 'Datos al día')}
        {guardado.estado === 'error' && (guardado.mensaje ?? 'Error al guardar')}
      </span>
    </span>
  )

  return (
    <header className="no-imprimir sticky top-0 z-30 bg-noche text-white lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-64 lg:flex-col">
      <div className="flex items-center gap-x-5 gap-y-3 px-4 py-3 max-lg:flex-wrap lg:flex-col lg:items-stretch lg:px-5 lg:py-7">
        <a href="#/" className="rounded-md lg:mb-8"><Marca claro /></a>
        <nav className="flex gap-1 max-lg:order-3 max-lg:w-full lg:flex-col" aria-label="Secciones">
          {nav('#/', 'Patrocinios', <IconoLista />, !ruta.startsWith('/copias'))}
          {nav('#/copias', <><span className="lg:hidden">Copias</span><span className="max-lg:hidden">Copias de seguridad</span></>, <IconoCopias />, ruta.startsWith('/copias'))}
          <button onClick={cambiarCarpeta} className="ml-auto self-center whitespace-nowrap rounded-md px-2 py-1 text-[0.82rem] text-white/65 underline decoration-white/30 underline-offset-4 lg:hidden">Cambiar carpeta</button>
        </nav>
        <div className="ml-auto text-[0.82rem] lg:hidden">{estado}</div>
      </div>

      <div className="mt-auto hidden space-y-4 border-t border-white/10 px-5 py-6 text-[0.86rem] lg:block">
        {sesionCaducada && (
          <button onClick={() => reconectar().catch((e) => aviso(e instanceof Error ? e.message : String(e), 'error'))}
            className="btn w-full bg-white text-noche hover:bg-white/90">
            Reconectar con Google
          </button>
        )}
        {estado}
        <div>
          <div className="text-white/50">{origen === 'drive' ? 'Carpeta en Google Drive' : 'Carpeta de datos'}</div>
          <div className="mt-0.5 truncate font-medium text-white" title={nombreCarpeta}>
            <span className="sr-only">{origen === 'drive' ? 'Google Drive' : 'Carpeta'}: </span>{nombreCarpeta}
          </div>
        </div>
        <button onClick={cambiarCarpeta} className="text-white/65 underline decoration-white/30 underline-offset-4 hover:text-white">Cambiar carpeta</button>
      </div>

      {sesionCaducada && (
        <div className="flex items-center justify-between gap-3 bg-[#3a2a00] px-4 py-2 text-[0.86rem] lg:hidden">
          <span>La sesión de Google ha caducado.</span>
          <button onClick={() => reconectar().catch((e) => aviso(e instanceof Error ? e.message : String(e), 'error'))}
            className="btn btn-sm bg-white text-noche">Reconectar con Google</button>
        </div>
      )}
    </header>
  )
}
