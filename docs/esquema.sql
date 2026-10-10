-- GESTCON · esquema SQLite, versión 4 (generado desde src/lib/schema.ts)
-- El archivo se guarda cifrado (ver src/lib/cifrado.ts). La aplicación actualiza sola las versiones anteriores, con copia previa.

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
CREATE TABLE patrocinios (
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
  fecha_inicio           TEXT CHECK (fecha_inicio IS NULL OR (fecha_inicio GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]' AND date(fecha_inicio) IS NOT NULL)),
  fecha_fin              TEXT CHECK (fecha_fin IS NULL OR (fecha_fin GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]' AND date(fecha_fin) IS NOT NULL)),
  plazo_ejecucion        TEXT CHECK (plazo_ejecucion IS NULL OR (plazo_ejecucion GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]' AND date(plazo_ejecucion) IS NOT NULL)),
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
  fecha_firma            TEXT CHECK (fecha_firma IS NULL OR (fecha_firma GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]' AND date(fecha_firma) IS NOT NULL)),
  -- Control
  creado                 TEXT NOT NULL DEFAULT (datetime('now')),
  modificado             TEXT NOT NULL DEFAULT (datetime('now')),
  creado_por             TEXT NOT NULL DEFAULT '',   -- nombre del usuario
  modificado_por         TEXT NOT NULL DEFAULT '',
  CHECK (fecha_fin IS NULL OR fecha_inicio IS NULL OR fecha_fin >= fecha_inicio)
);

CREATE TABLE IF NOT EXISTS configuracion (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);


-- Quién puede usar la aplicación y con qué rol. Se entra con «usuario» y contraseña.
-- La contraseña no se guarda: con ella se abre la llave del usuario (tabla «llaves»).
-- (email, clave_hash y clave_sal son de la versión 3 y ya no se usan.)
CREATE TABLE IF NOT EXISTS usuarios (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre         TEXT NOT NULL DEFAULT '',
  email          TEXT UNIQUE COLLATE NOCASE,
  usuario        TEXT UNIQUE COLLATE NOCASE,
  clave_hash     TEXT,                                  -- PBKDF2-SHA256, nunca la contraseña
  clave_sal      TEXT,
  cambiar_clave  INTEGER NOT NULL DEFAULT 0,            -- 1: debe cambiarla al entrar
  rol            TEXT NOT NULL DEFAULT 'consulta' CHECK (rol IN ('consulta','edicion','admin')),
  activo         INTEGER NOT NULL DEFAULT 1,
  creado         TEXT NOT NULL DEFAULT (datetime('now')),
  modificado     TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (email IS NOT NULL OR usuario IS NOT NULL)
);

-- Llave de cada usuario: la clave con la que se cifra el archivo, envuelta con su contraseña
-- (PBKDF2-SHA256 + AES-GCM). «titular» es «u:<id de usuario>» o «recuperacion» (código de recuperación).
-- Al guardar, las llaves de los usuarios activos se copian a la cabecera del archivo cifrado.
CREATE TABLE IF NOT EXISTS llaves (
  titular     TEXT PRIMARY KEY,
  sal         TEXT NOT NULL,
  iv          TEXT NOT NULL,
  envoltorio  TEXT NOT NULL
);

-- Cada cambio guardado lleva un identificador único. Sirve para comprobar que ningún cambio
-- se pierde cuando varios usuarios guardan a la vez. Se conservan 30 días.
CREATE TABLE IF NOT EXISTS operaciones (
  id        TEXT PRIMARY KEY,
  usuario   TEXT NOT NULL DEFAULT '',
  tipo      TEXT NOT NULL,
  registro  INTEGER,
  fecha     TEXT NOT NULL DEFAULT (datetime('now'))
);


CREATE TRIGGER IF NOT EXISTS patrocinios_modificado AFTER UPDATE ON patrocinios
FOR EACH ROW WHEN NEW.modificado = OLD.modificado
BEGIN
  UPDATE patrocinios SET modificado = datetime('now') WHERE id = NEW.id;
END;

INSERT INTO configuracion(clave,valor) VALUES ('version_esquema','4'), ('tipo_iva','21');
PRAGMA user_version = 4;

