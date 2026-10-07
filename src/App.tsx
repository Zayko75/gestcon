import { useEffect, useState } from 'react'
import { Cabecera } from './components/Cabecera'
import { PantallaConexion } from './components/Conexion'
import { Copias } from './components/Copias'
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

function DialogoConflicto() {
  const { conflicto, resolverConflicto } = useStore()
  if (!conflicto) return null
  return (
    <Dialogo titulo="El archivo de datos ha cambiado"
      acciones={<>
        <button className="btn-sec" onClick={() => resolverConflicto(false)}>Recargar los datos del archivo</button>
        <button className="btn-peligro" onClick={() => resolverConflicto(true)}>Guardar mis cambios y sobrescribir</button>
      </>}>
      <p>Desde que abriste los datos, <code>datos.sqlite</code> se ha modificado fuera de esta ventana (por ejemplo, la aplicación abierta en otra pestaña o en otro equipo).</p>
      <p><strong>Recargar</strong> descarta tu último cambio y muestra lo que hay en el archivo. <strong>Sobrescribir</strong> guarda lo que ves aquí y pierde los cambios hechos en la otra ventana.</p>
    </Dialogo>
  )
}

function Contenido() {
  const { fase } = useStore()
  const ruta = useRuta()
  if (fase !== 'listo') return <PantallaConexion />

  let pantalla
  const m = /^\/registro\/(\d+)$/.exec(ruta)
  if (m) pantalla = <Ficha key={m[1]} id={Number(m[1])} />
  else if (ruta === '/nuevo') pantalla = <Ficha key="nuevo" id={null} />
  else if (ruta.startsWith('/copias')) pantalla = <Copias />
  else pantalla = <Listado />

  return (
    <>
      <Cabecera ruta={ruta} />
      <div className="lg:pl-64">{pantalla}</div>
      <DialogoConflicto />
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
