import { useCallback, useEffect, useState } from 'react'
import { MAX_COPIAS } from '../lib/backups'
import { fechaHoraES, tamanoLegible } from '../lib/format'
import { useStore } from '../lib/store'
import type { Copia } from '../types'
import { Dialogo, useAviso } from './ui'

const MOTIVOS: Record<string, string> = {
  '': 'Automática del día',
  'antes-de-actualizar': 'Antes de actualizar la base de datos a la versión nueva',
  manual: 'Manual',
  'antes-de-eliminar': 'Antes de eliminar un patrocinio',
  'antes-de-restaurar': 'Antes de restaurar otra copia',
}

export function Copias() {
  const { listarCopias, copiaAhora, restaurar } = useStore()
  const aviso = useAviso()
  const [copias, setCopias] = useState<Copia[] | null>(null)
  const [aRestaurar, setARestaurar] = useState<Copia | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const cargar = useCallback(() => listarCopias().then(setCopias), [listarCopias])
  useEffect(() => { void cargar() }, [cargar])

  const crear = async () => {
    setOcupado(true)
    try {
      await copiaAhora()
      await cargar()
      aviso('Copia de seguridad creada.')
    } catch (e) {
      aviso('No se pudo crear la copia: ' + (e instanceof Error ? e.message : String(e)), 'error')
    } finally {
      setOcupado(false)
    }
  }

  const hacerRestaurar = async () => {
    if (!aRestaurar) return
    const c = aRestaurar
    setARestaurar(null)
    try {
      await restaurar(c.nombre)
      aviso(`Datos restaurados desde la copia del ${fechaHoraES(c.fecha)}.`)
    } catch (e) {
      aviso('No se pudo restaurar: ' + (e instanceof Error ? e.message : String(e)), 'error')
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 pb-16 pt-7 sm:px-8 lg:pt-10">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <h1 className="titulo">Copias de seguridad</h1>
          <p className="mt-2 max-w-xl text-tinta/65">
            La primera vez que abres la aplicación cada día se guarda una copia de los datos en la carpeta «backups». Se conservan las de los últimos {MAX_COPIAS} días, además de las {MAX_COPIAS} últimas copias manuales o hechas antes de eliminar o restaurar.
          </p>
        </div>
        <button className="btn-primario" onClick={crear} disabled={ocupado}>{ocupado ? 'Creando copia…' : 'Crear copia ahora'}</button>
      </div>

      <div className="mt-8 overflow-hidden rounded-xl border border-linea bg-white">
        {copias === null ? (
          <p className="p-6 text-tinta/65">Leyendo la carpeta…</p>
        ) : copias.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="font-display text-2xl font-semibold">Aún no hay copias</p>
            <p className="mt-2 text-tinta/65">Se creará una la próxima vez que abras la aplicación, o ahora con «Crear copia ahora».</p>
          </div>
        ) : (
          <ul>
            {copias.map((c, k) => (
              <li key={c.nombre} className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-linea/70 px-5 py-3.5 last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    <span className="font-display text-[1.2rem] font-semibold">{fechaHoraES(c.fecha)}</span>
                    {k === 0 && <span className="whitespace-nowrap rounded-full bg-indigo-claro px-2 py-0.5 text-[0.75rem] font-semibold text-indigo">La más reciente</span>}
                  </div>
                  <div className="text-[0.86rem] text-tinta/55">{MOTIVOS[c.motivo] ?? c.motivo}, {tamanoLegible(c.tamano)}</div>
                </div>
                <button className="btn-sec btn-sm" onClick={() => setARestaurar(c)}>Restaurar</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {aRestaurar && (
        <Dialogo titulo="¿Restaurar esta copia?" onCerrar={() => setARestaurar(null)}
          acciones={<>
            <button className="btn-sec" onClick={() => setARestaurar(null)}>Cancelar</button>
            <button className="btn-primario" onClick={hacerRestaurar}>Restaurar</button>
          </>}>
          <p>Los datos volverán a como estaban el <strong>{fechaHoraES(aRestaurar.fecha)}</strong>.</p>
          <p>Antes se guarda una copia de los datos actuales, así que se puede deshacer.</p>
        </Dialogo>
      )}
    </main>
  )
}
