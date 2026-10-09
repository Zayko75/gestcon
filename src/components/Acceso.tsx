import { useState, type FormEvent, type ReactNode } from 'react'
import { LONGITUD_MINIMA } from '../lib/acceso'
import { useStore } from '../lib/store'
import { MarcoConexion } from './Conexion'

function Campo({ id, etiqueta, ayuda, children }: { id: string; etiqueta: string; ayuda?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="etiqueta">{etiqueta}</label>
      {children}
      {ayuda && <p className="mt-1.5 text-[0.82rem] text-tinta/55">{ayuda}</p>}
    </div>
  )
}

function MensajeError({ texto }: { texto: string }) {
  if (!texto) return null
  return <p role="alert" className="rounded-lg border border-error/30 bg-error/[.06] px-4 py-3 text-[0.92rem] text-error">{texto}</p>
}

/** Ejecuta una acción de formulario mostrando el error y bloqueando el botón mientras dura */
function useEnvio() {
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const enviar = (f: () => Promise<unknown>) => async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setOcupado(true)
    try { await f() } catch (x) { setError(x instanceof Error ? x.message : String(x)) } finally { setOcupado(false) }
  }
  return { error, setError, ocupado, enviar }
}

const AYUDA_CLAVE = `Al menos ${LONGITUD_MINIMA} caracteres, con letras y números.`

function Entrar() {
  const { entrar, recuperarClave, nombreCarpeta, cambiarCarpeta } = useStore()
  const [modo, setModo] = useState<'entrar' | 'recuperar'>('entrar')
  const [usuario, setUsuario] = useState(() => { try { return localStorage.getItem('gestcon-ultimo-usuario') ?? '' } catch { return '' } })
  const [clave, setClave] = useState('')
  const [codigo, setCodigo] = useState('')
  const [nueva, setNueva] = useState('')
  const [repetir, setRepetir] = useState('')
  const { error, setError, ocupado, enviar } = useEnvio()
  const recordar = () => { try { localStorage.setItem('gestcon-ultimo-usuario', usuario.trim()) } catch { /* sin almacenamiento */ } }

  if (modo === 'recuperar') {
    return (
      <form className="space-y-5" onSubmit={enviar(async () => {
        if (nueva !== repetir) throw new Error('Las dos contraseñas nuevas no coinciden.')
        recordar()
        await recuperarClave(usuario, codigo, nueva)
      })}>
        <div>
          <h1 className="titulo">Recuperar el acceso</h1>
          <p className="mt-2 leading-relaxed text-tinta/65">
            Con el código de recuperación que se mostró al crear el administrador puedes poner una contraseña nueva.
            Si no eres administrador, pide a uno que te asigne una contraseña nueva.
          </p>
        </div>
        <MensajeError texto={error} />
        <Campo id="r-usuario" etiqueta="Usuario administrador"><input id="r-usuario" className="campo" value={usuario} onChange={(e) => setUsuario(e.target.value)} autoComplete="username" required /></Campo>
        <Campo id="r-codigo" etiqueta="Código de recuperación"><input id="r-codigo" className="campo font-medium uppercase tracking-[0.08em]" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="XXXX-XXXX-XXXX-XXXX" autoComplete="off" required /></Campo>
        <Campo id="r-nueva" etiqueta="Contraseña nueva" ayuda={AYUDA_CLAVE}><input id="r-nueva" type="password" className="campo" value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" required /></Campo>
        <Campo id="r-repetir" etiqueta="Repite la contraseña nueva"><input id="r-repetir" type="password" className="campo" value={repetir} onChange={(e) => setRepetir(e.target.value)} autoComplete="new-password" required /></Campo>
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn-primario" disabled={ocupado}>{ocupado ? 'Comprobando…' : 'Cambiar contraseña y entrar'}</button>
          <button type="button" className="btn-texto" onClick={() => { setModo('entrar'); setError('') }}>Volver</button>
        </div>
      </form>
    )
  }

  return (
    <form className="space-y-5" onSubmit={enviar(async () => { recordar(); await entrar(usuario, clave) })}>
      <div>
        <h1 className="titulo">Entrar</h1>
        <p className="mt-2 leading-relaxed text-tinta/65">Carpeta <strong className="font-semibold text-tinta">{nombreCarpeta}</strong>. Escribe tu usuario y contraseña de GESTCON.</p>
      </div>
      <MensajeError texto={error} />
      <Campo id="a-usuario" etiqueta="Usuario"><input id="a-usuario" className="campo" value={usuario} onChange={(e) => setUsuario(e.target.value)} autoComplete="username" autoFocus={!usuario} required /></Campo>
      <Campo id="a-clave" etiqueta="Contraseña"><input id="a-clave" type="password" className="campo" value={clave} onChange={(e) => setClave(e.target.value)} autoComplete="current-password" autoFocus={!!usuario} required /></Campo>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primario" disabled={ocupado}>{ocupado ? 'Comprobando…' : 'Entrar'}</button>
        <button type="button" className="btn-texto" onClick={() => { setModo('recuperar'); setError('') }}>¿Has olvidado la contraseña?</button>
      </div>
      <p className="border-t border-linea pt-4 text-[0.88rem] text-tinta/60">
        ¿No es esta carpeta? <button type="button" className="font-medium text-indigo underline underline-offset-2" onClick={cambiarCarpeta}>Cambiar carpeta</button>
      </p>
    </form>
  )
}

function PrimerAdmin() {
  const { crearPrimerAdmin, nombreCarpeta } = useStore()
  const [nombre, setNombre] = useState('')
  const [usuario, setUsuario] = useState('')
  const [clave, setClave] = useState('')
  const [repetir, setRepetir] = useState('')
  const { error, ocupado, enviar } = useEnvio()
  return (
    <form className="space-y-5" onSubmit={enviar(async () => {
      if (clave !== repetir) throw new Error('Las dos contraseñas no coinciden.')
      await crearPrimerAdmin({ nombre, usuario, clave })
    })}>
      <div>
        <h1 className="titulo">Crea el administrador</h1>
        <p className="mt-2 leading-relaxed text-tinta/65">
          La carpeta <strong className="font-semibold text-tinta">{nombreCarpeta}</strong> todavía no tiene usuarios. Crea el tuyo: serás el administrador y podrás dar de alta al resto desde <em>Usuarios</em>.
        </p>
      </div>
      <MensajeError texto={error} />
      <Campo id="p-nombre" etiqueta="Tu nombre"><input id="p-nombre" className="campo" value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name" autoFocus required /></Campo>
      <Campo id="p-usuario" etiqueta="Usuario" ayuda="Con el que entrarás, por ejemplo «bienvenido.oliva»."><input id="p-usuario" className="campo" value={usuario} onChange={(e) => setUsuario(e.target.value)} autoComplete="username" required /></Campo>
      <Campo id="p-clave" etiqueta="Contraseña" ayuda={AYUDA_CLAVE}><input id="p-clave" type="password" className="campo" value={clave} onChange={(e) => setClave(e.target.value)} autoComplete="new-password" required /></Campo>
      <Campo id="p-repetir" etiqueta="Repite la contraseña"><input id="p-repetir" type="password" className="campo" value={repetir} onChange={(e) => setRepetir(e.target.value)} autoComplete="new-password" required /></Campo>
      <button className="btn-primario" disabled={ocupado}>{ocupado ? 'Creando…' : 'Crear administrador y entrar'}</button>
    </form>
  )
}

function CambiarClave() {
  const { cambiarMiClave, usuario, salir } = useStore()
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [repetir, setRepetir] = useState('')
  const { error, ocupado, enviar } = useEnvio()
  return (
    <form className="space-y-5" onSubmit={enviar(async () => {
      if (nueva !== repetir) throw new Error('Las dos contraseñas nuevas no coinciden.')
      await cambiarMiClave(actual, nueva)
    })}>
      <div>
        <h1 className="titulo">Pon tu contraseña</h1>
        <p className="mt-2 leading-relaxed text-tinta/65">Hola, {usuario?.nombre}. Un administrador te ha puesto una contraseña provisional: cámbiala por una que solo sepas tú.</p>
      </div>
      <MensajeError texto={error} />
      <Campo id="c-actual" etiqueta="Contraseña provisional"><input id="c-actual" type="password" className="campo" value={actual} onChange={(e) => setActual(e.target.value)} autoComplete="current-password" autoFocus required /></Campo>
      <Campo id="c-nueva" etiqueta="Contraseña nueva" ayuda={AYUDA_CLAVE}><input id="c-nueva" type="password" className="campo" value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" required /></Campo>
      <Campo id="c-repetir" etiqueta="Repite la contraseña nueva"><input id="c-repetir" type="password" className="campo" value={repetir} onChange={(e) => setRepetir(e.target.value)} autoComplete="new-password" required /></Campo>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primario" disabled={ocupado}>{ocupado ? 'Guardando…' : 'Guardar y entrar'}</button>
        <button type="button" className="btn-texto" onClick={salir}>Salir</button>
      </div>
    </form>
  )
}

function SinAcceso() {
  const { origen, emailGoogle, salir, cambiarCarpeta, nombreCarpeta, usuarios } = useStore()
  const drive = origen === 'drive'
  const desactivado = drive && usuarios.some((u) => u.email?.toLowerCase() === emailGoogle && !u.activo)
  return (
    <div className="space-y-5">
      <h1 className="titulo">Sin acceso</h1>
      {drive ? (
        <p className="leading-relaxed text-tinta/75">
          La cuenta <strong className="font-semibold text-tinta">{emailGoogle || 'de Google'}</strong> {desactivado ? 'está desactivada en' : 'no está dada de alta en'} GESTCON.
          Pide a un administrador que {desactivado ? 'la active' : 'te dé de alta con esta cuenta'} en <em>Usuarios</em>.
        </p>
      ) : (
        <p className="leading-relaxed text-tinta/75">
          Los usuarios de la carpeta <strong className="font-semibold text-tinta">{nombreCarpeta}</strong> entran con su cuenta de Google y ninguno tiene usuario y contraseña.
          Ábrela con Google Drive, o pide a un administrador que te asigne un usuario y contraseña.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {drive && <button className="btn-primario" onClick={salir}>Usar otra cuenta de Google</button>}
        <button className="btn-sec" onClick={cambiarCarpeta}>Cambiar carpeta</button>
      </div>
    </div>
  )
}

export function PantallaAcceso() {
  const { fase } = useStore()
  return (
    <MarcoConexion>
      {fase === 'acceso' && <Entrar />}
      {fase === 'primer-admin' && <PrimerAdmin />}
      {fase === 'cambiar-clave' && <CambiarClave />}
      {fase === 'sin-acceso' && <SinAcceso />}
    </MarcoConexion>
  )
}

/** Muestra una sola vez el código de recuperación recién creado */
export function DialogoCodigo() {
  const { codigoRecuperacion, cerrarCodigo } = useStore()
  const [copiado, setCopiado] = useState(false)
  if (!codigoRecuperacion) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-noche/55 p-4 backdrop-blur-[2px] sm:items-center" role="dialog" aria-modal="true" aria-labelledby="t-codigo">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-[0_24px_64px_-24px_rgba(22,27,69,.55)]">
        <h2 id="t-codigo" className="font-display text-[1.6rem] font-semibold leading-tight">Guarda el código de recuperación</h2>
        <p className="mt-3 text-[0.95rem] leading-relaxed text-tinta/80">
          Si un administrador olvida su contraseña, este código permite poner una nueva. Solo se muestra ahora: apúntalo y guárdalo en un lugar seguro, fuera de la carpeta de datos.
        </p>
        <p className="mt-4 select-all rounded-lg border border-indigo/25 bg-indigo-claro/60 px-4 py-3 text-center font-display text-[1.6rem] font-bold tracking-[0.12em] text-tinta" aria-label="Código de recuperación">{codigoRecuperacion}</p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button className="btn-sec" onClick={async () => { try { await navigator.clipboard.writeText(codigoRecuperacion); setCopiado(true) } catch { setCopiado(false) } }}>{copiado ? 'Copiado' : 'Copiar'}</button>
          <button className="btn-primario" onClick={() => { setCopiado(false); cerrarCodigo() }}>Ya lo he guardado</button>
        </div>
      </div>
    </div>
  )
}
