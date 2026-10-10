import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { textoRol } from '../lib/acceso'
import { pendientes } from '../lib/control'
import { horaCorta } from '../lib/format'
import { useStore } from '../lib/store'
import { Dialogo, useAviso } from './ui'

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
const IconoReloj = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4M8 14h3" /></svg>
)
const IconoEntidades = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6" /></svg>
)
const IconoResumen = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
)
const IconoUsuarios = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5M16 4.8a3.5 3.5 0 0 1 0 6.4M18.5 14.8c1.7.8 2.7 2.6 3 5.2" /></svg>
)
const IconoCopias = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></svg>
)

export function Cabecera({ ruta }: { ruta: string }) {
  const { nombreCarpeta, guardado, cambiarCarpeta, origen, sesionCaducada, reconectar, registros, usuario, puede, salir } = useStore()
  const [cambiandoClave, setCambiandoClave] = useState(false)
  // Lo urgente: firmas a menos de 30 días del evento y eventos celebrados sin tramitar
  const urgentes = useMemo(() => { const p = pendientes(registros); return p.firmaUrgente.length + p.porJustificar.length }, [registros])
  const aviso = useAviso()

  const nav = (href: string, texto: ReactNode, icono: ReactNode, activa: boolean) => (
    <a href={href} aria-current={activa ? 'page' : undefined}
      className={`flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-[0.92rem] font-medium transition-colors ${activa ? 'bg-white/[.12] text-white' : 'text-white/65 hover:bg-white/[.06] hover:text-white'}`}>
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
        <nav className="flex gap-1 max-lg:order-3 max-lg:-mx-1 max-lg:w-full max-lg:overflow-x-auto lg:flex-col" aria-label="Secciones">
          {nav('#/', 'Patrocinios', <IconoLista />, ruta === '/' || ruta === '/nuevo' || ruta.startsWith('/registro'))}
          {nav('#/pendientes', <>Pendientes{urgentes > 0 && <span className="ml-auto rounded-full bg-[#ffc266] px-1.5 py-px text-[0.75rem] font-bold text-noche" aria-label={`${urgentes} urgentes`}>{urgentes}</span>}</>, <IconoReloj />, ruta === '/pendientes')}
          {nav('#/entidades', 'Entidades', <IconoEntidades />, ruta.startsWith('/entidad'))}
          {nav('#/resumen', 'Resumen', <IconoResumen />, ruta === '/resumen')}
          {puede('administrar') && nav('#/usuarios', 'Usuarios', <IconoUsuarios />, ruta === '/usuarios')}
          {puede('administrar') && nav('#/copias', <><span className="lg:hidden">Copias</span><span className="max-lg:hidden">Copias de seguridad</span></>, <IconoCopias />, ruta.startsWith('/copias'))}
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
        {usuario && (
          <div>
            <div className="text-white/50">Sesión iniciada</div>
            <div className="mt-0.5 truncate font-medium text-white" title={usuario.email ?? usuario.usuario ?? ''}>{usuario.nombre}</div>
            <div className="text-white/50">{textoRol(usuario.rol)}</div>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
              {<button onClick={() => setCambiandoClave(true)} className="text-white/65 underline decoration-white/30 underline-offset-4 hover:text-white">Cambiar contraseña</button>}
              <button onClick={salir} className="text-white/65 underline decoration-white/30 underline-offset-4 hover:text-white">Cerrar sesión</button>
            </div>
          </div>
        )}
        <div>
          <div className="text-white/50">{origen === 'drive' ? 'Carpeta en Google Drive' : 'Carpeta de datos'}</div>
          <div className="mt-0.5 truncate font-medium text-white" title={nombreCarpeta}>
            <span className="sr-only">{origen === 'drive' ? 'Google Drive' : 'Carpeta'}: </span>{nombreCarpeta}
          </div>
        </div>
        <button onClick={cambiarCarpeta} className="text-white/65 underline decoration-white/30 underline-offset-4 hover:text-white">Cambiar carpeta</button>
      </div>

      {usuario && (
        <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-1.5 text-[0.8rem] text-white/70 lg:hidden">
          <span className="truncate">{usuario.nombre} ({textoRol(usuario.rol).toLowerCase()})</span>
          <button onClick={salir} className="shrink-0 underline decoration-white/30 underline-offset-4">Cerrar sesión</button>
        </div>
      )}
      {cambiandoClave && <DialogoClave onCerrar={() => setCambiandoClave(false)} />}

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

function DialogoClave({ onCerrar }: { onCerrar: () => void }) {
  const { cambiarMiClave } = useStore()
  const aviso = useAviso()
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [repetir, setRepetir] = useState('')
  const [error, setError] = useState('')
  const guardar = async (e?: FormEvent) => {
    e?.preventDefault()
    setError('')
    try {
      if (nueva !== repetir) throw new Error('Las dos contraseñas nuevas no coinciden.')
      await cambiarMiClave(actual, nueva)
      aviso('Contraseña cambiada.')
      onCerrar()
    } catch (x) { setError(x instanceof Error ? x.message : String(x)) }
  }
  return (
    <Dialogo titulo="Cambiar contraseña" onCerrar={onCerrar}
      acciones={<><button className="btn-sec" onClick={onCerrar}>Cancelar</button><button className="btn-primario" onClick={() => void guardar()}>Cambiar</button></>}>
      <form className="space-y-3 text-tinta" onSubmit={guardar}>
        {error && <p role="alert" className="rounded-lg border border-error/30 bg-error/[.06] px-3 py-2 text-[0.9rem] text-error">{error}</p>}
        <div><label htmlFor="d-actual" className="etiqueta">Contraseña actual</label><input id="d-actual" type="password" className="campo" value={actual} onChange={(e) => setActual(e.target.value)} autoComplete="current-password" autoFocus /></div>
        <div><label htmlFor="d-nueva" className="etiqueta">Contraseña nueva</label><input id="d-nueva" type="password" className="campo" value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" /></div>
        <div><label htmlFor="d-repetir" className="etiqueta">Repite la contraseña nueva</label><input id="d-repetir" type="password" className="campo" value={repetir} onChange={(e) => setRepetir(e.target.value)} autoComplete="new-password" /></div>
        <button type="submit" className="sr-only">Cambiar</button>
      </form>
    </Dialogo>
  )
}
