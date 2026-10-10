import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Database } from 'sql.js'
import type { Copia, DatosPatrocinio, Entidad, InformeMigracion, Patrocinio, Rol, Usuario } from '../types'
import * as bd from './db'
import * as fs from './fs'
import * as drive from './drive'
import { VERSION_ESQUEMA } from './schema'
import { copiaDiaria, crearCopia, leerCopia, listarCopias } from './backups'
import { aplicar, idNuevo, type Operacion, type Resultado } from './operaciones'
import {
  nombreAutor, normalizarCodigo, normalizarUsuario, nuevoCodigoRecuperacion,
  nuevoIdOperacion, problemaClave, puede as puedeRol, SinPermisoError, type Accion,
} from './acceso'
import * as cif from './cifrado'
import { olvidarTodo as olvidarDeshacer } from './deshacer'

type Fase =
  | 'inicio' | 'cargando' | 'sin-bd' | 'error'
  /** Falta entrar con usuario y contraseña */
  | 'acceso'
  /** El archivo aún no está protegido: hay que crear el administrador (y se cifra) */
  | 'proteger'
  /** El usuario debe cambiar su contraseña antes de seguir */
  | 'cambiar-clave'
  | 'listo'
export type Origen = 'local' | 'drive'
type EstadoGuardado = { estado: 'guardado' | 'guardando' | 'error'; hora?: Date; mensaje?: string }

/** Cada cuánto se comprueba si otros usuarios han guardado cambios */
export const INTERVALO_SINCRONIZACION = 15_000

export interface DatosUsuarioForm {
  nombre: string
  usuario: string
  rol: Rol
  activo: boolean
  /** Contraseña nueva (vacía: no se cambia) */
  clave: string
}

interface Ctx {
  fase: Fase
  error: string
  carpetaGuardada: { tipo: Origen; nombre: string } | null
  nombreCarpeta: string
  origen: Origen | null
  sesionCaducada: boolean
  registros: Patrocinio[]
  entidades: Entidad[]
  informeMigracion: InformeMigracion | null
  cerrarInforme: () => void
  guardado: EstadoGuardado
  ivaPct: number
  config: Record<string, string>
  dirRaiz: fs.Carpeta | null
  // Usuarios y permisos
  usuario: Usuario | null
  usuarios: Usuario[]
  /** Ids de los usuarios que tienen contraseña (llave) */
  conClave: number[]
  /** Mensaje para la pantalla de acceso (p. ej. «tu usuario se ha desactivado») */
  avisoAcceso: string
  puede: (a: Accion) => boolean
  /** Ids de patrocinios nuevos que cambiaron al combinarse con los de otro usuario */
  remap: Record<number, number>
  ultimaSincronizacion: Date | null
  /** Código de recuperación recién creado, para enseñarlo una sola vez */
  codigoRecuperacion: string | null
  cerrarCodigo: () => void
  // Conexión
  continuar: () => Promise<void>
  elegirOtra: () => Promise<void>
  cambiarCarpeta: () => void
  buscarEnDrive: (nombre: string) => Promise<drive.CandidatoDrive[]>
  abrirEnDrive: (c: { id: string; nombre: string }) => Promise<void>
  reconectar: () => Promise<void>
  crearBDVacia: () => Promise<void>
  // Acceso
  entrar: (usuario: string, clave: string) => Promise<void>
  salir: () => void
  proteger: (d: { nombre: string; usuario: string; clave: string }) => Promise<string>
  /** Nombre del administrador que ya existía en el archivo sin proteger, para proponerlo */
  adminPropuesto: string
  recuperarClave: (usuario: string, codigo: string, nueva: string) => Promise<string>
  cambiarMiClave: (actual: string, nueva: string) => Promise<void>
  nuevoCodigo: () => Promise<string>
  guardarUsuario: (d: DatosUsuarioForm, id?: number) => Promise<string | null>
  borrarUsuario: (id: number) => Promise<string | null>
  // Datos
  crear: (d: DatosPatrocinio) => Promise<number>
  actualizar: (id: number, cambios: Partial<DatosPatrocinio>) => Promise<void>
  eliminar: (id: number) => Promise<void>
  guardarConfig: (clave: string, valor: string | null) => Promise<void>
  sincronizarAhora: () => Promise<void>
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

// Sesión de esta pestaña: se olvida al cerrarla (sessionStorage). Guarda la clave para no pedir la contraseña al recargar.
const CLAVE_SESION = 'gestcon-sesion'
function leerSesion(carpeta: string): { id: number; clave: Uint8Array } | null {
  try {
    const s = JSON.parse(sessionStorage.getItem(CLAVE_SESION) ?? 'null')
    return s && s.carpeta === carpeta && s.clave ? { id: Number(s.id), clave: cif.claveDatosDeB64(s.clave) } : null
  } catch { return null }
}
function guardarSesion(carpeta: string, id: number | null, clave?: Uint8Array | null) {
  try {
    if (id === null || !clave) sessionStorage.removeItem(CLAVE_SESION)
    else sessionStorage.setItem(CLAVE_SESION, JSON.stringify({ carpeta, id, clave: cif.claveDatosAB64(clave) }))
  } catch { /* sin almacenamiento: habrá que entrar en cada recarga */ }
}

const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms))
const llaveDeFila = (ll: cif.Llave): Omit<bd.FilaLlave, 'titular'> => ({ sal: ll.s, iv: ll.i, envoltorio: ll.k })

type OpNueva = Operacion extends infer T ? T extends Operacion ? Omit<T, 'id' | 'autor'> : never : never

export function StoreProvider({ children }: { children: ReactNode }) {
  const [fase, setFase] = useState<Fase>('inicio')
  const [error, setError] = useState('')
  const [conexion, setConexion] = useState<fs.ConexionGuardada | null>(null)
  const [sesionCaducada, setSesionCaducada] = useState(false)
  const [registros, setRegistros] = useState<Patrocinio[]>([])
  const [entidades, setEntidades] = useState<Entidad[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [conClave, setConClave] = useState<number[]>([])
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [avisoAcceso, setAvisoAcceso] = useState('')
  const [adminPropuesto, setAdminPropuesto] = useState('')
  const [informeMigracion, setInformeMigracion] = useState<InformeMigracion | null>(null)
  const [guardado, setGuardado] = useState<EstadoGuardado>({ estado: 'guardado' })
  const [ivaPct, setIvaPct] = useState(21)
  const [config, setConfig] = useState<Record<string, string>>({})
  const [dirRaiz, setDirRaiz] = useState<fs.Carpeta | null>(null)
  const [nombreCarpeta, setNombreCarpeta] = useState('')
  const [remap, setRemap] = useState<Record<number, number>>({})
  const [ultimaSincronizacion, setUltimaSincronizacion] = useState<Date | null>(null)
  const [codigoRecuperacion, setCodigoRecuperacion] = useState<string | null>(null)

  const handle = useRef<fs.Carpeta | null>(null)
  const db = useRef<Database | null>(null)
  const ultimoMod = useRef('')
  const cola = useRef<Promise<unknown>>(Promise.resolve())
  /** Operaciones aplicadas en esta ventana que aún no se han escrito en el archivo */
  const pendientes = useRef<Operacion[]>([])
  /** Operaciones escritas que aún no se ha comprobado que siguen en el archivo */
  const porConfirmar = useRef<Operacion[]>([])
  /** Usuario actual para la lógica (se actualiza siempre a la vez que el estado «usuario») */
  const usuarioRef = useRef<Usuario | null>(null)
  /** Clave de datos (solo en memoria mientras hay sesión). Con ella se cifra y descifra datos.sqlite. */
  const claveDatos = useRef<Uint8Array | null>(null)

  /** Abre los bytes del archivo: los descifra si están cifrados (hace falta haber entrado) */
  const abrirBytes = useCallback(async (bytes: Uint8Array) => {
    if (!cif.estaCifrado(bytes)) return bd.abrirBD(bytes)
    if (!claveDatos.current) throw new Error('Los datos están cifrados: entra con tu usuario y contraseña.')
    return bd.abrirBD(await cif.descifrar(bytes, claveDatos.current))
  }, [])

  /** Bytes para guardar: cifrados con las llaves de los usuarios activos (si ya hay clave de datos) */
  const serializar = useCallback((d: Database): Promise<Uint8Array> => {
    const plano = bd.exportar(d)
    return claveDatos.current ? cif.cifrar(plano, claveDatos.current, bd.llavesParaCabecera(d)) : Promise.resolve(plano)
  }, [])

  useEffect(() => {
    fs.cargarConexion().then(setConexion)
  }, [])

  const puede = useCallback((a: Accion) => puedeRol(usuarioRef.current?.rol, a), [])

  const refrescar = useCallback(() => {
    if (!db.current) return
    setRegistros(bd.listar(db.current))
    setEntidades(bd.listarEntidades(db.current))
    setConfig(bd.listarConfig(db.current))
    const us = bd.listarUsuarios(db.current)
    setUsuarios(us)
    setConClave(bd.listarLlaves(db.current).filter((l) => l.titular.startsWith('u:')).map((l) => Number(l.titular.slice(2))))
    // El usuario actual al día (otro administrador puede haber cambiado su rol o desactivarlo)
    const yo = usuarioRef.current ? us.find((u) => u.id === usuarioRef.current!.id) : undefined
    if (usuarioRef.current) {
      if (!yo || !yo.activo) {
        setUsuario(null); usuarioRef.current = null; claveDatos.current = null
        if (handle.current) guardarSesion(handle.current.nombre, null)
        setAvisoAcceso('Un administrador ha desactivado o eliminado tu usuario.')
        setFase('acceso')
      }
      else if (yo.rol !== usuarioRef.current.rol || yo.nombre !== usuarioRef.current.nombre) { setUsuario(yo); usuarioRef.current = yo }
    }
  }, [])

  const fallo = (e: unknown, prefijo = '') => {
    setError(prefijo + (e instanceof Error ? e.message : String(e)))
    setFase('error')
  }

  // ---------- Sincronización ----------
  /**
   * Lleva el archivo y esta ventana al mismo estado:
   *  1. Si el archivo ha cambiado (otro usuario guardó), lo descarga y aplica encima las operaciones pendientes
   *     de esta ventana, y las que se escribieron pero ya no están (se perdieron por escribir dos a la vez).
   *  2. Si hay operaciones pendientes, escribe el archivo.
   */
  const sincronizar = useCallback((): Promise<void> => {
    const tarea = cola.current.catch(() => undefined).then(async () => {
      const h = handle.current
      if (!h || !db.current) return
      const escribe = pendientes.current.length > 0
      if (escribe) setGuardado((g) => ({ ...g, estado: 'guardando' }))
      try {
        const marca = await fs.marcaDe(h, 'datos.sqlite')
        if (marca !== ultimoMod.current) {
          const { datos, marca: m2 } = await fs.leerBytes(h, 'datos.sqlite')
          const remota = await abrirBytes(datos)
          if (bd.versionEsquema(remota) < VERSION_ESQUEMA) bd.migrar(remota) // p. ej. alguien restauró una copia antigua
          // A partir de aquí, sin esperas: nadie puede añadir operaciones en medio
          const perdidas = porConfirmar.current.filter((op) => !bd.operacionAplicada(remota, op.id))
          porConfirmar.current = []
          const aplicar_ = [...perdidas, ...pendientes.current]
          const errores: string[] = []
          const cambiosId: Record<number, number> = {}
          const quedan: Operacion[] = []
          for (const op of aplicar_) {
            const r: Resultado = aplicar(remota, op)
            if (r.error) { errores.push(r.error); continue }
            if (r.nuevoId !== undefined && op.tipo === 'insertar') cambiosId[op.registro] = r.nuevoId
            quedan.push(op)
          }
          db.current?.close()
          db.current = remota
          ultimoMod.current = m2
          pendientes.current = quedan
          if (Object.keys(cambiosId).length) setRemap((x) => ({ ...x, ...cambiosId }))
          if (errores.length) setGuardado({ estado: 'error', mensaje: errores[0] })
          refrescar()
        } else if (!escribe) {
          porConfirmar.current = [] // el archivo sigue siendo el que escribimos: todo confirmado
        }
        if (pendientes.current.length) {
          if (!puedeRol(usuarioRef.current?.rol, 'editar') && !pendientes.current.every((o) => o.tipo === 'usuario')) {
            pendientes.current = []
          } else {
            const lote = pendientes.current
            pendientes.current = []
            try {
              ultimoMod.current = await fs.escribirBytes(h, 'datos.sqlite', await serializar(db.current!))
            } catch (e) {
              pendientes.current = [...lote, ...pendientes.current]
              throw e
            }
            porConfirmar.current.push(...lote)
            setGuardado((g) => (g.estado === 'error' && !escribe ? g : { estado: 'guardado', hora: new Date() }))
          }
        } else if (escribe) {
          setGuardado((g) => (g.estado === 'error' ? g : { estado: 'guardado', hora: new Date() }))
        }
        setUltimaSincronizacion(new Date())
        setSesionCaducada(false)
      } catch (e) {
        if (e instanceof drive.SesionCaducadaError) {
          setSesionCaducada(true)
          if (pendientes.current.length) setGuardado({ estado: 'error', mensaje: 'Sin guardar: la sesión de Google ha caducado' })
        } else if (pendientes.current.length) {
          setGuardado({ estado: 'error', mensaje: 'No se pudo guardar: ' + (e instanceof Error ? e.message : String(e)) + '. Se reintentará.' })
        }
        throw e
      }
    })
    cola.current = tarea
    return tarea
  }, [refrescar, abrirBytes, serializar])

  /** Aplica un cambio en esta ventana al momento y lo guarda en el archivo */
  const ejecutar = useCallback(async (op: OpNueva, accion: Accion | null = 'editar'): Promise<Resultado> => {
    if (!db.current) throw new Error('No hay base de datos abierta')
    if (accion && !puedeRol(usuarioRef.current?.rol, accion)) throw new SinPermisoError(accion)
    const o = { ...op, id: nuevoIdOperacion(), autor: usuarioRef.current ? nombreAutor(usuarioRef.current) : '' } as Operacion
    const r = aplicar(db.current, o)
    if (r.error) throw new Error(r.error)
    pendientes.current.push(o)
    refrescar()
    try {
      await sincronizar()
    } catch (e) {
      if (!(e instanceof drive.SesionCaducadaError)) console.warn('Guardado pendiente', e)
    }
    return r
  }, [refrescar, sincronizar])

  // Comprobación periódica de cambios de otros usuarios
  useEffect(() => {
    if (fase !== 'listo') return
    const tick = () => {
      if (document.visibilityState !== 'visible' || sesionCaducada) return
      sincronizar().catch(() => undefined)
    }
    const t = window.setInterval(tick, INTERVALO_SINCRONIZACION)
    window.addEventListener('focus', tick)
    return () => { window.clearInterval(t); window.removeEventListener('focus', tick) }
  }, [fase, sincronizar, sesionCaducada])

  // ---------- Apertura de la carpeta e identidad ----------
  const terminarApertura = useCallback(async (u: Usuario) => {
    setUsuario(u)
    usuarioRef.current = u
    setAvisoAcceso('')
    const h = handle.current!
    guardarSesion(h.nombre, u.id, claveDatos.current)
    if (u.cambiar_clave) { setFase('cambiar-clave'); return }
    // Copia automática: una al día, la primera vez que la abre alguien que puede escribir
    if (puedeRol(u.rol, 'editar')) {
      try {
        await copiaDiaria(await fs.subcarpeta(h, 'backups'), await serializar(db.current!))
      } catch (e) {
        console.warn('No se pudo crear la copia automática', e)
      }
    }
    refrescar()
    setGuardado({ estado: 'guardado' })
    setFase('listo')
  }, [refrescar, serializar])

  /**
   * Con la clave de datos ya conocida: descifra el archivo, lo actualiza si es de una versión anterior y
   * entra con el usuario indicado. Devuelve false si ese usuario no existe o está desactivado.
   */
  const abrirComo = useCallback(async (bytes: Uint8Array, marca: string, usuarioId: number): Promise<boolean> => {
    const h = handle.current!
    const nueva = await abrirBytes(bytes)
    db.current?.close()
    db.current = nueva
    ultimoMod.current = marca
    pendientes.current = []
    porConfirmar.current = []
    if (bd.versionEsquema(nueva) < VERSION_ESQUEMA) {
      await crearCopia(await fs.subcarpeta(h, 'backups'), bytes, 'antes-de-actualizar')
      const informe = bd.migrar(nueva)
      ultimoMod.current = await fs.escribirBytes(h, 'datos.sqlite', await serializar(nueva))
      if (informe) setInformeMigracion(informe)
    }
    setIvaPct(Number(bd.leerConfig(nueva, 'tipo_iva', '21')) || 21)
    const yo = bd.listarUsuarios(nueva).find((u) => u.id === usuarioId)
    if (!yo || !yo.activo || !yo.usuario) return false
    refrescar()
    await terminarApertura(yo)
    return true
  }, [abrirBytes, serializar, refrescar, terminarApertura])

  /** Abre datos.sqlite de la carpeta y pide entrar (o proteger el archivo si aún no está cifrado) */
  const abrirCarpeta = useCallback(async (h: fs.Carpeta) => {
    setFase('cargando')
    setError('')
    try {
      handle.current = h
      setDirRaiz(h)
      setNombreCarpeta(h.nombre)
      setSesionCaducada(false)
      setUsuario(null)
      usuarioRef.current = null
      claveDatos.current = null
      pendientes.current = []
      porConfirmar.current = []
      if (!(await fs.existe(h, 'datos.sqlite'))) {
        setFase('sin-bd')
        return
      }
      const { datos, marca } = await fs.leerBytes(h, 'datos.sqlite')
      if (cif.estaCifrado(datos)) {
        // Al recargar la pestaña no se vuelve a pedir la contraseña
        const sesion = leerSesion(h.nombre)
        if (sesion) {
          claveDatos.current = sesion.clave
          try {
            if (await abrirComo(datos, marca, sesion.id)) return
          } catch { /* la sesión ya no vale */ }
          claveDatos.current = null
          guardarSesion(h.nombre, null)
        }
        setFase('acceso')
        return
      }
      // Archivo sin proteger (de una versión anterior o recién creado): se actualiza y se pide crear el administrador
      const nueva = await bd.abrirBD(datos)
      db.current?.close()
      db.current = nueva
      ultimoMod.current = marca
      if (bd.versionEsquema(nueva) < VERSION_ESQUEMA) {
        try {
          await crearCopia(await fs.subcarpeta(h, 'backups'), datos, 'antes-de-actualizar')
        } catch (e) {
          throw new Error('Para proteger los datos hay que poder escribir en la carpeta. (' + (e instanceof Error ? e.message : String(e)) + ')')
        }
        const informe = bd.migrar(nueva)
        if (informe) setInformeMigracion(informe)
      }
      setIvaPct(Number(bd.leerConfig(nueva, 'tipo_iva', '21')) || 21)
      const admin = bd.listarUsuarios(nueva).find((u) => u.rol === 'admin' && u.activo)
      setAdminPropuesto(admin?.nombre ?? '')
      refrescar()
      setFase('proteger')
    } catch (e) {
      fallo(e)
    }
  }, [refrescar, abrirComo])

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

  const cambiarCarpeta = useCallback(() => {
    // Lo que quede por guardar se intenta guardar antes de salir
    sincronizar().catch(() => undefined).finally(() => { claveDatos.current = null })
    if (handle.current) guardarSesion(handle.current.nombre, null)
    olvidarDeshacer()
    setError('')
    setUsuario(null)
    usuarioRef.current = null
    setFase('inicio')
  }, [sincronizar])

  const crearBDVacia = useCallback(async () => {
    const h = handle.current
    if (!h) return
    const nueva = await bd.nuevaBD()
    await fs.escribirBytes(h, 'datos.sqlite', bd.exportar(nueva))
    nueva.close()
    await abrirCarpeta(h)
  }, [abrirCarpeta])

  // ---------- Acceso con usuario y contraseña ----------
  const entrar = useCallback(async (nombre: string, clave: string) => {
    const h = handle.current
    if (!h) throw new Error('No hay ninguna carpeta abierta.')
    const { datos, marca } = await fs.leerBytes(h, 'datos.sqlite') // siempre el archivo al día
    const r = await cif.entrarCon(datos, normalizarUsuario(nombre), clave)
    if (!r) {
      await pausa(500) // frena los intentos repetidos
      throw new Error('Usuario o contraseña incorrectos.')
    }
    claveDatos.current = r.claveDatos
    if (!(await abrirComo(datos, marca, Number(r.titular.slice(2))))) {
      claveDatos.current = null
      throw new Error('Este usuario está desactivado. Habla con un administrador.')
    }
  }, [abrirComo])

  const salir = useCallback(() => {
    const h = handle.current
    // Lo pendiente se guarda antes de olvidar la clave
    sincronizar().catch(() => undefined).finally(() => {
      claveDatos.current = null
      db.current?.close()
      db.current = null
    })
    if (h) guardarSesion(h.nombre, null)
    olvidarDeshacer() // el siguiente usuario no puede deshacer lo que hizo el anterior
    // El siguiente usuario empieza en el listado, no en la última pantalla del anterior
    if (location.hash && location.hash !== '#/') location.hash = '#/'
    setUsuario(null)
    usuarioRef.current = null
    setRegistros([]); setEntidades([]); setUsuarios([])
    setAvisoAcceso('')
    setFase('acceso')
  }, [sincronizar])

  /** Crea un código de recuperación nuevo (el anterior deja de valer) y lo muestra una vez */
  const guardarRecuperacion = useCallback(async (): Promise<string> => {
    const codigo = nuevoCodigoRecuperacion()
    const ll = await cif.envolver(claveDatos.current!, normalizarCodigo(codigo), 'recuperacion', '')
    await ejecutar({ tipo: 'llave', titular: 'recuperacion', llave: llaveDeFila(ll) }, null)
    setCodigoRecuperacion(codigo)
    return codigo
  }, [ejecutar])

  /** Protege un archivo sin cifrar: crea el administrador con contraseña y cifra los datos */
  const proteger = useCallback(async (d: { nombre: string; usuario: string; clave: string }) => {
    if (!db.current) throw new Error('No hay datos abiertos.')
    if (!d.nombre.trim()) throw new Error('Escribe tu nombre.')
    const usuarioN = normalizarUsuario(d.usuario)
    if (!usuarioN) throw new Error('Escribe un nombre de usuario.')
    const p = problemaClave(d.clave)
    if (p) throw new Error(p)
    const lista = bd.listarUsuarios(db.current)
    if (lista.some((u) => u.usuario?.toLowerCase() === usuarioN && !(u.rol === 'admin' && u.activo))) throw new Error('Ya hay otro usuario con ese nombre de usuario.')
    claveDatos.current = cif.nuevaClaveDatos()
    // Si ya había un administrador (de la versión anterior), se completa ese; si no, se crea
    const existente = lista.find((u) => u.rol === 'admin' && u.activo && (!u.usuario || u.usuario.toLowerCase() === usuarioN))
    const id = existente?.id ?? idNuevo(db.current, 'usuarios')
    usuarioRef.current = { id, nombre: d.nombre.trim(), usuario: usuarioN, rol: 'admin' } as Usuario
    const ll = await cif.envolver(claveDatos.current, d.clave, `u:${id}`, usuarioN)
    try {
      await ejecutar({
        tipo: 'usuario', registro: id, nuevo: !existente, llave: llaveDeFila(ll),
        datos: { nombre: d.nombre.trim(), email: existente?.email ?? null, usuario: usuarioN, clave_hash: null, clave_sal: null, cambiar_clave: 0, rol: 'admin', activo: 1 },
      }, null)
      const codigo = await guardarRecuperacion()
      // Comprueba que el archivo ha quedado cifrado y que la contraseña lo abre
      const { datos } = await fs.leerBytes(handle.current!, 'datos.sqlite')
      if (!cif.estaCifrado(datos) || !(await cif.entrarCon(datos, usuarioN, d.clave))) throw new Error('No se pudo guardar el archivo cifrado. Vuelve a intentarlo.')
      // La copia de seguridad que había (sin cifrar) se sustituye por una cifrada
      await crearCopia(await fs.subcarpeta(handle.current!, 'backups'), datos, 'protegido')
      const yo = bd.listarUsuarios(db.current).find((u) => u.usuario?.toLowerCase() === usuarioN)!
      setInformeMigracion((x) => (x ? { ...x, usuarios: true } : { desde: VERSION_ESQUEMA, hasta: VERSION_ESQUEMA, entidades: 0, fechasDeducidas: 0, cambiosTexto: [], usuarios: true }))
      await terminarApertura(yo)
      return codigo
    } catch (e) {
      claveDatos.current = null
      usuarioRef.current = null
      throw e
    }
  }, [ejecutar, guardarRecuperacion, terminarApertura])

  const recuperarClave = useCallback(async (nombre: string, codigo: string, nueva: string) => {
    const h = handle.current
    if (!h) throw new Error('No hay ninguna carpeta abierta.')
    const p = problemaClave(nueva)
    if (p) throw new Error(p)
    const { datos, marca } = await fs.leerBytes(h, 'datos.sqlite')
    const clave = await cif.entrarConCodigo(datos, normalizarCodigo(codigo))
    if (!clave) { await pausa(500); throw new Error('El código de recuperación no es válido.') }
    claveDatos.current = clave
    const tmp = await abrirBytes(datos)
    const u = bd.listarUsuarios(tmp).find((x) => x.usuario?.toLowerCase() === normalizarUsuario(nombre) && x.rol === 'admin' && x.activo)
    tmp.close()
    if (!u) { claveDatos.current = null; throw new Error('El código solo sirve para un usuario administrador activo. Revisa el nombre de usuario.') }
    // Entra como ese administrador, le pone la contraseña nueva y renueva el código (el usado deja de valer)
    if (!(await abrirComo(datos, marca, u.id))) { claveDatos.current = null; throw new Error('No se pudo entrar con ese usuario.') }
    const ll = await cif.envolver(clave, nueva, `u:${u.id}`, u.usuario!.toLowerCase())
    await ejecutar({ tipo: 'usuario', registro: u.id, llave: llaveDeFila(ll), datos: { ...u, cambiar_clave: 0 } }, null)
    const yo = bd.listarUsuarios(db.current!).find((x) => x.id === u.id)!
    setUsuario(yo); usuarioRef.current = yo
    guardarSesion(h.nombre, yo.id, clave)
    setFase('listo')
    return guardarRecuperacion()
  }, [abrirBytes, abrirComo, ejecutar, guardarRecuperacion])

  const cambiarMiClave = useCallback(async (actual: string, nueva: string) => {
    const u = bd.listarUsuarios(db.current!).find((x) => x.id === usuarioRef.current?.id)
    if (!u || !claveDatos.current) throw new Error('No hay ningún usuario con la sesión iniciada.')
    const mia = bd.listarLlaves(db.current!).find((l) => l.titular === `u:${u.id}`)
    const ok = mia ? await cif.desenvolver({ t: mia.titular, u: '', s: mia.sal, i: mia.iv, k: mia.envoltorio }, actual) : null
    if (!ok) throw new Error('La contraseña actual no es correcta.')
    const p = problemaClave(nueva)
    if (p) throw new Error(p)
    if (actual === nueva) throw new Error('La contraseña nueva debe ser distinta de la actual.')
    const ll = await cif.envolver(claveDatos.current, nueva, `u:${u.id}`, (u.usuario ?? '').toLowerCase())
    await ejecutar({ tipo: 'usuario', registro: u.id, llave: llaveDeFila(ll), datos: { ...u, cambiar_clave: 0 } }, null)
    const yo = bd.listarUsuarios(db.current!).find((x) => x.id === u.id)!
    if (fase === 'cambiar-clave') await terminarApertura(yo)
    else { setUsuario(yo); usuarioRef.current = yo }
  }, [ejecutar, terminarApertura, fase])

  const nuevoCodigo = useCallback(async () => {
    if (!puedeRol(usuarioRef.current?.rol, 'administrar')) throw new SinPermisoError('administrar')
    return guardarRecuperacion()
  }, [guardarRecuperacion])

  // ---------- Mantenimiento de usuarios (administradores) ----------
  /** Da de alta o modifica un usuario */
  const guardarUsuario = useCallback(async (d: DatosUsuarioForm, id?: number): Promise<string | null> => {
    if (!puedeRol(usuarioRef.current?.rol, 'administrar')) throw new SinPermisoError('administrar')
    const lista = bd.listarUsuarios(db.current!)
    const antes = id !== undefined ? lista.find((u) => u.id === id) : undefined
    const usuarioN = normalizarUsuario(d.usuario)
    const tieneLlave = id !== undefined && bd.listarLlaves(db.current!).some((l) => l.titular === `u:${id}`)
    if (!d.nombre.trim()) throw new Error('Escribe el nombre.')
    if (!usuarioN) throw new Error('Escribe el nombre de usuario con el que entrará.')
    if (lista.some((u) => u.id !== id && u.usuario?.toLowerCase() === usuarioN)) throw new Error('Ya hay otro usuario con ese nombre de usuario.')
    if (!tieneLlave && !d.clave) throw new Error('Escribe una contraseña inicial.')
    if (d.clave) { const p = problemaClave(d.clave); if (p) throw new Error(p) }
    // Que siempre quede al menos un administrador activo
    const quedanAdmins = lista.filter((u) => u.id !== id && u.rol === 'admin' && u.activo).length
    if (antes?.rol === 'admin' && antes.activo && (d.rol !== 'admin' || !d.activo) && quedanAdmins === 0) throw new Error('Tiene que quedar al menos un administrador activo.')
    if (id === usuarioRef.current?.id && !d.activo) throw new Error('No puedes desactivar tu propio usuario.')
    const datos: bd.DatosUsuario = {
      nombre: d.nombre.trim(), email: antes?.email ?? null, usuario: usuarioN, clave_hash: null, clave_sal: null,
      // Una contraseña puesta por un administrador se cambia al entrar (salvo la propia)
      cambiar_clave: d.clave && id !== usuarioRef.current?.id ? 1 : antes?.cambiar_clave ?? 0,
      rol: d.rol, activo: d.activo ? 1 : 0,
    }
    const registro = id ?? idNuevo(db.current!, 'usuarios')
    const llave = d.clave ? llaveDeFila(await cif.envolver(claveDatos.current!, d.clave, `u:${registro}`, usuarioN)) : undefined
    await ejecutar({ tipo: 'usuario', registro, nuevo: id === undefined, datos, llave }, 'administrar')
    return null
  }, [ejecutar])

  const borrarUsuario = useCallback(async (id: number): Promise<string | null> => {
    if (!puedeRol(usuarioRef.current?.rol, 'administrar')) throw new SinPermisoError('administrar')
    const lista = bd.listarUsuarios(db.current!)
    const u = lista.find((x) => x.id === id)
    if (!u) return null
    if (id === usuarioRef.current?.id) throw new Error('No puedes eliminar tu propio usuario.')
    if (u.rol === 'admin' && u.activo && lista.filter((x) => x.rol === 'admin' && x.activo).length <= 1) throw new Error('Tiene que quedar al menos un administrador activo.')
    await ejecutar({ tipo: 'usuario', registro: id, datos: null }, 'administrar')
    return null
  }, [ejecutar])

  // ---------- Datos ----------
  const crear = useCallback(async (d: DatosPatrocinio) => {
    const registro = idNuevo(db.current!, 'patrocinios')
    await ejecutar({ tipo: 'insertar', registro, datos: d })
    return registro
  }, [ejecutar])
  const actualizar = useCallback(async (id: number, cambios: Partial<DatosPatrocinio>) => {
    if (!Object.keys(cambios).length) return
    await ejecutar({ tipo: 'actualizar', registro: id, cambios })
  }, [ejecutar])
  const eliminar = useCallback(async (id: number) => { await ejecutar({ tipo: 'eliminar', registro: id }, 'administrar') }, [ejecutar])
  const guardarConfig = useCallback(async (clave: string, valor: string | null) => {
    await ejecutar({ tipo: 'config', clave, valor }, 'administrar')
  }, [ejecutar])

  /** Renueva la sesión de Google (caduca cada hora) y guarda lo pendiente */
  const reconectar = useCallback(async () => {
    await drive.iniciarSesion()
    setSesionCaducada(false)
    try { await sincronizar() } catch { /* el estado ya muestra el error */ }
  }, [sincronizar])

  // ---------- Copias de seguridad ----------
  const listar = useCallback(async () => {
    if (!handle.current) return []
    return listarCopias(await fs.subcarpeta(handle.current, 'backups'))
  }, [])

  const copiaAhora = useCallback(async (motivo = 'manual') => {
    if (!handle.current || !db.current) return
    if (!puedeRol(usuarioRef.current?.rol, motivo === 'manual' ? 'administrar' : 'editar')) throw new SinPermisoError('administrar')
    await crearCopia(await fs.subcarpeta(handle.current, 'backups'), await serializar(db.current), motivo)
  }, [serializar])

  const restaurar = useCallback(async (nombre: string) => {
    const h = handle.current
    if (!h || !db.current) return
    if (!puedeRol(usuarioRef.current?.rol, 'administrar')) throw new SinPermisoError('administrar')
    await sincronizar().catch(() => undefined)
    const dirB = await fs.subcarpeta(h, 'backups')
    const bytes = await leerCopia(dirB, nombre)
    const copia = await abrirBytes(bytes) // valida antes de tocar nada
    if (bd.versionEsquema(copia) < VERSION_ESQUEMA) bd.migrar(copia)
    // Se recuperan los datos, pero no los usuarios ni las contraseñas de entonces: el acceso sigue como ahora
    bd.copiarAcceso(db.current, copia)
    await crearCopia(dirB, await serializar(db.current), 'antes-de-restaurar')
    ultimoMod.current = await fs.escribirBytes(h, 'datos.sqlite', await serializar(copia))
    db.current.close()
    db.current = copia
    pendientes.current = []
    porConfirmar.current = []
    olvidarDeshacer()
    refrescar()
  }, [abrirBytes, serializar, sincronizar, refrescar])

  // Aviso al cerrar si queda algo por guardar
  useEffect(() => {
    const f = (e: BeforeUnloadEvent) => {
      if (guardado.estado !== 'guardado' || pendientes.current.length) e.preventDefault()
    }
    window.addEventListener('beforeunload', f)
    return () => window.removeEventListener('beforeunload', f)
  }, [guardado.estado])

  const sincronizarAhora = useCallback(() => sincronizar().catch(() => undefined), [sincronizar])

  const valor = useMemo<Ctx>(() => ({
    fase, error, nombreCarpeta, registros, entidades, informeMigracion, cerrarInforme: () => setInformeMigracion(null), guardado, ivaPct, config, dirRaiz, sesionCaducada,
    carpetaGuardada: conexion ? { tipo: conexion.tipo, nombre: conexion.nombre } : null,
    origen: dirRaiz?.tipo ?? null,
    usuario, usuarios, conClave, avisoAcceso, adminPropuesto, puede, remap, ultimaSincronizacion, codigoRecuperacion, cerrarCodigo: () => setCodigoRecuperacion(null),
    continuar, elegirOtra, cambiarCarpeta, buscarEnDrive, abrirEnDrive, reconectar, crearBDVacia,
    entrar, salir, proteger, recuperarClave, cambiarMiClave, nuevoCodigo, guardarUsuario, borrarUsuario,
    crear, actualizar, eliminar, guardarConfig, sincronizarAhora,
    listarCopias: listar, copiaAhora, restaurar,
  }), [fase, error, conexion, nombreCarpeta, registros, entidades, informeMigracion, guardado, ivaPct, config, dirRaiz, sesionCaducada,
    usuario, usuarios, conClave, avisoAcceso, adminPropuesto, puede, remap, ultimaSincronizacion, codigoRecuperacion,
    continuar, elegirOtra, cambiarCarpeta, buscarEnDrive, abrirEnDrive, reconectar, crearBDVacia,
    entrar, salir, proteger, recuperarClave, cambiarMiClave, nuevoCodigo, guardarUsuario, borrarUsuario,
    crear, actualizar, eliminar, guardarConfig, sincronizarAhora, listar, copiaAhora, restaurar])

  return <StoreCtx.Provider value={valor}>{children}</StoreCtx.Provider>
}
