// Esquema de datos.sqlite (versión 2). Se usa al crear una base de datos vacía y en la migración desde la versión 1.
// Copia legible en docs/esquema.sql.

export const VERSION_ESQUEMA = 2

export const ESTADOS = ['preparacion', 'pendiente_firma', 'firmado', 'tramitado'] as const

const fecha = (c: string) => `CHECK (${c} IS NULL OR (${c} GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]' AND date(${c}) IS NOT NULL))`

/** Tablas, sin datos (el nombre de la tabla de patrocinios se puede cambiar para la migración) */
export function tablasSQL(tablaPatrocinios = 'patrocinios'): string {
  return `
-- Entidades patrocinadas: una por CIF. Sus datos sirven para rellenar nuevos patrocinios.
CREATE TABLE IF NOT EXISTS entidades (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  clave_cif              TEXT NOT NULL UNIQUE CHECK (clave_cif <> ''),  -- CIF sin espacios ni guiones, solo para agrupar
  cif                    TEXT NOT NULL DEFAULT '',                      -- tal como se escribió la última vez
  nombre                 TEXT NOT NULL DEFAULT '',
  representante_legal    TEXT NOT NULL DEFAULT '',
  dni_nie_representante  TEXT NOT NULL DEFAULT '',
  telefono               TEXT NOT NULL DEFAULT '',
  email                  TEXT NOT NULL DEFAULT '',
  modificado             TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Un registro por expediente de patrocinio. La clave es «id»; el nº de contrato se reinicia cada año y puede repetirse.
-- Los datos de la entidad se copian en cada patrocinio: son los que se imprimen en sus documentos.
CREATE TABLE ${tablaPatrocinios} (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  estado                 TEXT NOT NULL DEFAULT 'preparacion'
                         CHECK (estado IN ('preparacion','pendiente_firma','firmado','tramitado')),
  entidad_id             INTEGER REFERENCES entidades(id) ON DELETE SET NULL,
  -- Entidad
  entidad                TEXT NOT NULL DEFAULT '',
  cif                    TEXT NOT NULL DEFAULT '',
  representante_legal    TEXT NOT NULL DEFAULT '',
  dni_nie_representante  TEXT NOT NULL DEFAULT '',
  telefono               TEXT NOT NULL DEFAULT '',
  email                  TEXT NOT NULL DEFAULT '',
  -- Evento
  anualidad              INTEGER CHECK (anualidad IS NULL OR anualidad BETWEEN 2000 AND 2100),
  evento                 TEXT NOT NULL DEFAULT '',
  fecha_celebracion      TEXT NOT NULL DEFAULT '',   -- texto que se imprime ("el 23 y 24 de septiembre de 2023")
  fecha_inicio           TEXT ${fecha('fecha_inicio')},
  fecha_fin              TEXT ${fecha('fecha_fin')},
  plazo_ejecucion        TEXT ${fecha('plazo_ejecucion')},
  municipios             TEXT NOT NULL DEFAULT '',
  soportes_cedidos       TEXT NOT NULL DEFAULT '',   -- uno por línea
  soportes_propios       TEXT NOT NULL DEFAULT '',   -- uno por línea
  soportes_enumerados    TEXT NOT NULL DEFAULT '',   -- en una frase
  -- Contrato e importes
  num_contrato           INTEGER CHECK (num_contrato IS NULL OR num_contrato > 0),
  importe_total          REAL NOT NULL DEFAULT 0 CHECK (importe_total >= 0),   -- IVA incluido
  iva_pct                REAL NOT NULL DEFAULT 21 CHECK (iva_pct >= 0 AND iva_pct < 100),
  importe_letra          TEXT NOT NULL DEFAULT '',   -- se genera a partir del importe
  importe_letra_sin_iva  TEXT NOT NULL DEFAULT '',   -- se genera a partir del importe y el IVA
  aplicacion             TEXT NOT NULL DEFAULT '',   -- 0000/0000/0000/00000
  importe_reding         REAL NOT NULL DEFAULT 0 CHECK (importe_reding >= 0),
  fecha_firma            TEXT ${fecha('fecha_firma')},
  -- Control
  creado                 TEXT NOT NULL DEFAULT (datetime('now')),
  modificado             TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (fecha_fin IS NULL OR fecha_inicio IS NULL OR fecha_fin >= fecha_inicio)
);

CREATE TABLE IF NOT EXISTS configuracion (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);
`
}

/** Mantiene la fecha de modificación aunque el archivo se edite fuera de la aplicación */
export const DISPARADORES_SQL = `
CREATE TRIGGER IF NOT EXISTS patrocinios_modificado AFTER UPDATE ON patrocinios
FOR EACH ROW WHEN NEW.modificado = OLD.modificado
BEGIN
  UPDATE patrocinios SET modificado = datetime('now') WHERE id = NEW.id;
END;
`

export const SCHEMA_SQL = `${tablasSQL()}
${DISPARADORES_SQL}
INSERT INTO configuracion(clave,valor) VALUES ('version_esquema','${VERSION_ESQUEMA}'), ('tipo_iva','21');
PRAGMA user_version = ${VERSION_ESQUEMA};
`
