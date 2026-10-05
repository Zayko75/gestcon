# Etiquetas de las plantillas Word

Las plantillas de `plantillas/` usan etiquetas entre llaves, por ejemplo `{entidad}`. Para modificar una plantilla se abre en Word y se edita como cualquier documento; donde deba aparecer un dato se escribe su etiqueta **tal cual, de una sola vez y con el mismo formato** (no cambies la negrita o el tipo de letra a mitad de etiqueta).

## Etiquetas disponibles

| Etiqueta | Contenido | Formato al insertarse |
|---|---|---|
| `{entidad}` | Nombre de la entidad |  |
| `{cif}` | CIF |  |
| `{evento}` | Evento |  |
| `{representante_legal}` | Representante legal |  |
| `{dni_nie_representante}` | DNI/NIE del representante |  |
| `{telefono}` | Teléfono |  |
| `{email}` | Email |  |
| `{anualidad}` | Anualidad |  |
| `{fecha_celebracion}` | Fecha de celebración | Texto tal como está en la ficha |
| `{municipios}` | Municipios |  |
| `{plazo_ejecucion}` | Plazo de ejecución | dd/mm/aaaa |
| `{fecha_firma}` | Fecha de firma | dd/mm/aaaa |
| `{soportes_cedidos}` | Soportes cedidos por la Diputación | Una línea del documento por cada línea de la ficha |
| `{soportes_propios}` | Soportes propios de la entidad | Una línea del documento por cada línea de la ficha |
| `{soportes_enumerados}` | Soportes enumerados (en una línea) |  |
| `{num_contrato}` | Nº de contrato |  |
| `{aplicacion}` | Aplicación presupuestaria |  |
| `{importe_total}` | Importe total (IVA incluido) | 1.234,56 € |
| `{importe_sin_iva}` | Importe sin IVA (total / 1,21) | 1.234,56 € |
| `{iva}` | IVA (total − importe sin IVA) | 1.234,56 € |
| `{importe_reding}` | Importe REDING | 1.234,56 € |
| `{importe_letra}` | Importe total en letra |  |
| `{importe_letra_sin_iva}` | Importe sin IVA en letra |  |
| `{campania}` | Campaña según el importe total (A–F) | Frase completa del tramo |

El porcentaje de IVA (21 %) está en la tabla `configuracion` de `datos.sqlite` (clave `tipo_iva`).

## Etiquetas usadas por cada plantilla

| Plantilla | Etiquetas |
|---|---|
| `Anexo_I.docx` | `{anualidad}`, `{aplicacion}`, `{cif}`, `{email}`, `{entidad}`, `{evento}`, `{fecha_celebracion}`, `{importe_letra_sin_iva}`, `{importe_sin_iva}`, `{importe_total}`, `{iva}`, `{municipios}`, `{representante_legal}`, `{soportes_cedidos}`, `{soportes_propios}`, `{telefono}` |
| `Anexo_II.docx` | `{anualidad}`, `{aplicacion}`, `{entidad}`, `{evento}`, `{fecha_celebracion}`, `{importe_sin_iva}`, `{importe_total}`, `{iva}`, `{municipios}`, `{soportes_cedidos}`, `{soportes_propios}` |
| `Anexo_V.docx` | `{anualidad}`, `{aplicacion}`, `{entidad}`, `{evento}`, `{fecha_celebracion}`, `{importe_letra}`, `{importe_sin_iva}`, `{importe_total}`, `{iva}`, `{municipios}`, `{num_contrato}`, `{soportes_cedidos}`, `{soportes_propios}` |
| `Anexo_VI.docx` | `{anualidad}`, `{aplicacion}`, `{cif}`, `{entidad}`, `{evento}`, `{fecha_celebracion}`, `{importe_letra}`, `{importe_sin_iva}`, `{importe_total}`, `{iva}`, `{municipios}`, `{num_contrato}`, `{plazo_ejecucion}`, `{soportes_cedidos}`, `{soportes_propios}` |
| `Contrato.docx` | `{cif}`, `{dni_nie_representante}`, `{entidad}`, `{evento}`, `{fecha_celebracion}`, `{importe_letra}`, `{importe_total}`, `{municipios}`, `{representante_legal}`, `{soportes_cedidos}`, `{soportes_propios}` |
| `Informe_Competencial.docx` | `{aplicacion}`, `{entidad}`, `{evento}`, `{fecha_celebracion}`, `{importe_total}`, `{municipios}` |
| `Informe_Economico.docx` | `{entidad}`, `{evento}`, `{fecha_celebracion}`, `{importe_reding}`, `{importe_total}`, `{municipios}`, `{soportes_enumerados}` |
| `Informe_Justificacion_Impacto.docx` | `{campania}`, `{entidad}`, `{evento}`, `{fecha_celebracion}`, `{fecha_firma}`, `{importe_total}`, `{municipios}`, `{soportes_enumerados}` |

## Tramos de la campaña

| Importe total | Campaña |
|---|---|
| > 400.000 € | A (índice muy alto de impactos) |
| 100.000 € – 400.000 € | B (alto) |
| 25.000 € – 100.000 € | C (medio) |
| 6.250 € – 25.000 € | D (medio-bajo) |
| 1.562 € – 6.250 € | E (bajo) |
| < 1.562 € | F (muy bajo) |

Si cambian estos tramos hay que modificar la función `campania` de `src/lib/format.ts`.
