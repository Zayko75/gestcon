-- GESTCON · esquema SQLite (compatible con sql.js)
PRAGMA foreign_keys = OFF;

CREATE TABLE patrocinios (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  tramitado              INTEGER NOT NULL DEFAULT 0 CHECK (tramitado IN (0,1)),
  -- Entidad
  entidad                TEXT NOT NULL DEFAULT '',
  cif                    TEXT NOT NULL DEFAULT '',
  representante_legal    TEXT NOT NULL DEFAULT '',
  dni_nie_representante  TEXT NOT NULL DEFAULT '',
  telefono               TEXT NOT NULL DEFAULT '',
  email                  TEXT NOT NULL DEFAULT '',
  -- Evento
  anualidad              INTEGER,
  evento                 TEXT NOT NULL DEFAULT '',
  fecha_celebracion      TEXT NOT NULL DEFAULT '',   -- texto libre ("el 23 y 24 de septiembre de 2023")
  plazo_ejecucion        TEXT,                       -- fecha ISO AAAA-MM-DD
  municipios             TEXT NOT NULL DEFAULT '',
  soportes_cedidos       TEXT NOT NULL DEFAULT '',   -- multilínea
  soportes_propios       TEXT NOT NULL DEFAULT '',   -- multilínea
  soportes_enumerados    TEXT NOT NULL DEFAULT '',
  -- Económicos
  num_contrato           INTEGER,
  importe_total          REAL NOT NULL DEFAULT 0,    -- IVA incluido, 2 decimales
  importe_letra          TEXT NOT NULL DEFAULT '',
  importe_letra_sin_iva  TEXT NOT NULL DEFAULT '',
  aplicacion             TEXT NOT NULL DEFAULT '',   -- 0000/0000/0000/00000
  importe_reding         REAL NOT NULL DEFAULT 0,
  fecha_firma            TEXT,                       -- fecha ISO AAAA-MM-DD
  -- Control
  creado                 TEXT NOT NULL DEFAULT (datetime('now')),
  modificado             TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_patrocinios_entidad   ON patrocinios(entidad);
CREATE INDEX idx_patrocinios_anualidad ON patrocinios(anualidad);
CREATE INDEX idx_patrocinios_contrato  ON patrocinios(num_contrato);
CREATE INDEX idx_patrocinios_tramitado ON patrocinios(tramitado);

-- Importes derivados, como en la consulta ConsultaAnexos de Access (IVA 21 %)
CREATE VIEW v_patrocinios AS
SELECT p.*,
       ROUND(importe_total / 1.21, 2)                      AS importe_sin_iva,
       ROUND(importe_total - importe_total / 1.21, 2)      AS iva
FROM patrocinios p;

CREATE TABLE configuracion (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);
INSERT INTO configuracion(clave,valor) VALUES
  ('version_esquema','1'),
  ('tipo_iva','21');

PRAGMA user_version = 1;
