import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import { DISPARADORES_SQL, SCHEMA_SQL, USUARIOS_SQL, VERSION_ESQUEMA, tablasSQL } from './schema'
import { claveCif, fechasDeTexto, letraCoherente } from './textos'
import { importeSinIva } from './format'
import type { DatosPatrocinio, Entidad, InformeMigracion, Patrocinio, Usuario } from '../types'

let sqlPromise: Promise<SqlJsStatic> | null = null
export function sql(): Promise<SqlJsStatic> {
  return (sqlPromise ??= initSqlJs({ locateFile: () => wasmUrl }))
}

export const CAMPOS: (keyof DatosPatrocinio)[] = [
  'estado', 'entidad', 'cif', 'representante_legal', 'dni_nie_representante', 'telefono', 'email',
  'anualidad', 'evento', 'fecha_celebracion', 'fecha_inicio', 'fecha_fin', 'plazo_ejecucion', 'municipios',
  'soportes_cedidos', 'soportes_propios', 'soportes_enumerados',
  'num_contrato', 'importe_total', 'iva_pct', 'importe_letra', 'importe_letra_sin_iva', 'aplicacion',
  'importe_reding', 'fecha_firma',
]

/** Traduce el error de una regla de la base de datos a un mensaje para el usuario */
function mensajeRegla(e: unknown): Error {
  const m = e instanceof Error ? e.message : String(e)
  if (/CHECK constraint failed/i.test(m)) {
    if (/fecha_fin >= fecha_inicio/.test(m)) return new Error('La fecha de fin del evento es anterior a la de inicio.')
    if (/importe/.test(m)) return new Error('Los importes no pueden ser negativos.')
    if (/anualidad/.test(m)) return new Error('La anualidad debe ser un año entre 2000 y 2100.')
    if (/num_contrato/.test(m)) return new Error('El nº de contrato debe ser mayor que cero.')
    if (/iva_pct/.test(m)) return new Error('El tipo de IVA debe estar entre 0 y 100.')
    if (/fecha|plazo/.test(m)) return new Error('Alguna fecha no es válida.')
    return new Error('Algún dato no cumple las reglas de la base de datos.')
  }
  return e instanceof Error ? e : new Error(m)
}

export function versionEsquema(db: Database): number {
  return Number(db.exec('PRAGMA user_version')[0]?.values[0][0] ?? 0)
}

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
  if (versionEsquema(db) > VERSION_ESQUEMA) {
    db.close()
    throw new Error('Este datos.sqlite es de una versión más nueva de la aplicación. Recarga la página (Ctrl + F5) para usar la última versión.')
  }
  db.exec('PRAGMA foreign_keys = ON')
  return db
}

export async function nuevaBD(): Promise<Database> {
  const SQL = await sql()
  const db = new SQL.Database()
  db.exec(SCHEMA_SQL)
  db.exec('PRAGMA foreign_keys = ON')
  return db
}

export function exportar(db: Database): Uint8Array {
  return db.export()
}

function filas<T>(db: Database, consulta: string, params: (string | number | null)[] = []): T[] {
  const stmt = db.prepare(consulta)
  stmt.bind(params)
  const out: T[] = []
  while (stmt.step()) out.push(stmt.getAsObject() as unknown as T)
  stmt.free()
  return out
}

export function listar(db: Database): Patrocinio[] {
  return filas<Patrocinio>(db, 'SELECT * FROM patrocinios ORDER BY id')
}

export function listarEntidades(db: Database): Entidad[] {
  return filas<Entidad>(db, 'SELECT * FROM entidades ORDER BY nombre COLLATE NOCASE')
}

/** Crea o actualiza la entidad del CIF y devuelve su id (null si no hay CIF) */
function guardarEntidad(db: Database, d: DatosPatrocinio, actualizarDatos: boolean): number | null {
  const clave = claveCif(d.cif)
  if (!clave) return null
  const existe = filas<{ id: number }>(db, 'SELECT id FROM entidades WHERE clave_cif=?', [clave])[0]
  const valores = [d.cif, d.entidad, d.representante_legal, d.dni_nie_representante, d.telefono, d.email]
  if (!existe) {
    db.run(`INSERT INTO entidades (clave_cif, cif, nombre, representante_legal, dni_nie_representante, telefono, email)
            VALUES (?,?,?,?,?,?,?)`, [clave, ...valores])
    return Number(db.exec('SELECT last_insert_rowid()')[0].values[0][0])
  }
  if (actualizarDatos) {
    db.run(`UPDATE entidades SET cif=?, nombre=?, representante_legal=?, dni_nie_representante=?, telefono=?, email=?,
            modificado=datetime('now') WHERE id=?`, [...valores, existe.id])
  }
  return existe.id
}

/** Crea un patrocinio. Con «id» se usa ese identificador (al combinar cambios de varios usuarios). */
export function insertar(db: Database, d: DatosPatrocinio, autor = '', id?: number): number {
  try {
    const entidadId = guardarEntidad(db, d, true)
    const extra = ['entidad_id', 'creado_por', 'modificado_por', ...(id !== undefined ? ['id'] : [])]
    const cols = [...CAMPOS, ...extra].join(',')
    const marcas = [...CAMPOS, ...extra].map(() => '?').join(',')
    db.run(`INSERT INTO patrocinios (${cols}) VALUES (${marcas})`, [...CAMPOS.map((c) => d[c]), entidadId, autor, autor, ...(id !== undefined ? [id] : [])] as any[])
    return Number(db.exec('SELECT last_insert_rowid()')[0].values[0][0])
  } catch (e) {
    throw mensajeRegla(e)
  }
}

export function actualizar(db: Database, id: number, d: DatosPatrocinio, autor = ''): void {
  try {
    // Los datos de la entidad solo se actualizan desde su patrocinio más reciente,
    // para que corregir un expediente antiguo no deshaga datos más nuevos.
    const clave = claveCif(d.cif)
    const ultimo = clave
      ? filas<{ m: number | null }>(db, `SELECT MAX(p.id) AS m FROM patrocinios p JOIN entidades e ON e.id = p.entidad_id WHERE e.clave_cif = ?`, [clave])[0]?.m
      : null
    const entidadId = guardarEntidad(db, d, ultimo === null || ultimo === undefined || id >= ultimo)
    const set = CAMPOS.map((c) => `${c}=?`).join(',')
    db.run(`UPDATE patrocinios SET ${set}, entidad_id=?, modificado=datetime('now'), modificado_por=? WHERE id=?`, [...CAMPOS.map((c) => d[c]), entidadId, autor, id] as any[])
  } catch (e) {
    throw mensajeRegla(e)
  }
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

/** Toda la configuración (tipo de IVA, créditos por aplicación, límite del contrato menor…) */
export function listarConfig(db: Database): Record<string, string> {
  const r = db.exec('SELECT clave, valor FROM configuracion')
  return Object.fromEntries((r[0]?.values ?? []).map(([k, v]) => [String(k), String(v)]))
}

/** Guarda un valor de configuración; con null se borra */
export function escribirConfig(db: Database, clave: string, valor: string | null): void {
  if (valor === null) db.run('DELETE FROM configuracion WHERE clave=?', [clave])
  else db.run('INSERT INTO configuracion(clave,valor) VALUES (?,?) ON CONFLICT(clave) DO UPDATE SET valor=excluded.valor', [clave, valor])
}

/** Un patrocinio por id, o null si no existe */
export function patrocinio(db: Database, id: number): Patrocinio | null {
  return filas<Patrocinio>(db, 'SELECT * FROM patrocinios WHERE id=?', [id])[0] ?? null
}

// ---------- Usuarios ----------
export function listarUsuarios(db: Database): Usuario[] {
  try {
    return filas<Usuario>(db, 'SELECT * FROM usuarios ORDER BY activo DESC, nombre COLLATE NOCASE')
  } catch {
    return [] // archivo anterior a la versión 3
  }
}

export type DatosUsuario = Omit<Usuario, 'id' | 'creado' | 'modificado'>

/** Crea (sin id) o actualiza un usuario. Devuelve su id. */
export function guardarUsuario(db: Database, u: DatosUsuario, id?: number): number {
  const cols = ['nombre', 'email', 'usuario', 'clave_hash', 'clave_sal', 'cambiar_clave', 'rol', 'activo'] as const
  const vals = cols.map((c) => u[c]) as (string | number | null)[]
  try {
    if (id === undefined || !filas(db, 'SELECT 1 FROM usuarios WHERE id=?', [id]).length) {
      db.run(`INSERT INTO usuarios (${[...cols, ...(id !== undefined ? ['id'] : [])].join(',')}) VALUES (${[...cols, ...(id !== undefined ? ['id'] : [])].map(() => '?').join(',')})`,
        [...vals, ...(id !== undefined ? [id] : [])])
      return id ?? Number(db.exec('SELECT last_insert_rowid()')[0].values[0][0])
    }
    db.run(`UPDATE usuarios SET ${cols.map((c) => `${c}=?`).join(',')}, modificado=datetime('now') WHERE id=?`, [...vals, id])
    return id
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e)
    if (/UNIQUE.*email/i.test(m)) throw new Error('Ya hay otro usuario con esa cuenta de Google.')
    if (/UNIQUE.*usuario/i.test(m)) throw new Error('Ya hay otro usuario con ese nombre de usuario.')
    throw e
  }
}

export function borrarUsuario(db: Database, id: number): void {
  db.run('DELETE FROM usuarios WHERE id=?', [id])
}

// ---------- Registro de operaciones ----------
export function operacionAplicada(db: Database, id: string): boolean {
  return filas(db, 'SELECT 1 FROM operaciones WHERE id=?', [id]).length > 0
}

export function registrarOperacion(db: Database, id: string, usuario: string, tipo: string, registro: number | null): void {
  db.run('INSERT OR IGNORE INTO operaciones (id, usuario, tipo, registro) VALUES (?,?,?,?)', [id, usuario, tipo, registro])
}

/** Borra del registro las operaciones de hace más de 30 días */
export function podarOperaciones(db: Database): void {
  db.run("DELETE FROM operaciones WHERE fecha < datetime('now', '-30 days')")
}

// ---------- Migraciones ----------

/** Actualiza el archivo a la última versión del esquema. Devuelve null si ya estaba al día. */
export function migrar(db: Database): InformeMigracion | null {
  const desde = versionEsquema(db) || 1
  if (desde >= VERSION_ESQUEMA) return null
  const informe: InformeMigracion = { desde, hasta: VERSION_ESQUEMA, entidades: 0, fechasDeducidas: 0, cambiosTexto: [] }
  db.exec('PRAGMA foreign_keys = OFF')
  db.exec('BEGIN')
  try {
    if (desde < 2) migrarA2(db, informe)
    if (desde < 3) migrarA3(db, informe)
    db.exec(`INSERT INTO configuracion(clave,valor) VALUES ('version_esquema','${VERSION_ESQUEMA}')
             ON CONFLICT(clave) DO UPDATE SET valor=excluded.valor`)
    db.exec(`PRAGMA user_version = ${VERSION_ESQUEMA}`)
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    throw new Error('No se pudo actualizar la base de datos a la versión nueva: ' + (e instanceof Error ? e.message : String(e)))
  } finally {
    db.exec('PRAGMA foreign_keys = ON')
  }
  db.exec('VACUUM') // compacta el archivo
  return informe
}

/** Versión 2 → 3: usuarios, registro de operaciones y autor de cada cambio */
function migrarA3(db: Database, informe: InformeMigracion): void {
  const columnas = filas<{ name: string }>(db, 'PRAGMA table_info(patrocinios)').map((c) => c.name)
  if (!columnas.includes('creado_por')) db.exec("ALTER TABLE patrocinios ADD COLUMN creado_por TEXT NOT NULL DEFAULT ''")
  if (!columnas.includes('modificado_por')) db.exec("ALTER TABLE patrocinios ADD COLUMN modificado_por TEXT NOT NULL DEFAULT ''")
  db.exec(USUARIOS_SQL)
  informe.usuarios = true
}

/** Versión 1 (migración desde Access) → 2 */
function migrarA2(db: Database, informe: InformeMigracion): void {
  const iva = Number(leerConfig(db, 'tipo_iva', '21')) || 21
  const secuencia = filas<{ seq: number }>(db, "SELECT seq FROM sqlite_sequence WHERE name='patrocinios'")[0]?.seq ?? 0

  // Lo que ya no se usa: vista con el IVA fijo e índices (la aplicación filtra en memoria)
  db.exec(`DROP VIEW IF EXISTS v_patrocinios;
    DROP INDEX IF EXISTS idx_patrocinios_entidad; DROP INDEX IF EXISTS idx_patrocinios_anualidad;
    DROP INDEX IF EXISTS idx_patrocinios_contrato; DROP INDEX IF EXISTS idx_patrocinios_tramitado;`)

  db.exec(tablasSQL('patrocinios_v2'))
  db.exec(`INSERT INTO patrocinios_v2 (id, estado, entidad, cif, representante_legal, dni_nie_representante, telefono, email,
      anualidad, evento, fecha_celebracion, plazo_ejecucion, municipios, soportes_cedidos, soportes_propios, soportes_enumerados,
      num_contrato, importe_total, iva_pct, importe_letra, importe_letra_sin_iva, aplicacion, importe_reding, fecha_firma, creado, modificado)
    SELECT id, CASE WHEN tramitado = 1 THEN 'tramitado' ELSE 'preparacion' END, entidad, cif, representante_legal, dni_nie_representante,
      telefono, email, anualidad, evento, fecha_celebracion, plazo_ejecucion, municipios, soportes_cedidos, soportes_propios,
      soportes_enumerados, num_contrato, importe_total, ${iva}, importe_letra, importe_letra_sin_iva, aplicacion, importe_reding,
      fecha_firma, creado, modificado
    FROM patrocinios ORDER BY id`)

  const registros = filas<Patrocinio>(db, 'SELECT * FROM patrocinios_v2 ORDER BY id')
  for (const p of registros) {
    // Importe en letra: se conserva el texto si dice el mismo importe; si no, se corrige
    const cambios: [string, string][] = []
    if (p.importe_total > 0) {
      const letra = letraCoherente(p.importe_letra, p.importe_total)
      if (letra !== p.importe_letra) {
        cambios.push(['importe_letra', letra])
        informe.cambiosTexto.push({ id: p.id, campo: 'Importe en letra', antes: p.importe_letra, despues: letra })
      }
      const sinIva = importeSinIva(p.importe_total, p.iva_pct)
      const letraSin = letraCoherente(p.importe_letra_sin_iva, sinIva)
      if (letraSin !== p.importe_letra_sin_iva) {
        cambios.push(['importe_letra_sin_iva', letraSin])
        informe.cambiosTexto.push({ id: p.id, campo: 'Importe sin IVA en letra', antes: p.importe_letra_sin_iva, despues: letraSin })
      }
    }
    // Fechas reales deducidas del texto de celebración (el texto no cambia)
    const f = fechasDeTexto(p.fecha_celebracion, p.anualidad)
    if (f) {
      cambios.push(['fecha_inicio', f.inicio], ['fecha_fin', f.fin])
      informe.fechasDeducidas++
    }
    if (cambios.length) {
      db.run(`UPDATE patrocinios_v2 SET ${cambios.map(([c]) => `${c}=?`).join(',')} WHERE id=?`, [...cambios.map(([, v]) => v), p.id])
    }
    // Entidades: una por CIF, con los datos de su patrocinio más reciente
    const d = p as unknown as DatosPatrocinio
    const entidadId = guardarEntidad(db, d, true)
    if (entidadId !== null) db.run('UPDATE patrocinios_v2 SET entidad_id=? WHERE id=?', [entidadId, p.id])
  }
  informe.entidades = Number(db.exec('SELECT COUNT(*) FROM entidades')[0].values[0][0])

  db.exec('DROP TABLE patrocinios')
  db.exec('ALTER TABLE patrocinios_v2 RENAME TO patrocinios')
  // Conserva el contador de ids para no reutilizar los de patrocinios eliminados
  db.run("UPDATE sqlite_sequence SET seq = MAX(seq, ?) WHERE name='patrocinios'", [secuencia])
  db.exec(DISPARADORES_SQL)
}
