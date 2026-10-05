import { useCallback, useEffect, useState } from 'react'
import { MAX_COPIAS } from '../lib/backups'
import { fechaHoraES, tamanoLegible } from '../lib/format'
import { useStore } from '../lib/store'
import type { Copia } from '../types'
import { Dialogo, useAviso } from './ui'

const MOTIVOS: Record<string, string> = {
  '': 'Automática al abrir',
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
    <main className="mx-auto max-w-4xl px-5 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Copias de seguridad</h1>
          <p className="mt-1 max-w-xl text-sm text-tinta/70">
            Cada vez que abres la aplicación se guarda una copia de los datos en la carpeta «backups». Se conservan las últimas {MAX_COPIAS}.
          </p>
        </div>
        <button className="btn-primario" onClick={crear} disabled={ocupado}>Crear copia ahora</button>
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border border-linea bg-white">
        {copias === null ? (
          <p className="p-6 text-sm text-tinta/70">Leyendo la carpeta…</p>
        ) : copias.length === 0 ? (
          <p className="p-6 text-sm text-tinta/70">Todavía no hay copias. Pulsa «Crear copia ahora».</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-linea bg-papel text-left text-tinta/80">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">Fecha</th>
                <th scope="col" className="px-4 py-2 font-medium">Origen</th>
                <th scope="col" className="px-4 py-2 font-medium">Tamaño</th>
                <th scope="col" className="px-4 py-2"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {copias.map((c) => (
                <tr key={c.nombre} className="border-b border-linea/70 last:border-0">
                  <td className="px-4 py-2.5">{fechaHoraES(c.fecha)}</td>
                  <td className="px-4 py-2.5 text-tinta/80">{MOTIVOS[c.motivo] ?? c.motivo}</td>
                  <td className="px-4 py-2.5 text-tinta/80">{tamanoLegible(c.tamano)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button className="btn-sec !px-2.5 !py-1.5" onClick={() => setARestaurar(c)}>Restaurar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
