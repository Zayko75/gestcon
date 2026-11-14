# GESTCON — Fase 3: plantillas Word convertidas

Los 137 marcadores de Word se han sustituido por 137 etiquetas `{campo}`. Las plantillas están en `plantillas/` (mismos nombres que los originales). Se eliminó el campo residual `MERGEFIELD MUNICIPIOS` de los Anexos I, II, V y VI. Logo, tablas, cabeceras y estilos no se han tocado.

## Etiquetas por plantilla

| Plantilla | Usos | Etiquetas |
|---|---|---|
| Anexo_I | 24 | `{anualidad}`, `{aplicacion}`, `{cif}`, `{email}`, `{entidad}`, `{evento}`, `{fecha_celebracion}`, `{importe_letra_sin_iva}`, `{importe_sin_iva}`, `{importe_total}`, `{iva}`, `{municipios}`, `{representante_legal}`, `{soportes_cedidos}`, `{soportes_propios}`, `{telefono}` |
| Anexo_II | 16 | `{anualidad}`, `{aplicacion}`, `{entidad}`, `{evento}`, `{fecha_celebracion}`, `{importe_sin_iva}`, `{importe_total}`, `{iva}`, `{municipios}`, `{soportes_cedidos}`, `{soportes_propios}` |
| Anexo_V | 20 | `{anualidad}`, `{aplicacion}`, `{entidad}`, `{evento}`, `{fecha_celebracion}`, `{importe_letra}`, `{importe_sin_iva}`, `{importe_total}`, `{iva}`, `{municipios}`, `{num_contrato}`, `{soportes_cedidos}`, `{soportes_propios}` |
| Anexo_VI | 27 | `{anualidad}`, `{aplicacion}`, `{cif}`, `{entidad}`, `{evento}`, `{fecha_celebracion}`, `{importe_letra}`, `{importe_sin_iva}`, `{importe_total}`, `{iva}`, `{municipios}`, `{num_contrato}`, `{plazo_ejecucion}`, `{soportes_cedidos}`, `{soportes_propios}` |
| Contrato | 19 | `{cif}`, `{dni_nie_representante}`, `{entidad}`, `{evento}`, `{fecha_celebracion}`, `{importe_letra}`, `{importe_total}`, `{municipios}`, `{representante_legal}`, `{soportes_cedidos}`, `{soportes_propios}` |
| Informe_Competencial | 8 | `{aplicacion}`, `{entidad}`, `{evento}`, `{fecha_celebracion}`, `{importe_total}`, `{municipios}` |
| Informe_Economico | 12 | `{entidad}`, `{evento}`, `{fecha_celebracion}`, `{importe_reding}`, `{importe_total}`, `{municipios}`, `{soportes_enumerados}` |
| Informe_Justificacion_Impacto | 11 | `{campania}`, `{entidad}`, `{evento}`, `{fecha_celebracion}`, `{fecha_firma}`, `{importe_total}`, `{municipios}`, `{soportes_enumerados}` |

## Reglas de generación (se aplicarán en la fase 4)
- `importe_total`, `importe_sin_iva`, `iva`, `importe_reding`: formato `1.234,56 €` (siempre con separador de miles, como el formato Moneda de Access).
- `plazo_ejecucion`, `fecha_firma`: `dd/mm/aaaa`; vacíos se dejan en blanco.
- `soportes_cedidos` y `soportes_propios`: cada línea del texto sale en una línea del documento.
- `campania`: se calcula con los tramos del Informe de Justificación (>400.000 A; ≥100.000 B; ≥25.000 C; ≥6.250 D; ≥1.562 E; resto F).
- Los datos vacíos se escriben en blanco (no se bloquea la generación).

## Verificación
- Las 8 plantillas se rellenaron con docxtemplater con los **103 registros** (824 documentos): 0 errores y todas las etiquetas existen en la base de datos.
- Se convirtieron a PDF y se revisaron visualmente muestras (Anexo I, Contrato, Informe de Justificación): formato, negritas y tablas correctos.

## Cosas que ya venían así en Access (no son errores de la conversión)
- Muchos registros no tienen `importe_letra_sin_iva` (52) ni `fecha_firma` (62): en el Anexo I sale `() IVA no incluido` y en el Informe de Justificación `el .` en esos casos. Conviene completar esos datos en la app antes de generar.
- El Informe de Justificación escribe `4.235,00 € euros` (la plantilla ya lleva la palabra «euros»).
- El formato de cada valor insertado (negrita/cursiva/tamaño) se toma del texto inmediatamente anterior a cada marcador, que es lo que hacía Word al insertar en un marcador vacío.
