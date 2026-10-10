import { useState } from 'react'
import { LONGITUD_MINIMA, ROLES, textoRol } from '../lib/acceso'
import { useStore, type DatosUsuarioForm } from '../lib/store'
import type { Rol, Usuario } from '../types'
import { Dialogo, useAviso } from './ui'

const COLOR_ROL: Record<Rol, string> = {
  consulta: 'bg-tinta/[.07] text-tinta/75',
  edicion: 'bg-indigo-claro text-indigo',
  admin: 'bg-noche text-white',
}
export const ChipRol = ({ rol }: { rol: Rol }) => (
  <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[0.8rem] font-semibold leading-none ${COLOR_ROL[rol]}`}>{textoRol(rol)}</span>
)

const VACIO: DatosUsuarioForm = { nombre: '', usuario: '', rol: 'consulta', activo: true, clave: '' }

function Editor({ u, onCerrar }: { u: Usuario | null; onCerrar: () => void }) {
  const { guardarUsuario, borrarUsuario, usuario: yo, conClave } = useStore()
  const aviso = useAviso()
  const [d, setD] = useState<DatosUsuarioForm>(u ? { nombre: u.nombre, usuario: u.usuario ?? '', rol: u.rol, activo: !!u.activo, clave: '' } : { ...VACIO })
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [confirmarBorrar, setConfirmarBorrar] = useState(false)
  const set = <K extends keyof DatosUsuarioForm>(k: K, v: DatosUsuarioForm[K]) => setD((x) => ({ ...x, [k]: v }))
  const esYo = u?.id === yo?.id
  const tieneClave = !!u && conClave.includes(u.id)

  const guardar = async () => {
    setError('')
    setOcupado(true)
    try {
      const nota = await guardarUsuario(d, u?.id)
      aviso(u ? `Usuario ${d.nombre} guardado.` : `Usuario ${d.nombre} dado de alta.`)
      if (nota) aviso(nota, 'aviso')
      onCerrar()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setOcupado(false)
    }
  }

  const borrar = async () => {
    if (!u) return
    setConfirmarBorrar(false)
    setOcupado(true)
    try {
      const nota = await borrarUsuario(u.id)
      aviso(`Usuario ${u.nombre} eliminado.`)
      if (nota) aviso(nota, 'aviso')
      onCerrar()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-noche/50 p-4 backdrop-blur-[2px] sm:items-center" role="dialog" aria-modal="true" aria-labelledby="t-editor"
      onKeyDown={(e) => { if (e.key === 'Escape') onCerrar() }}>
      <form className="max-h-full w-full max-w-xl overflow-auto rounded-2xl bg-white p-6 shadow-[0_24px_64px_-24px_rgba(22,27,69,.55)]"
        onSubmit={(e) => { e.preventDefault(); void guardar() }}>
        <h2 id="t-editor" className="font-display text-[1.6rem] font-semibold leading-tight">{u ? (esYo ? 'Tu usuario' : `Usuario: ${u.nombre}`) : 'Nuevo usuario'}</h2>
        {error && <p role="alert" className="mt-3 rounded-lg border border-error/30 bg-error/[.06] px-4 py-3 text-[0.92rem] text-error">{error}</p>}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="u-nombre" className="etiqueta">Nombre</label>
            <input id="u-nombre" className="campo" value={d.nombre} onChange={(e) => set('nombre', e.target.value)} autoFocus required />
            <p className="mt-1.5 text-[0.82rem] text-tinta/55">Aparece como autor de los cambios.</p>
          </div>
          <div>
            <label htmlFor="u-usuario" className="etiqueta">Usuario</label>
            <input id="u-usuario" className="campo" value={d.usuario} onChange={(e) => set('usuario', e.target.value)} placeholder="nombre.apellido" autoComplete="off" required />
          </div>
          <div>
            <label htmlFor="u-clave" className="etiqueta">{tieneClave ? 'Contraseña nueva' : 'Contraseña inicial'}</label>
            <input id="u-clave" type="password" className="campo" value={d.clave} onChange={(e) => set('clave', e.target.value)} autoComplete="new-password" placeholder={tieneClave ? 'Sin cambios' : ''} required={!tieneClave} />
          </div>
          <p className="-mt-2 text-[0.82rem] text-tinta/55 sm:col-span-2">
            Con este usuario y contraseña entra en GESTCON. Al menos {LONGITUD_MINIMA} caracteres con letras y números{esYo ? '' : '; es provisional: la persona la cambia al entrar'}.
          </p>
        </div>

        <fieldset className="mt-5">
          <legend className="etiqueta">Rol</legend>
          <div className="space-y-2">
            {ROLES.map((r) => (
              <label key={r.valor} className={`flex cursor-pointer gap-3 rounded-lg border px-3.5 py-3 transition-colors ${d.rol === r.valor ? 'border-indigo bg-indigo-claro/50' : 'border-linea hover:border-tinta/25'}`}>
                <input type="radio" name="rol" value={r.valor} checked={d.rol === r.valor} onChange={() => set('rol', r.valor)} className="mt-1 accent-[#2c3487]" />
                <span>
                  <span className="block font-semibold">{r.texto}</span>
                  <span className="block text-[0.86rem] leading-snug text-tinta/65">{r.descripcion}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="mt-5 flex items-center gap-2.5">
          <input type="checkbox" checked={d.activo} onChange={(e) => set('activo', e.target.checked)} disabled={esYo} className="h-4 w-4 accent-[#2c3487]" />
          <span>Activo <span className="text-tinta/55">(desactivado no puede entrar ni descifrar los datos)</span></span>
        </label>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {u && !esYo && <button type="button" className="btn-peligro mr-auto" onClick={() => setConfirmarBorrar(true)} disabled={ocupado}>Eliminar</button>}
          <button type="button" className="btn-sec ml-auto" onClick={onCerrar}>Cancelar</button>
          <button className="btn-primario" disabled={ocupado}>{ocupado ? 'Guardando…' : u ? 'Guardar' : 'Dar de alta'}</button>
        </div>
      </form>
      {confirmarBorrar && u && (
        <Dialogo titulo={`¿Eliminar a ${u.nombre}?`} onCerrar={() => setConfirmarBorrar(false)}
          acciones={<><button className="btn-sec" onClick={() => setConfirmarBorrar(false)}>Cancelar</button><button className="btn-peligro" onClick={borrar}>Eliminar</button></>}>
          <p>No podrá entrar en GESTCON. Sus cambios anteriores se conservan con su nombre.</p>
          <p>Si solo quieres impedir el acceso un tiempo, desmarca «Activo».</p>
        </Dialogo>
      )}
    </div>
  )
}

export function Usuarios() {
  const { usuarios, usuario: yo, puede, nuevoCodigo, conClave } = useStore()
  const aviso = useAviso()
  const [editando, setEditando] = useState<Usuario | null | 'nuevo'>(null)

  if (!puede('administrar')) {
    return <main className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-8"><p className="font-display text-3xl font-semibold">Solo para administradores</p></main>
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-7 sm:px-8 lg:pt-10">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <h1 className="titulo">Usuarios</h1>
          <p className="mt-2 text-tinta/65">{usuarios.filter((u) => u.activo).length} usuarios activos. Varios pueden trabajar a la vez: los cambios de cada uno se combinan al guardar.</p>
        </div>
        <button className="btn-primario" onClick={() => setEditando('nuevo')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          Nuevo usuario
        </button>
      </div>

      <div className="mt-7 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="overflow-hidden rounded-xl border border-linea bg-white">
          <table className="w-full text-[0.92rem]">
            <thead className="border-b border-linea text-left text-[0.84rem] text-tinta/55">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Usuario</th>
                <th scope="col" className="px-4 py-3 font-medium max-md:hidden">Entra como</th>
                <th scope="col" className="w-36 px-4 py-3 font-medium">Rol</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} className={`group cursor-pointer border-b border-linea/70 last:border-0 hover:bg-indigo-claro/45 ${u.activo ? '' : 'text-tinta/45'}`} onClick={() => setEditando(u)}>
                  <td className="px-4 py-3">
                    <button type="button" className="text-left font-semibold group-hover:text-indigo" onClick={(e) => { e.stopPropagation(); setEditando(u) }}>
                      {u.nombre}{u.id === yo?.id && <span className="ml-2 font-normal text-tinta/50">(tú)</span>}
                    </button>
                    {!u.activo && <span className="ml-2 rounded bg-tinta/[.07] px-1.5 py-0.5 text-[0.76rem] font-medium">Desactivado</span>}
                    {u.cambiar_clave ? <span className="ml-2 text-[0.8rem] text-aviso">Debe cambiar la contraseña</span> : null}
                    <div className="mt-0.5 text-[0.84rem] text-tinta/55 md:hidden">{u.usuario ?? 'Sin usuario'}</div>
                  </td>
                  <td className="px-4 py-3 text-[0.88rem] text-tinta/70 max-md:hidden">
                    {u.usuario ?? <span className="text-aviso">Sin usuario</span>}
                    {u.usuario && !conClave.includes(u.id) && <span className="text-aviso"> (sin contraseña: no puede entrar)</span>}
                  </td>
                  <td className="px-4 py-3"><ChipRol rol={u.rol} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className="space-y-4 text-[0.9rem] leading-relaxed text-tinta/75">
          <section className="rounded-xl border border-linea bg-white p-5">
            <h2 className="font-display text-[1.25rem] font-semibold text-tinta">Cómo se protegen los datos</h2>
            <p className="mt-2">Cada persona entra con su <strong>usuario y contraseña</strong>, y la aplicación aplica su rol.</p>
            <p className="mt-2">El archivo de datos está <strong>cifrado</strong>: sin un usuario y contraseña válidos no se puede leer, aunque alguien abra la carpeta. Un usuario desactivado o eliminado deja de poder descifrarlo.</p>
            <p className="mt-2 text-tinta/60">La carpeta (Google Drive o de red) se conecta una vez en cada ordenador; después se entra con el usuario de GESTCON.</p>
          </section>
          {(
            <section className="rounded-xl border border-linea bg-white p-5">
              <h2 className="font-display text-[1.25rem] font-semibold text-tinta">Código de recuperación</h2>
              <p className="mt-2">Permite a un administrador poner una contraseña nueva si la olvida. Si lo has perdido, genera otro: el anterior deja de valer.</p>
              <button className="btn-sec btn-sm mt-3" onClick={async () => { try { await nuevoCodigo() } catch (e) { aviso(e instanceof Error ? e.message : String(e), 'error') } }}>Generar un código nuevo</button>
            </section>
          )}
        </aside>
      </div>

      {editando && <Editor key={editando === 'nuevo' ? 'nuevo' : editando.id} u={editando === 'nuevo' ? null : editando} onCerrar={() => setEditando(null)} />}
    </main>
  )
}
