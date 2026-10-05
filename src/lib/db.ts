import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import { SCHEMA_SQL } from './schema'
import type { DatosPatrocinio, Patrocinio } from '../types'

let sqlPromise: Promise<SqlJsStatic> | null = null
export function sql(): Promise<SqlJsStatic> {
  return (sqlPromise ??= initSqlJs({ locateFile: () => wasmUrl }))
}

export const CAMPOS: (keyof DatosPatrocinio)[] = [
  'tramitado', 'entidad', 'cif', 'representante_legal', 'dni_nie_representante', 'telefono', 'email',
  'anualidad', 'evento', 'fecha_celebracion', 'plazo_ejecucion', 'municipios',
  'soportes_cedidos', 'soportes_propios', 'soportes_enumerados',
  'num_contrato', 'importe_total', 'importe_letra', 'importe_letra_sin_iva', 'aplicacion',
  'importe_reding', 'fecha_firma',
]

export async function abrirBD(bytes: Uint8Array): Promise<Database> {
  const SQL = await sql()
  const db = new SQL.Database(bytes)
  try {
    const r = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='patrocinios'")
    if (!r.length) throw new Error('El archivo no es una base de datos de GESTCON (falta la tabla «patrocinios»).')
  } catch (e) {
    db.close()
    if (e instanceof Error && e.message.startsWith('El archivo')) throw e
    throw new Error('El archivo datos.sqlite no se puede leer: no parece una base de datos válida.')
  }
  return db
}

export async function nuevaBD(): Promise<Database> {
  const SQL = await sql()
  const db = new SQL.Database()
  db.exec(SCHEMA_SQL)
  return db
}

export function exportar(db: Database): Uint8Array {
  return db.export()
}

export function listar(db: Database): Patrocinio[] {
  const stmt = db.prepare('SELECT * FROM patrocinios ORDER BY id')
  const out: Patrocinio[] = []
  while (stmt.step()) out.push(stmt.getAsObject() as unknown as Patrocinio)
  stmt.free()
  return out
}

export function insertar(db: Database, d: DatosPatrocinio): number {
  const cols = CAMPOS.join(',')
  const marcas = CAMPOS.map(() => '?').join(',')
  db.run(`INSERT INTO patrocinios (${cols}) VALUES (${marcas})`, CAMPOS.map((c) => d[c]) as any[])
  const r = db.exec('SELECT last_insert_rowid()')
  return Number(r[0].values[0][0])
}

export function actualizar(db: Database, id: number, d: DatosPatrocinio): void {
  const set = CAMPOS.map((c) => `${c}=?`).join(',')
  db.run(`UPDATE patrocinios SET ${set}, modificado=datetime('now') WHERE id=?`, [...CAMPOS.map((c) => d[c]), id] as any[])
}

export function eliminar(db: Database, id: number): void {
  db.run('DELETE FROM patrocinios WHERE id=?', [id])
}

export function leerConfig(db: Database, clave: string, defecto: string): string {
  try {
    const stmt = db.prepare('SELECT valor FROM configuracion WHERE clave=?')
    stmt.bind([clave])
    const v = stmt.step() ? String(stmt.get()[0]) : defecto
    stmt.free()
    return v
  } catch {
    return defecto
  }
}
