import { useCallback, useEffect, useState } from 'react'
import type { Patrocinio } from '../types'
import { DOCUMENTOS, camposFaltantes, datosPlantilla, etiquetasDePlantilla, generarDocx, nombreDocumento, type DefDocumento } from '../lib/documentos'
import { fechaHoraES } from '../lib/format'
import * as fs from '../lib/fs'
import { useStore } from '../lib/store'
import { VistaPrevia } from './VistaPrevia'
import { useAviso } from './ui'

interface Estado {
  etiquetas: string[] | null // null = falta la plantilla
  existe: Date | null // fecha del documento ya generado
}

export function PanelDocumentos({ registro, listoParaGenerar, antesDeGenerar }: {
  registro: Patrocinio | null
  listoParaGenerar: boolean
  antesDeGenerar: () => Promise<boolean>
}) {
  const { dirRaiz, ivaPct } = useStore()
  const aviso = useAviso()
  const [estados, setEstados] = useState<Record<string, Estado>>({})
  const [trabajando, setTrabajando] = useState<string | null>(null)
  const [vista, setVista] = useState<{ nombre: string; bytes: Uint8Array } | null>(null)

  // Lee qué etiquetas tiene cada plantilla y qué documentos ya existen
  const cargarEstados = useCallback(async () => {
    if (!dirRaiz || !registro) return
    const dirPl = await fs.subcarpeta(dirRaiz, 'plantillas')
    const dirDoc = await fs.subcarpeta(dirRaiz, 'documentos')
    const nuevo: Record<string, Estado> = {}
    for (const def of DOCUMENTOS) {
      let etiquetas: string[] | null = null
      try {
        etiquetas = etiquetasDePlantilla((await fs.leerBytes(dirPl, def.plantilla)).datos)
      } catch { /* falta la plantilla */ }
      let existe: Date | null = null
      try {
        existe = new Date(await fs.modificadoDe(dirDoc, nombreDocumento(registro, def)))
      } catch { /* aún no generado */ }
      nuevo[def.id] = { etiquetas, existe }
    }
    setEstados(nuevo)
  }, [dirRaiz, registro?.id, registro?.num_contrato, registro?.entidad]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void cargarEstados() }, [cargarEstados])

  const generar = async (def: DefDocumento, silencioso = false): Promise<boolean> => {
    if (!dirRaiz || !registro) return false
    if (!(await antesDeGenerar())) return false
    setTrabajando(def.id)
    try {
      const dirPl = await fs.subcarpeta(dirRaiz, 'plantillas')
      let plantilla: Uint8Array
      try {
        plantilla = (await fs.leerBytes(dirPl, def.plantilla)).datos
      } catch {
        aviso(`Falta la plantilla ${def.plantilla} en la carpeta «plantillas».`, 'error')
        return false
      }
      const bytes = generarDocx(plantilla, datosPlantilla(registro, ivaPct))
      const nombre = nombreDocumento(registro, def)
      await fs.escribirBytes(await fs.subcarpeta(dirRaiz, 'documentos'), nombre, bytes)
      setEstados((e) => ({ ...e, [def.id]: { etiquetas: e[def.id]?.etiquetas ?? etiquetasDePlantilla(plantilla), existe: new Date() } }))
      if (!silencioso) {
        aviso(`${def.etiqueta} guardado en «documentos»: ${nombre}`)
        setVista({ nombre, bytes })
      }
      return true
    } catch (e: any) {
      const detalle = e?.properties?.errors?.map((x: any) => x.properties?.explanation).filter(Boolean).join(' ') || (e instanceof Error ? e.message : String(e))
      aviso(`No se pudo generar ${def.etiqueta}: ${detalle}`, 'error')
      return false
    } finally {
      setTrabajando(null)
    }
  }

  const verExistente = async (def: DefDocumento) => {
    if (!dirRaiz || !registro) return
    const nombre = nombreDocumento(registro, def)
    try {
      const { datos } = await fs.leerBytes(await fs.subcarpeta(dirRaiz, 'documentos'), nombre)
      setVista({ nombre, bytes: datos })
    } catch {
      aviso('No se encuentra el documento en la carpeta «documentos».', 'error')
    }
  }

  const generarTodos = async () => {
    let ok = 0
    for (const def of DOCUMENTOS) {
      if (estados[def.id]?.etiquetas === null) continue
      if (await generar(def, true)) ok++
    }
    aviso(`${ok} de ${DOCUMENTOS.length} documentos guardados en «documentos».`, ok === DOCUMENTOS.length ? 'ok' : 'aviso')
  }

  const datos = registro ? datosPlantilla(registro, ivaPct) : null

  return (
    <section aria-labelledby="t-docs" className="rounded-lg border border-linea bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-linea px-4 py-3">
        <h2 id="t-docs" className="text-base font-semibold">Documentos</h2>
        <button className="btn-sec !px-2.5 !py-1.5" disabled={!listoParaGenerar || trabajando !== null} onClick={generarTodos}>
          Generar todos
        </button>
      </div>
      {!listoParaGenerar && (
        <p className="border-b border-linea bg-aviso/5 px-4 py-2.5 text-sm text-aviso">
          {registro ? 'Corrige los datos señalados para poder generar documentos.' : 'Crea el patrocinio para poder generar sus documentos.'}
        </p>
      )}
      <ul className="divide-y divide-linea/70">
        {DOCUMENTOS.map((def) => {
          const est = estados[def.id]
          const faltan = est?.etiquetas && datos ? camposFaltantes(est.etiquetas, datos) : []
          const ocupado = trabajando === def.id
          return (
            <li key={def.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{def.etiqueta}</div>
                  <div className="text-xs text-tinta/60">{def.descripcion}</div>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {est?.existe && (
                    <button className="btn-sec !px-2.5 !py-1.5" onClick={() => verExistente(def)} title="Ver el documento guardado e imprimirlo o guardarlo como PDF">Ver / PDF</button>
                  )}
                  <button className={est?.existe ? 'btn-sec !px-2.5 !py-1.5' : 'btn-primario !px-2.5 !py-1.5'}
                    disabled={!listoParaGenerar || trabajando !== null || est?.etiquetas === null}
                    onClick={() => generar(def)}>
                    {ocupado ? 'Generando…' : est?.existe ? 'Volver a generar' : 'Generar'}
                  </button>
                </div>
              </div>
              {est?.etiquetas === null && (
                <p className="mt-1.5 text-xs text-error">Falta la plantilla «{def.plantilla}» en la carpeta plantillas.</p>
              )}
              {faltan.length > 0 && (
                <p className="mt-1.5 text-xs text-aviso">Sin rellenar: {faltan.join(', ')}.</p>
              )}
              {est?.existe && (
                <p className="mt-1.5 truncate text-xs text-tinta/55">Generado el {fechaHoraES(est.existe)}</p>
              )}
            </li>
          )
        })}
      </ul>
      {vista && <VistaPrevia nombre={vista.nombre} bytes={vista.bytes} onCerrar={() => setVista(null)} />}
    </section>
  )
}
