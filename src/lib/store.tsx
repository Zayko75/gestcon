import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Database } from 'sql.js'
import type { Copia, DatosPatrocinio, Patrocinio } from '../types'
import * as bd from './db'
import * as fs from './fs'
import { crearCopia, leerCopia, listarCopias } from './backups'

type Fase = 'inicio' | 'cargando' | 'sin-bd' | 'listo' | 'error'
type EstadoGuardado = { estado: 'guardado' | 'guardando' | 'error'; hora?: Date; mensaje?: string }

class ConflictoError extends Error {}

interface Ctx {
  fase: Fase
  error: string
  carpetaGuardada: string | null
  nombreCarpeta: string
  registros: Patrocinio[]
  guardado: EstadoGuardado
  conflicto: boolean
  ivaPct: number
  dirRaiz: FileSystemDirectoryHandle | null
  continuar: () => Promise<void>
  elegirOtra: () => Promise<void>
  crearBDVacia: () => Promise<void>
  crear: (d: DatosPatrocinio) => Promise<number>
  actualizar: (id: number, d: DatosPatrocinio) => Promise<void>
  eliminar: (id: number) => Promise<void>
  resolverConflicto: (sobrescribir: boolean) => Promise<void>
  listarCopias: () => Promise<Copia[]>
  copiaAhora: (motivo?: string) => Promise<void>
  restaurar: (nombre: string) => Promise<void>
}

const StoreCtx = createContext<Ctx | null>(null)
export function useStore(): Ctx {
  const c = useContext(StoreCtx)
  if (!c) throw new Error('useStore fuera de StoreProvider')
  return c
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [fase, setFase] = useState<Fase>('inicio')
  const [error, setError] = useState('')
  const [carpetaGuardada, setCarpetaGuardada] = useState<string | null>(null)
  const [registros, setRegistros] = useState<Patrocinio[]>([])
  const [guardado, setGuardado] = useState<EstadoGuardado>({ estado: 'guardado' })
  const [conflicto, setConflicto] = useState(false)
  const [ivaPct, setIvaPct] = useState(21)
  const [dirRaiz, setDirRaiz] = useState<FileSystemDirectoryHandle | null>(null)
  const [nombreCarpeta, setNombreCarpeta] = useState('')

  const handle = useRef<FileSystemDirectoryHandle | null>(null)
  const db = useRef<Database | null>(null)
  const ultimoMod = useRef(0)
  const cola = useRef<Promise<unknown>>(Promise.resolve())

  // Al arrancar: ¿hay una carpeta recordada?
  useEffect(() => {
    fs.cargarHandle().then((h) => {
      if (h) {
        handle.current = h
        setCarpetaGuardada(h.name)
      }
    })
  }, [])

  const refrescar = useCallback(() => {
    if (db.current) setRegistros(bd.listar(db.current))
  }, [])

  /** Abre datos.sqlite de la carpeta, hace la copia automática y lista los registros */
  const abrirCarpeta = useCallback(async (h: FileSystemDirectoryHandle) => {
    setFase('cargando')
    setError('')
    try {
      handle.current = h
      setDirRaiz(h)
      setNombreCarpeta(h.name)
      // Estructura de carpetas
      await fs.subcarpeta(h, 'plantillas')
      await fs.subcarpeta(h, 'documentos')
      const dirBackups = await fs.subcarpeta(h, 'backups')
      if (!(await fs.existe(h, 'datos.sqlite'))) {
        setFase('sin-bd')
        return
      }
      const { datos, modificado } = await fs.leerBytes(h, 'datos.sqlite')
      const nueva = await bd.abrirBD(datos)
      db.current?.close()
      db.current = nueva
      ultimoMod.current = modificado
      setIvaPct(Number(bd.leerConfig(nueva, 'tipo_iva', '21')) || 21)
      // Copia automática al abrir (se conservan las últimas 30)
      try {
        await crearCopia(dirBackups, datos)
      } catch (e) {
        console.warn('No se pudo crear la copia automática', e)
      }
      refrescar()
      setGuardado({ estado: 'guardado' })
      setConflicto(false)
      setFase('listo')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setFase('error')
    }
  }, [refrescar])

  const continuar = useCallback(async () => {
    const h = handle.current
    if (!h) return
    try {
      if (!(await fs.asegurarPermiso(h))) {
        setError('Hace falta permiso para leer y escribir en la carpeta. Vuelve a intentarlo y pulsa «Permitir».')
        setFase('error')
        return
      }
      await abrirCarpeta(h)
    } catch (e) {
      setError('No se puede acceder a la carpeta (¿sigue disponible la unidad de red?). ' + (e instanceof Error ? e.message : ''))
      setFase('error')
    }
  }, [abrirCarpeta])

  const elegirOtra = useCallback(async () => {
    try {
      const h = await fs.elegirCarpeta()
      await fs.guardarHandle(h)
      setCarpetaGuardada(h.name)
      await abrirCarpeta(h)
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      setError(e instanceof Error ? e.message : String(e))
      setFase('error')
    }
  }, [abrirCarpeta])

  const crearBDVacia = useCallback(async () => {
    const h = handle.current
    if (!h) return
    const nueva = await bd.nuevaBD()
    await fs.escribirBytes(h, 'datos.sqlite', bd.exportar(nueva))
    nueva.close()
    await abrirCarpeta(h)
  }, [abrirCarpeta])

  /** Guarda datos.sqlite. Avisa si el archivo cambió desde la última vez (otra pestaña, otro equipo). */
  const guardar = useCallback((forzar = false): Promise<void> => {
    const tarea = cola.current.catch(() => undefined).then(async () => {
      const h = handle.current
      if (!h || !db.current) return
      setGuardado((g) => ({ ...g, estado: 'guardando' }))
      try {
        if (!forzar) {
          const mod = await fs.modificadoDe(h, 'datos.sqlite')
          if (mod !== ultimoMod.current) throw new ConflictoError()
        }
        ultimoMod.current = await fs.escribirBytes(h, 'datos.sqlite', bd.exportar(db.current))
        setGuardado({ estado: 'guardado', hora: new Date() })
      } catch (e) {
        if (e instanceof ConflictoError) {
          setConflicto(true)
          setGuardado({ estado: 'error', mensaje: 'El archivo cambió fuera de esta ventana' })
        } else {
          setGuardado({ estado: 'error', mensaje: 'No se pudo guardar: ' + (e instanceof Error ? e.message : String(e)) })
        }
        throw e
      }
    })
    cola.current = tarea
    return tarea
  }, [])

  /** Aplica el cambio en memoria y lo guarda al momento */
  const mutar = useCallback(async <T,>(cambio: (d: Database) => T): Promise<T> => {
    if (!db.current) throw new Error('No hay base de datos abierta')
    const r = cambio(db.current)
    refrescar()
    try {
      await guardar()
    } catch (e) {
      if (!(e instanceof ConflictoError)) throw e
    }
    return r
  }, [guardar, refrescar])

  const crear = useCallback((d: DatosPatrocinio) => mutar((x) => bd.insertar(x, d)), [mutar])
  const actualizar = useCallback((id: number, d: DatosPatrocinio) => mutar((x) => bd.actualizar(x, id, d)), [mutar])
  const eliminar = useCallback((id: number) => mutar((x) => bd.eliminar(x, id)), [mutar])

  const resolverConflicto = useCallback(async (sobrescribir: boolean) => {
    if (sobrescribir) {
      await guardar(true)
      setConflicto(false)
    } else if (handle.current) {
      await abrirCarpeta(handle.current)
    }
  }, [abrirCarpeta, guardar])

  const listar = useCallback(async () => {
    if (!handle.current) return []
    return listarCopias(await fs.subcarpeta(handle.current, 'backups'))
  }, [])

  const copiaAhora = useCallback(async (motivo = 'manual') => {
    if (!handle.current || !db.current) return
    await crearCopia(await fs.subcarpeta(handle.current, 'backups'), bd.exportar(db.current), motivo)
  }, [])

  const restaurar = useCallback(async (nombre: string) => {
    const h = handle.current
    if (!h || !db.current) return
    const dirB = await fs.subcarpeta(h, 'backups')
    const bytes = await leerCopia(dirB, nombre)
    const prueba = await bd.abrirBD(bytes) // valida antes de tocar nada
    prueba.close()
    await crearCopia(dirB, bd.exportar(db.current), 'antes-de-restaurar')
    await fs.escribirBytes(h, 'datos.sqlite', bytes)
    await abrirCarpeta(h)
  }, [abrirCarpeta])

  // Aviso al cerrar si hay un guardado en curso
  useEffect(() => {
    const f = (e: BeforeUnloadEvent) => {
      if (guardado.estado !== 'guardado') e.preventDefault()
    }
    window.addEventListener('beforeunload', f)
    return () => window.removeEventListener('beforeunload', f)
  }, [guardado.estado])

  const valor = useMemo<Ctx>(() => ({
    fase, error, carpetaGuardada, nombreCarpeta, registros, guardado, conflicto, ivaPct, dirRaiz,
    continuar, elegirOtra, crearBDVacia, crear, actualizar, eliminar, resolverConflicto,
    listarCopias: listar, copiaAhora, restaurar,
  }), [fase, error, carpetaGuardada, nombreCarpeta, registros, guardado, conflicto, ivaPct, dirRaiz,
    continuar, elegirOtra, crearBDVacia, crear, actualizar, eliminar, resolverConflicto, listar, copiaAhora, restaurar])

  return <StoreCtx.Provider value={valor}>{children}</StoreCtx.Provider>
}
