import { useEffect, useState } from 'react'
import { DialogoCodigo, PantallaAcceso } from './components/Acceso'
import { Cabecera } from './components/Cabecera'
import { PantallaConexion } from './components/Conexion'
import { Copias } from './components/Copias'
import { Entidades, FichaEntidad } from './components/Entidades'
import { Pendientes } from './components/Pendientes'
import { Resumen } from './components/Resumen'
import { Usuarios } from './components/Usuarios'
import { Ficha } from './components/Ficha'
import { Listado } from './components/Listado'
import { AvisosProvider, Dialogo } from './components/ui'
import { StoreProvider, useStore } from './lib/store'

function useRuta(): string {
  const [ruta, setRuta] = useState(() => location.hash.replace(/^#/, '') || '/')
  useEffect(() => {
    const f = () => setRuta(location.hash.replace(/^#/, '') || '/')
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  return ruta
}

function DialogoActualizacion() {
  const { informeMigracion: inf, cerrarInforme, registros } = useStore()
  if (!inf) return null
  const entidad = (id: number) => registros.find((r) => r.id === id)?.entidad ?? `id ${id}`
  return (
    <Dialogo titulo="Base de datos actualizada" onCerrar={cerrarInforme}
      acciones={<button className="btn-primario" onClick={cerrarInforme}>Entendido</button>}>
      {inf.desde < inf.hasta && <p>Tu <code>datos.sqlite</code> se ha actualizado a la versión {inf.hasta}. Antes se guardó una copia en «backups» por si hubiera que volver atrás.</p>}
      <ul className="list-disc space-y-1 pl-5">
        {inf.desde < 2 && <>
          <li>{inf.entidades} entidades reunidas por CIF, para rellenar nuevos patrocinios.</li>
          <li>Fechas de inicio y fin deducidas en {inf.fechasDeducidas} patrocinios (el texto de celebración no cambia).</li>
          <li>Estado del expediente por fases y tipo de IVA en cada patrocinio.</li>
        </>}
        {inf.usuarios && <>
          <li>Los datos están <strong>protegidos</strong>: se entra con usuario y contraseña y el archivo queda cifrado, así que nadie puede leerlo sin una cuenta de GESTCON.</li>
          <li>Tú eres el administrador: da de alta al resto en <a className="font-semibold text-indigo underline" href="#/usuarios" onClick={cerrarInforme}>Usuarios</a>, con su usuario, una contraseña provisional y su rol.</li>
          <li>Varios usuarios pueden trabajar a la vez: los cambios de cada uno se combinan al guardar.</li>
        </>}
      </ul>
      {inf.cambiosTexto.length > 0 && (
        <details className="rounded-lg bg-papel px-3 py-2">
          <summary className="cursor-pointer font-medium text-tinta">
            {inf.cambiosTexto.length} importes en letra corregidos o completados para que coincidan con el número
          </summary>
          <ul className="mt-2 max-h-56 space-y-2 overflow-auto text-[0.85rem]">
            {inf.cambiosTexto.map((c, k) => (
              <li key={k}>
                <a className="font-semibold text-indigo underline" href={`#/registro/${c.id}`} onClick={cerrarInforme}>{entidad(c.id)}</a>
                {' '}({c.campo}): {c.antes ? <><s className="text-tinta/50">{c.antes}</s> → </> : 'vacío → '}{c.despues}
              </li>
            ))}
          </ul>
        </details>
      )}
    </Dialogo>
  )
}

function Contenido() {
  const { fase, remap, puede } = useStore()
  const ruta = useRuta()
  // Un patrocinio nuevo cuyo número usó a la vez otro usuario recibe otro: se sigue mostrando
  useEffect(() => {
    const m = /^\/registro\/(\d+)$/.exec(ruta)
    const nuevo = m ? remap[Number(m[1])] : undefined
    if (nuevo !== undefined) location.replace(`#/registro/${nuevo}`)
  }, [ruta, remap])
  if (fase === 'acceso' || fase === 'proteger' || fase === 'cambiar-clave') return <><PantallaAcceso /><DialogoCodigo /></>
  if (fase !== 'listo') return <PantallaConexion />

  let pantalla
  const m = /^\/registro\/(\d+)$/.exec(ruta)
  if (m) pantalla = <Ficha key={m[1]} id={Number(m[1])} />
  else if (ruta === '/nuevo') pantalla = <Ficha key="nuevo" id={null} />
  else if (ruta.startsWith('/copias') && puede('administrar')) pantalla = <Copias />
  else if (ruta === '/usuarios') pantalla = <Usuarios />
  else if (ruta === '/pendientes') pantalla = <Pendientes />
  else if (ruta === '/resumen') pantalla = <Resumen />
  else if (ruta === '/entidades') pantalla = <Entidades />
  else if (/^\/entidad\/\d+$/.test(ruta)) pantalla = <FichaEntidad key={ruta} id={Number(ruta.split('/')[2])} />
  else pantalla = <Listado />

  return (
    <>
      <Cabecera ruta={ruta} />
      <div className="lg:pl-64">{pantalla}</div>
      <DialogoActualizacion />
      <DialogoCodigo />
    </>
  )
}

export default function App() {
  return (
    <AvisosProvider>
      <StoreProvider>
        <Contenido />
      </StoreProvider>
    </AvisosProvider>
  )
}
