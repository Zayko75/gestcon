import { useCallback, useEffect, useState } from 'react'
import type { Patrocinio } from '../types'
import { DOCUMENTOS, camposFaltantes, datosPlantilla, etiquetasDePlantilla, generarDocx, nombreDocumento, nombreDocumentoAntiguo, type DefDocumento } from '../lib/documentos'
import { fechaHoraES } from '../lib/format'
import * as fs from '../lib/fs'
import { useStore } from '../lib/store'
import { VistaPrevia } from './VistaPrevia'
import { useAviso } from './ui'

interface Estado {
  etiquetas: string[] | null // null = falta la plantilla
  existe: Date | null // fecha del documento ya generado
  archivo: string | null // nombre con el que está guardado (el actual o el de versiones anteriores)
}

export function PanelDocumentos({ registro, listoParaGenerar, antesDeGenerar }: {
  registro: Patrocinio | null
  listoParaGenerar: boolean
  antesDeGenerar: () => Promise<boolean>
}) {
  const { dirRaiz } = useStore()
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
      let archivo: string | null = null
      for (const nombre of [nombreDocumento(registro, def), nombreDocumentoAntiguo(registro, def)]) {
        try {
          existe = new Date(await fs.modificadoDe(dirDoc, nombre))
          archivo = nombre
          break
        } catch { /* aún no generado */ }
      }
      nuevo[def.id] = { etiquetas, existe, archivo }
    }
    setEstados(nuevo)
  }, [dirRaiz, registro?.id, registro?.num_contrato, registro?.entidad, registro?.anualidad]) // eslint-disable-line react-hooks/exhaustive-deps

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
      const bytes = generarDocx(plantilla, datosPlantilla(registro))
      const nombre = nombreDocumento(registro, def)
      await fs.escribirBytes(await fs.subcarpeta(dirRaiz, 'documentos'), nombre, bytes)
      setEstados((e) => ({ ...e, [def.id]: { etiquetas: e[def.id]?.etiquetas ?? etiquetasDePlantilla(plantilla), existe: new Date(), archivo: nombre } }))
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
    const nombre = estados[def.id]?.archivo ?? nombreDocumento(registro, def)
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

  const datos = registro ? datosPlantilla(registro) : null

  return (
    <section aria-labelledby="t-docs" className="overflow-hidden rounded-xl border border-linea bg-white">
      <div className="flex items-start justify-between gap-3 px-5 pb-4 pt-5">
        <div>
          <h2 id="t-docs" className="font-display text-[1.4rem] font-semibold leading-tight">Documentos</h2>
          <p className="mt-0.5 text-[0.84rem] text-tinta/55">Se guardan en la carpeta «documentos».</p>
        </div>
        <button className="btn-sec btn-sm shrink-0" disabled={!listoParaGenerar || trabajando !== null} onClick={generarTodos}>
          Generar todos
        </button>
      </div>
      {!listoParaGenerar && (
        <p className="mx-5 mb-3 rounded-lg bg-aviso/[.08] px-3 py-2 text-[0.85rem] text-aviso">
          {registro ? 'Corrige los datos señalados para poder generar documentos.' : 'Crea el patrocinio para poder generar sus documentos.'}
        </p>
      )}
      <ul className="border-t border-linea">
        {DOCUMENTOS.map((def) => {
          const est = estados[def.id]
          const faltan = est?.etiquetas && datos ? camposFaltantes(est.etiquetas, datos) : []
          const ocupado = trabajando === def.id
          const falta = est?.etiquetas === null
          return (
            <li key={def.id} className="flex gap-3 border-b border-linea/70 px-5 py-3.5 last:border-0">
              <span aria-hidden="true" className={`mt-1 flex h-[1.1rem] w-[1.1rem] shrink-0 items-center justify-center rounded-full ${falta ? 'bg-error/15 text-error' : est?.existe ? 'bg-ok text-white' : 'border-[1.5px] border-tinta/25'}`}>
                {est?.existe && !falta && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5 10 17 19 7" /></svg>
                )}
                {falta && <span className="text-[0.7rem] font-bold leading-none">!</span>}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold leading-snug">{def.etiqueta}</div>
                    <div className="text-[0.84rem] leading-snug text-tinta/55">{def.descripcion}</div>
                  </div>
                  {!est?.existe && (
                    <button className="btn-primario btn-sm shrink-0"
                      disabled={!listoParaGenerar || trabajando !== null || falta}
                      onClick={() => generar(def)}>
                      {ocupado ? 'Generando…' : 'Generar'}
                    </button>
                  )}
                </div>
                {falta && (
                  <p className="mt-1.5 text-[0.82rem] font-medium text-error">Falta la plantilla «{def.plantilla}» en la carpeta plantillas.</p>
                )}
                {faltan.length > 0 && (
                  <p className="mt-1.5 text-[0.82rem] text-aviso">Sin rellenar: {faltan.join(', ')}.</p>
                )}
                {est?.existe && (
                  <div className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-1.5">
                    <button className="btn-sec btn-sm" onClick={() => verExistente(def)} title="Ver el documento guardado e imprimirlo o guardarlo como PDF">Ver / PDF</button>
                    <button className="btn-texto btn-sm" disabled={!listoParaGenerar || trabajando !== null} onClick={() => generar(def)}>
                      {ocupado ? 'Generando…' : 'Volver a generar'}
                    </button>
                    <span className="basis-full text-[0.8rem] text-tinta/50">Generado el {fechaHoraES(est.existe)}</span>
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      {vista && <VistaPrevia nombre={vista.nombre} bytes={vista.bytes} onCerrar={() => setVista(null)} />}
    </section>
  )
}
