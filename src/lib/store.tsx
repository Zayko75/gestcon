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
  CLAVE_RECUPERACION, cifrarClave, claveCorrecta, nombreAutor, normalizarCodigo, normalizarUsuario, nuevoCodigoRecuperacion,
  nuevoIdOperacion, permisoDrive, problemaClave, puede as puedeRol, SinPermisoError, type Accion,
} from './acceso'

type Fase =
  | 'inicio' | 'cargando' | 'sin-bd' | 'error'
  /** Carpeta de red: falta iniciar sesión con usuario y contraseña */
  | 'acceso'
  /** No hay ningún usuario: hay que crear el primer administrador */
  | 'primer-admin'
  /** La cuenta no está dada de alta o está desactivada */
  | 'sin-acceso'
  /** El usuario debe cambiar su contraseña antes de seguir */
  | 'cambiar-clave'
  | 'listo'
export type Origen = 'local' | 'drive'
type EstadoGuardado = { estado: 'guardado' | 'guardando' | 'error'; hora?: Date; mensaje?: string }

/** Cada cuánto se comprueba si otros usuarios han guardado cambios */
export const INTERVALO_SINCRONIZACION = 15_000

export interface DatosUsuarioForm {
  nombre: string
  email: string
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
  /** Cuenta de Google con la que se ha entrado (aunque no tenga acceso) */
  emailGoogle: string
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
  crearPrimerAdmin: (d: { nombre: string; usuario: string; clave: string }) => Promise<string>
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

const CLAVE_SESION = 'gestcon-sesion'
function leerSesion(carpeta: string): number | null {
  try {
    const s = JSON.parse(sessionStorage.getItem(CLAVE_SESION) ?? 'null')
    return s && s.carpeta === carpeta ? Number(s.id) : null
  } catch { return null }
}
function guardarSesion(carpeta: string, id: number | null) {
  try {
    if (id === null) sessionStorage.removeItem(CLAVE_SESION)
    else sessionStorage.setItem(CLAVE_SESION, JSON.stringify({ carpeta, id }))
  } catch { /* sin almacenamiento: habrá que entrar en cada recarga */ }
}

type OpNueva = Operacion extends infer T ? T extends Operacion ? Omit<T, 'id' | 'autor'> : never : never

export function StoreProvider({ children }: { children: ReactNode }) {
  const [fase, setFase] = useState<Fase>('inicio')
  const [error, setError] = useState('')
  const [conexion, setConexion] = useState<fs.ConexionGuardada | null>(null)
  const [sesionCaducada, setSesionCaducada] = useState(false)
  const [registros, setRegistros] = useState<Patrocinio[]>([])
  const [entidades, setEntidades] = useState<Entidad[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [emailGoogle, setEmailGoogle] = useState('')
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
    // El usuario actual al día (otro administrador puede haber cambiado su rol o desactivarlo)
    const yo = usuarioRef.current ? us.find((u) => u.id === usuarioRef.current!.id) : undefined
    if (usuarioRef.current) {
      if (!yo || !yo.activo) { setUsuario(null); usuarioRef.current = null; setFase('sin-acceso') }
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
          const remota = await bd.abrirBD(datos)
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
              ultimoMod.current = await fs.escribirBytes(h, 'datos.sqlite', bd.exportar(db.current!))
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
  }, [refrescar])

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
    const h = handle.current!
    guardarSesion(h.nombre, u.id)
    if (u.cambiar_clave && u.usuario) { setFase('cambiar-clave'); return }
    // Copia automática: una al día, la primera vez que la abre alguien que puede escribir
    if (puedeRol(u.rol, 'editar')) {
      try {
        await copiaDiaria(await fs.subcarpeta(h, 'backups'), bd.exportar(db.current!))
      } catch (e) {
        console.warn('No se pudo crear la copia automática', e)
      }
    }
    refrescar()
    setGuardado({ estado: 'guardado' })
    setFase('listo')
  }, [refrescar])

  /** Decide quién es el usuario: cuenta de Google (Drive) o usuario y contraseña (carpeta) */
  const identificar = useCallback(async () => {
    const h = handle.current!
    const us = bd.listarUsuarios(db.current!)
    if (h.tipo === 'drive') {
      const g = await drive.usuarioGoogle()
      setEmailGoogle(g.email)
      if (us.length === 0) {
        // Primera vez con control de acceso: quien abre la carpeta (su propietario) es el administrador
        const id = idNuevo(db.current!, 'usuarios')
        usuarioRef.current = { id, nombre: g.nombre || g.email, email: g.email, rol: 'admin' } as Usuario
        await ejecutar({ tipo: 'usuario', registro: id, nuevo: true, datos: { nombre: g.nombre || g.email, email: g.email, usuario: null, clave_hash: null, clave_sal: null, cambiar_clave: 0, rol: 'admin', activo: 1 } }, null)
        const yo = bd.listarUsuarios(db.current!).find((u) => u.email?.toLowerCase() === g.email)!
        setInformeMigracion((x) => ({ ...(x ?? { desde: VERSION_ESQUEMA, hasta: VERSION_ESQUEMA, entidades: 0, fechasDeducidas: 0, cambiosTexto: [] }), usuarios: true }))
        await terminarApertura(yo)
        return
      }
      const yo = us.find((u) => u.email?.toLowerCase() === g.email)
      if (!yo || !yo.activo) { refrescar(); setFase('sin-acceso'); return }
      await terminarApertura(yo)
      return
    }
    // Carpeta del ordenador o de red
    if (us.length === 0) { setFase('primer-admin'); return }
    if (!us.some((u) => u.usuario && u.clave_hash && u.activo)) { setFase('sin-acceso'); return }
    const recordado = leerSesion(h.nombre)
    const yo = recordado !== null ? us.find((u) => u.id === recordado && u.activo && u.usuario) : undefined
    if (yo) { await terminarApertura(yo); return }
    setFase('acceso')
  }, [ejecutar, refrescar, terminarApertura])

  /** Abre datos.sqlite de la carpeta, lo actualiza si es de una versión anterior e identifica al usuario */
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
      pendientes.current = []
      porConfirmar.current = []
      if (!(await fs.existe(h, 'datos.sqlite'))) {
        setFase('sin-bd')
        return
      }
      const { datos, marca } = await fs.leerBytes(h, 'datos.sqlite')
      const nueva = await bd.abrirBD(datos)
      db.current?.close()
      db.current = nueva
      ultimoMod.current = marca
      // Archivo de una versión anterior: copia de seguridad y actualización automática
      if (bd.versionEsquema(nueva) < VERSION_ESQUEMA) {
        try {
          await crearCopia(await fs.subcarpeta(h, 'backups'), datos, 'antes-de-actualizar')
          const informe = bd.migrar(nueva)
          ultimoMod.current = await fs.escribirBytes(h, 'datos.sqlite', bd.exportar(nueva))
          if (informe) setInformeMigracion(informe)
        } catch (e) {
          throw new Error('Hay que actualizar datos.sqlite a la versión nueva y tu cuenta no puede modificar la carpeta. Ábrela primero con una cuenta de administrador. (' + (e instanceof Error ? e.message : String(e)) + ')')
        }
      }
      setIvaPct(Number(bd.leerConfig(nueva, 'tipo_iva', '21')) || 21)
      refrescar()
      await identificar()
    } catch (e) {
      fallo(e)
    }
  }, [refrescar, identificar])

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
    sincronizar().catch(() => undefined)
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

  // ---------- Acceso con usuario y contraseña (carpeta de red) ----------
  const entrar = useCallback(async (nombre: string, clave: string) => {
    await sincronizar().catch(() => undefined) // por si un administrador acaba de cambiar los usuarios
    const u = bd.listarUsuarios(db.current!).find((x) => x.usuario?.toLowerCase() === normalizarUsuario(nombre))
    const ok = u && u.activo ? await claveCorrecta(clave, u.clave_hash, u.clave_sal) : false
    if (!u || !ok) {
      await new Promise((r) => setTimeout(r, 600)) // frena los intentos repetidos
      throw new Error(u && !u.activo ? 'Este usuario está desactivado. Habla con un administrador.' : 'Usuario o contraseña incorrectos.')
    }
    await terminarApertura(u)
  }, [terminarApertura, sincronizar])

  const salir = useCallback(() => {
    sincronizar().catch(() => undefined)
    if (handle.current) guardarSesion(handle.current.nombre, null)
    // El siguiente usuario empieza en el listado, no en la última pantalla del anterior
    if (location.hash && location.hash !== '#/') location.hash = '#/'
    setUsuario(null)
    usuarioRef.current = null
    if (handle.current?.tipo === 'drive') {
      drive.cerrarSesion()
      setFase('inicio')
    } else {
      setFase('acceso')
    }
  }, [sincronizar])

  const guardarRecuperacion = useCallback(async (): Promise<string> => {
    const codigo = nuevoCodigoRecuperacion()
    const c = await cifrarClave(normalizarCodigo(codigo))
    await ejecutar({ tipo: 'config', clave: CLAVE_RECUPERACION, valor: `${c.clave_sal}:${c.clave_hash}` }, null)
    setCodigoRecuperacion(codigo)
    return codigo
  }, [ejecutar])

  const crearPrimerAdmin = useCallback(async (d: { nombre: string; usuario: string; clave: string }) => {
    await sincronizar().catch(() => undefined) // por si un administrador acaba de cambiar los usuarios
    if (bd.listarUsuarios(db.current!).length) throw new Error('Ya hay usuarios: entra con el tuyo.')
    const p = problemaClave(d.clave)
    if (p) throw new Error(p)
    const usuarioN = normalizarUsuario(d.usuario)
    if (!usuarioN) throw new Error('Escribe un nombre de usuario.')
    const id = idNuevo(db.current!, 'usuarios')
    usuarioRef.current = { id, nombre: d.nombre, usuario: usuarioN, rol: 'admin' } as Usuario
    await ejecutar({ tipo: 'usuario', registro: id, nuevo: true, datos: { nombre: d.nombre.trim(), email: null, usuario: usuarioN, ...(await cifrarClave(d.clave)), cambiar_clave: 0, rol: 'admin', activo: 1 } }, null)
    const codigo = await guardarRecuperacion()
    const yo = bd.listarUsuarios(db.current!).find((u) => u.usuario === usuarioN)!
    await terminarApertura(yo)
    return codigo
  }, [ejecutar, guardarRecuperacion, terminarApertura, sincronizar])

  const recuperarClave = useCallback(async (nombre: string, codigo: string, nueva: string) => {
    await sincronizar().catch(() => undefined) // por si un administrador acaba de cambiar los usuarios
    const u = bd.listarUsuarios(db.current!).find((x) => x.usuario?.toLowerCase() === normalizarUsuario(nombre))
    const guardadoRec = bd.leerConfig(db.current!, CLAVE_RECUPERACION, '')
    const [sal, hash] = guardadoRec.split(':')
    const ok = !!u && u.rol === 'admin' && !!u.activo && await claveCorrecta(normalizarCodigo(codigo), hash ?? null, sal ?? null)
    if (!ok) {
      await new Promise((r) => setTimeout(r, 600))
      throw new Error('El código de recuperación no es válido para ese usuario. Solo sirve para administradores.')
    }
    const p = problemaClave(nueva)
    if (p) throw new Error(p)
    usuarioRef.current = u!
    await ejecutar({ tipo: 'usuario', registro: u!.id, datos: { ...u!, ...(await cifrarClave(nueva)), cambiar_clave: 0 } }, null)
    const codigoNuevo = await guardarRecuperacion() // el código usado deja de valer
    await terminarApertura(bd.listarUsuarios(db.current!).find((x) => x.id === u!.id)!)
    return codigoNuevo
  }, [ejecutar, guardarRecuperacion, terminarApertura, sincronizar])

  const cambiarMiClave = useCallback(async (actual: string, nueva: string) => {
    const u = bd.listarUsuarios(db.current!).find((x) => x.id === usuarioRef.current?.id)
    if (!u) throw new Error('No hay ningún usuario con la sesión iniciada.')
    if (!(await claveCorrecta(actual, u.clave_hash, u.clave_sal))) throw new Error('La contraseña actual no es correcta.')
    const p = problemaClave(nueva)
    if (p) throw new Error(p)
    if (actual === nueva) throw new Error('La contraseña nueva debe ser distinta de la actual.')
    await ejecutar({ tipo: 'usuario', registro: u.id, datos: { ...u, ...(await cifrarClave(nueva)), cambiar_clave: 0 } }, null)
    const yo = bd.listarUsuarios(db.current!).find((x) => x.id === u.id)!
    if (fase === 'cambiar-clave') await terminarApertura(yo)
    else { setUsuario(yo); usuarioRef.current = yo }
  }, [ejecutar, terminarApertura, fase])

  const nuevoCodigo = useCallback(async () => {
    if (!puedeRol(usuarioRef.current?.rol, 'administrar')) throw new SinPermisoError('administrar')
    return guardarRecuperacion()
  }, [guardarRecuperacion])

  // ---------- Mantenimiento de usuarios (administradores) ----------
  /** Da de alta o modifica un usuario. Devuelve un aviso si no se pudo ajustar el permiso de la carpeta de Drive. */
  const guardarUsuario = useCallback(async (d: DatosUsuarioForm, id?: number): Promise<string | null> => {
    if (!puedeRol(usuarioRef.current?.rol, 'administrar')) throw new SinPermisoError('administrar')
    const lista = bd.listarUsuarios(db.current!)
    const antes = id !== undefined ? lista.find((u) => u.id === id) : undefined
    const email = d.email.trim().toLowerCase() || null
    const usuarioN = normalizarUsuario(d.usuario) || null
    if (!d.nombre.trim()) throw new Error('Escribe el nombre.')
    if (!email && !usuarioN) throw new Error('Indica una cuenta de Google, un nombre de usuario o los dos.')
    if (usuarioN && !antes?.clave_hash && !d.clave) throw new Error('Para entrar con usuario y contraseña, escribe una contraseña inicial.')
    if (d.clave) { const p = problemaClave(d.clave); if (p) throw new Error(p) }
    // Que siempre quede al menos un administrador activo
    const quedanAdmins = lista.filter((u) => u.id !== id && u.rol === 'admin' && u.activo).length
    if (antes?.rol === 'admin' && antes.activo && (d.rol !== 'admin' || !d.activo) && quedanAdmins === 0) throw new Error('Tiene que quedar al menos un administrador activo.')
    if (id === usuarioRef.current?.id && !d.activo) throw new Error('No puedes desactivar tu propio usuario.')
    const clave = d.clave ? await cifrarClave(d.clave) : { clave_hash: antes?.clave_hash ?? null, clave_sal: antes?.clave_sal ?? null }
    const datos: bd.DatosUsuario = {
      nombre: d.nombre.trim(), email, usuario: usuarioN, ...clave,
      // Una contraseña puesta por un administrador se cambia al entrar (salvo la propia)
      cambiar_clave: d.clave && id !== usuarioRef.current?.id ? 1 : antes?.cambiar_clave ?? 0,
      rol: d.rol, activo: d.activo ? 1 : 0,
    }
    const registro = id ?? idNuevo(db.current!, 'usuarios')
    await ejecutar({ tipo: 'usuario', registro, nuevo: id === undefined, datos }, 'administrar')
    if (handle.current?.tipo !== 'drive') return null
    // Con Google Drive, el rol se refleja en el permiso de la carpeta: lector (consulta) o editor
    const carpetaId = (handle.current as drive.CarpetaDrive).id
    const avisos: string[] = []
    try {
      if (antes?.email && antes.email.toLowerCase() !== email) await drive.ajustarPermisoCarpeta(carpetaId, antes.email, null)
      if (email) {
        await drive.ajustarPermisoCarpeta(carpetaId, email, d.activo ? permisoDrive(d.rol) : null,
          `Te han dado acceso a GESTCON (${d.rol === 'consulta' ? 'consulta' : d.rol === 'edicion' ? 'edición' : 'administración'}). Abre la aplicación y conecta con Google Drive.`)
      }
    } catch (e) {
      avisos.push(`El usuario se ha guardado, pero no se pudo ajustar el permiso de la carpeta en Google Drive (${e instanceof Error ? e.message : String(e)}). Compártela a mano con ${email} como ${d.rol === 'consulta' ? 'lector' : 'editor'}.`)
    }
    return avisos[0] ?? null
  }, [ejecutar])

  const borrarUsuario = useCallback(async (id: number): Promise<string | null> => {
    if (!puedeRol(usuarioRef.current?.rol, 'administrar')) throw new SinPermisoError('administrar')
    const lista = bd.listarUsuarios(db.current!)
    const u = lista.find((x) => x.id === id)
    if (!u) return null
    if (id === usuarioRef.current?.id) throw new Error('No puedes eliminar tu propio usuario.')
    if (u.rol === 'admin' && u.activo && lista.filter((x) => x.rol === 'admin' && x.activo).length <= 1) throw new Error('Tiene que quedar al menos un administrador activo.')
    await ejecutar({ tipo: 'usuario', registro: id, datos: null }, 'administrar')
    if (handle.current?.tipo === 'drive' && u.email) {
      try {
        await drive.ajustarPermisoCarpeta((handle.current as drive.CarpetaDrive).id, u.email, null)
      } catch (e) {
        return `Usuario eliminado, pero no se pudo quitar su permiso en Google Drive (${e instanceof Error ? e.message : String(e)}). Quítalo a mano en «Compartir» de la carpeta.`
      }
    }
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
    await crearCopia(await fs.subcarpeta(handle.current, 'backups'), bd.exportar(db.current), motivo)
  }, [])

  const restaurar = useCallback(async (nombre: string) => {
    const h = handle.current
    if (!h || !db.current) return
    if (!puedeRol(usuarioRef.current?.rol, 'administrar')) throw new SinPermisoError('administrar')
    await sincronizar().catch(() => undefined)
    const dirB = await fs.subcarpeta(h, 'backups')
    const bytes = await leerCopia(dirB, nombre)
    const prueba = await bd.abrirBD(bytes) // valida antes de tocar nada
    prueba.close()
    await crearCopia(dirB, bd.exportar(db.current), 'antes-de-restaurar')
    await fs.escribirBytes(h, 'datos.sqlite', bytes)
    await abrirCarpeta(h)
  }, [abrirCarpeta, sincronizar])

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
    usuario, usuarios, emailGoogle, puede, remap, ultimaSincronizacion, codigoRecuperacion, cerrarCodigo: () => setCodigoRecuperacion(null),
    continuar, elegirOtra, cambiarCarpeta, buscarEnDrive, abrirEnDrive, reconectar, crearBDVacia,
    entrar, salir, crearPrimerAdmin, recuperarClave, cambiarMiClave, nuevoCodigo, guardarUsuario, borrarUsuario,
    crear, actualizar, eliminar, guardarConfig, sincronizarAhora,
    listarCopias: listar, copiaAhora, restaurar,
  }), [fase, error, conexion, nombreCarpeta, registros, entidades, informeMigracion, guardado, ivaPct, config, dirRaiz, sesionCaducada,
    usuario, usuarios, emailGoogle, puede, remap, ultimaSincronizacion, codigoRecuperacion,
    continuar, elegirOtra, cambiarCarpeta, buscarEnDrive, abrirEnDrive, reconectar, crearBDVacia,
    entrar, salir, crearPrimerAdmin, recuperarClave, cambiarMiClave, nuevoCodigo, guardarUsuario, borrarUsuario,
    crear, actualizar, eliminar, guardarConfig, sincronizarAhora, listar, copiaAhora, restaurar])

  return <StoreCtx.Provider value={valor}>{children}</StoreCtx.Provider>
}
