import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Database } from 'sql.js'
import type { Copia, DatosPatrocinio, Patrocinio } from '../types'
import * as bd from './db'
import * as fs from './fs'
import * as drive from './drive'
import { crearCopia, leerCopia, listarCopias } from './backups'

type Fase = 'inicio' | 'cargando' | 'sin-bd' | 'listo' | 'error'
export type Origen = 'local' | 'drive'
type EstadoGuardado = { estado: 'guardado' | 'guardando' | 'error'; hora?: Date; mensaje?: string }

class ConflictoError extends Error {}

interface Ctx {
  fase: Fase
  error: string
  carpetaGuardada: { tipo: Origen; nombre: string } | null
  nombreCarpeta: string
  origen: Origen | null
  sesionCaducada: boolean
  registros: Patrocinio[]
  guardado: EstadoGuardado
  conflicto: boolean
  ivaPct: number
  dirRaiz: fs.Carpeta | null
  continuar: () => Promise<void>
  elegirOtra: () => Promise<void>
  cambiarCarpeta: () => void
  buscarEnDrive: (nombre: string) => Promise<drive.CandidatoDrive[]>
  abrirEnDrive: (c: { id: string; nombre: string }) => Promise<void>
  reconectar: () => Promise<void>
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
  const [conexion, setConexion] = useState<fs.ConexionGuardada | null>(null)
  const [sesionCaducada, setSesionCaducada] = useState(false)
  const [registros, setRegistros] = useState<Patrocinio[]>([])
  const [guardado, setGuardado] = useState<EstadoGuardado>({ estado: 'guardado' })
  const [conflicto, setConflicto] = useState(false)
  const [ivaPct, setIvaPct] = useState(21)
  const [dirRaiz, setDirRaiz] = useState<fs.Carpeta | null>(null)
  const [nombreCarpeta, setNombreCarpeta] = useState('')

  const handle = useRef<fs.Carpeta | null>(null)
  const db = useRef<Database | null>(null)
  const ultimoMod = useRef('')
  const cola = useRef<Promise<unknown>>(Promise.resolve())

  // Al arrancar: ¿hay una carpeta recordada?
  useEffect(() => {
    fs.cargarConexion().then(setConexion)
  }, [])

  const refrescar = useCallback(() => {
    if (db.current) setRegistros(bd.listar(db.current))
  }, [])

  /** Abre datos.sqlite de la carpeta, hace la copia automática y lista los registros */
  const abrirCarpeta = useCallback(async (h: fs.Carpeta) => {
    setFase('cargando')
    setError('')
    try {
      handle.current = h
      setDirRaiz(h)
      setNombreCarpeta(h.nombre)
      setSesionCaducada(false)
      // Estructura de carpetas
      await fs.subcarpeta(h, 'plantillas')
      await fs.subcarpeta(h, 'documentos')
      const dirBackups = await fs.subcarpeta(h, 'backups')
      if (!(await fs.existe(h, 'datos.sqlite'))) {
        setFase('sin-bd')
        return
      }
      const { datos, marca } = await fs.leerBytes(h, 'datos.sqlite')
      const nueva = await bd.abrirBD(datos)
      db.current?.close()
      db.current = nueva
      ultimoMod.current = marca
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

  const fallo = (e: unknown, prefijo = '') => {
    setError(prefijo + (e instanceof Error ? e.message : String(e)))
    setFase('error')
  }

  /** Abre la última carpeta usada (hay que llamarlo desde un clic) */
  const continuar = useCallback(async () => {
    const c = conexion
    if (!c) return
    try {
      if (c.tipo === 'local') {
        if (!(await fs.asegurarPermiso(c.handle))) {
          fallo('Hace falta permiso para leer y escribir en la carpeta. Vuelve a intentarlo y pulsa «Permitir».')
          return
        }
        await abrirCarpeta(new fs.CarpetaLocal(c.handle))
      } else {
        if (!drive.sesionActiva()) await drive.iniciarSesion()
        await abrirCarpeta(new drive.CarpetaDrive(c.id, c.nombre))
      }
    } catch (e) {
      fallo(e, c.tipo === 'local' ? 'No se puede acceder a la carpeta (¿sigue disponible la unidad de red?). ' : '')
    }
  }, [abrirCarpeta, conexion])

  /** Elige una carpeta del ordenador o de la red */
  const elegirOtra = useCallback(async () => {
    try {
      const h = await fs.elegirCarpeta()
      const c: fs.ConexionGuardada = { tipo: 'local', handle: h, nombre: h.name }
      await fs.guardarConexion(c)
      setConexion(c)
      await abrirCarpeta(new fs.CarpetaLocal(h))
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      fallo(e)
    }
  }, [abrirCarpeta])

  /** Inicia sesión en Google (si hace falta) y busca carpetas con ese nombre */
  const buscarEnDrive = useCallback(async (nombre: string) => {
    if (!drive.sesionActiva()) await drive.iniciarSesion()
    return drive.buscarCarpetas(nombre)
  }, [])

  const abrirEnDrive = useCallback(async ({ id, nombre }: { id: string; nombre: string }) => {
    const c: fs.ConexionGuardada = { tipo: 'drive', id, nombre }
    await fs.guardarConexion(c)
    setConexion(c)
    await abrirCarpeta(new drive.CarpetaDrive(id, nombre))
  }, [abrirCarpeta])

  /** Vuelve a la pantalla de conexión para elegir otra carpeta (local o Drive) */
  const cambiarCarpeta = useCallback(() => {
    setError('')
    setFase('inicio')
  }, [])

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
          const mod = await fs.marcaDe(h, 'datos.sqlite')
          if (mod !== ultimoMod.current) throw new ConflictoError()
        }
        ultimoMod.current = await fs.escribirBytes(h, 'datos.sqlite', bd.exportar(db.current))
        setGuardado({ estado: 'guardado', hora: new Date() })
      } catch (e) {
        if (e instanceof drive.SesionCaducadaError) {
          setSesionCaducada(true)
          setGuardado({ estado: 'error', mensaje: 'Sin guardar: la sesión de Google ha caducado' })
        } else if (e instanceof ConflictoError) {
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
      if (!(e instanceof ConflictoError) && !(e instanceof drive.SesionCaducadaError)) throw e
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

  /** Renueva la sesión de Google (caduca cada hora) y guarda lo pendiente */
  const reconectar = useCallback(async () => {
    await drive.iniciarSesion()
    setSesionCaducada(false)
    try { await guardar() } catch { /* el estado ya muestra el error */ }
  }, [guardar])

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
    fase, error, nombreCarpeta, registros, guardado, conflicto, ivaPct, dirRaiz, sesionCaducada,
    carpetaGuardada: conexion ? { tipo: conexion.tipo, nombre: conexion.nombre } : null,
    origen: dirRaiz?.tipo ?? null,
    continuar, elegirOtra, cambiarCarpeta, buscarEnDrive, abrirEnDrive, reconectar,
    crearBDVacia, crear, actualizar, eliminar, resolverConflicto,
    listarCopias: listar, copiaAhora, restaurar,
  }), [fase, error, conexion, nombreCarpeta, registros, guardado, conflicto, ivaPct, dirRaiz, sesionCaducada,
    continuar, elegirOtra, cambiarCarpeta, buscarEnDrive, abrirEnDrive, reconectar,
    crearBDVacia, crear, actualizar, eliminar, resolverConflicto, listar, copiaAhora, restaurar])

  return <StoreCtx.Provider value={valor}>{children}</StoreCtx.Provider>
}
