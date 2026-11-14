# GESTCON — Fase 2: esquema SQLite y datos migrados

Archivos: `datos.sqlite` (listo para copiar a la carpeta de red), `schema.sql`, `migrar.py`.

## Estructura
- **`patrocinios`**: 103 registros (se descartó la fila 50, casi vacía). Clave `id` autonumérica. Campos en minúsculas con los mismos nombres que las etiquetas `{campo}` de las plantillas (`soportes_prestados` → `soportes_cedidos`, `soportes_entidad` → `soportes_propios`, `dni_nie_represent` → `dni_nie_representante`, `aplicacion_pre` → `aplicacion`).
- **`v_patrocinios`** (vista): añade `importe_sin_iva = importe_total/1,21` e `iva = importe_total − importe_sin_iva`, redondeados a 2 decimales, igual que la consulta de Access (las columnas originales `IMPORTE _SIN_IVA` e `IVA`, siempre 0, no se migran; los importes que usan los documentos son los calculados).
- **`configuracion`**: `version_esquema = 1`, `tipo_iva = 21`.
- Índices por entidad, anualidad, nº de contrato y tramitado. `PRAGMA user_version = 1`.

## Conversiones
- Fechas (`plazo_ejecucion`, `fecha_firma`) en ISO AAAA-MM-DD; `fecha_celebracion` queda como texto libre.
- `num_contrato` pasa de Double a entero (no es único: hay 13 repetidos, se respetan).
- Espacios duros (U+00A0) sustituidos por espacios y recorte de espacios extremos; saltos de línea y tabuladores de los soportes se conservan.
- `tramitado`: 100 = sí, 3 = no.

## Verificación contra Access
103 filas; suma de `importe_total` 958.187,79 € e `importe_reding` 3.178.676,83 € idénticas al origen; 100 nº de contrato, 103 plazos y 42 fechas de firma; `sin IVA + IVA = total` en todas las filas; `integrity_check` correcto.

## Pendiente de decidir (fase 4)
Generación de PDF: lo pediste automático. En el navegador no hay conversión nativa Word→PDF; se resolverá en la fase 4 (ver opciones allí).
