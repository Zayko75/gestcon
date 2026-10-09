// Trabajo simultáneo sin servidor.
// Cada cambio es una operación con un id único. Antes de escribir datos.sqlite, la aplicación relee el archivo y
// aplica encima sus operaciones pendientes; así los cambios de varios usuarios se combinan en vez de pisarse.
// El id de cada operación queda anotado en el archivo (tabla «operaciones»): si un cambio se perdiera porque otro
// usuario escribió justo a la vez, la aplicación lo detecta en la siguiente lectura y lo vuelve a aplicar.
import type { Database } from 'sql.js'
import type { DatosPatrocinio } from '../types'
import * as bd from './db'

export type Operacion = { id: string; autor: string } & (
  | { tipo: 'insertar'; registro: number; datos: DatosPatrocinio }
  | { tipo: 'actualizar'; registro: number; cambios: Partial<DatosPatrocinio> }
  | { tipo: 'eliminar'; registro: number }
  | { tipo: 'config'; clave: string; valor: string | null }
  | { tipo: 'usuario'; registro: number; datos: bd.DatosUsuario | null; nuevo?: boolean }
)

export interface Resultado {
  /** Id con el que ha quedado un patrocinio o usuario nuevo, si es distinto del previsto (otro usuario usó ese id) */
  nuevoId?: number
  /** Algo que conviene contar al usuario */
  nota?: string
  /** La operación no se ha podido aplicar */
  error?: string
}

/** Campos que cambian entre dos versiones de los datos de un patrocinio */
export function diferencias(antes: DatosPatrocinio, despues: DatosPatrocinio): Partial<DatosPatrocinio> {
  const out: Partial<DatosPatrocinio> = {}
  for (const c of bd.CAMPOS) if (antes[c] !== despues[c]) (out as Record<string, unknown>)[c] = despues[c]
  return out
}

/** Solo los datos editables de un patrocinio */
export const datosDe = (p: DatosPatrocinio): DatosPatrocinio => Object.fromEntries(bd.CAMPOS.map((c) => [c, p[c]])) as unknown as DatosPatrocinio

function siguienteId(db: Database, tabla: 'patrocinios' | 'usuarios'): number {
  const max = Number(db.exec(`SELECT MAX(id) FROM ${tabla}`)[0]?.values[0][0] ?? 0)
  const seq = Number(db.exec(`SELECT seq FROM sqlite_sequence WHERE name='${tabla}'`)[0]?.values[0][0] ?? 0)
  return Math.max(max, seq) + 1
}

/** Id para un registro nuevo creado en esta ventana (el siguiente libre en la copia local) */
export const idNuevo = (db: Database, tabla: 'patrocinios' | 'usuarios') => siguienteId(db, tabla)

/** Aplica una operación sobre una base de datos. No lanza: devuelve el error si no se puede aplicar. */
export function aplicar(db: Database, op: Operacion): Resultado {
  if (bd.operacionAplicada(db, op.id)) return {}
  db.exec('SAVEPOINT op')
  try {
    let r: Resultado = {}
    switch (op.tipo) {
      case 'insertar': {
        const libre = !bd.patrocinio(db, op.registro)
        const id = libre ? op.registro : siguienteId(db, 'patrocinios')
        bd.insertar(db, op.datos, op.autor, id)
        if (id !== op.registro) r = { nuevoId: id }
        break
      }
      case 'actualizar': {
        const actual = bd.patrocinio(db, op.registro)
        if (!actual) { r = { error: 'Otro usuario ha eliminado este patrocinio; tus últimos cambios no se han guardado.' }; break }
        // Solo los campos que ha cambiado este usuario: los cambios de los demás en otros campos se conservan
        bd.actualizar(db, op.registro, { ...datosDe(actual), ...op.cambios }, op.autor)
        break
      }
      case 'eliminar':
        bd.eliminar(db, op.registro)
        break
      case 'config':
        bd.escribirConfig(db, op.clave, op.valor)
        break
      case 'usuario': {
        if (op.datos === null) { bd.borrarUsuario(db, op.registro); break }
        const existe = bd.listarUsuarios(db).some((u) => u.id === op.registro)
        if (!op.nuevo && !existe) { r = { error: 'Otro administrador ha eliminado este usuario.' }; break }
        // Un alta nueva cuyo id ya ha usado otro administrador recibe otro id
        const id = bd.guardarUsuario(db, op.datos, op.nuevo && existe ? undefined : op.registro)
        if (id !== op.registro) r = { nuevoId: id }
        break
      }
    }
    if (r.error) { db.exec('ROLLBACK TO op'); db.exec('RELEASE op'); return r }
    const registro = 'registro' in op ? (r.nuevoId ?? op.registro) : null
    bd.registrarOperacion(db, op.id, op.autor, op.tipo, registro)
    db.exec('RELEASE op')
    return r
  } catch (e) {
    db.exec('ROLLBACK TO op')
    db.exec('RELEASE op')
    return { error: e instanceof Error ? e.message : String(e) }
  }
}
