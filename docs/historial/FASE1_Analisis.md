# GESTCON — Fase 1: Análisis de la base de datos Access

Origen analizado: `GESTCON.accdb` (formato Access 2007, ACE12) + 8 plantillas Word de `Documentacion/`.
El mapa completo marcador → campo está en `Mapa_marcadores_Fase1.xlsx` (hojas: *Campos DATOS*, *Mapa marcador-campo*, *Resumen plantillas*).

## 1. Resumen

La base de datos es muy sencilla: **una sola tabla (`DATOS`, 104 registros, 24 campos), sin relaciones**, una consulta, un formulario y 9 módulos VBA. Cada módulo VBA hace lo mismo: abre una plantilla Word, rellena marcadores con los campos de la consulta y guarda un PDF. El cruce entre los marcadores del VBA y los de las plantillas es **exacto**: 137 marcadores en 8 plantillas, ninguno huérfano en ningún sentido.

## 2. Objetos de la base de datos

| Objeto | Tipo | Descripción |
|---|---|---|
| `DATOS` | Tabla | 104 filas, 24 campos. Sin clave primaria ni relaciones |
| `ConsultaAnexos` | Consulta | Calcula importes y **filtra `TRAMITADO = No`** |
| `Gestion` | Formulario | Ficha única "Gestión de Patrocinios Deportivos", ligada a `DATOS` (todos los registros) |
| `Form_Gestion` | VBA | 8 botones de generación + selector de ruta + carga inicial |
| `ANEXO1`, `ANEXO2`, `ANEXO5`, `ANEXO6`, `CONTRATO`, `IMFORME_COMPETENCIAL`, `IMFORME_ECONOMICO`, `IMFORME_JUSTIFICACION` | VBA | Uno por documento (idénticos salvo la lista de marcadores) |
| `RUTA_INICIO` | VBA | Copia las plantillas a una carpeta por usuario |

## 3. Tabla `DATOS`: campos y tipos

| Campo | Tipo Access | Observaciones | SQLite propuesto |
|---|---|---|---|
| TRAMITADO | Sí/No, obligatorio | 100 = Sí, 4 = No | INTEGER 0/1 |
| ENTIDAD | Texto | 67 distintas | TEXT |
| CIF | Texto | formatos mezclados (`G-14085674`, `G 92309369`…) | TEXT |
| EVENTO | Memo | | TEXT |
| IMPORTE_TOTAL | Numérico(18,2) | IVA incluido | REAL / entero en céntimos |
| IMPORTE_LETRA | Texto | importe en letra, tecleado a mano | TEXT |
| IMPORTE_LETRA_SIN_IVA | Texto | solo Anexo I; vacío en 52 filas | TEXT |
| APLICACION_PRE | Texto | máscara `0000/0000/0000/00000`; 5 valores | TEXT |
| ANUALIDAD | Entero | 2023–2026 | INTEGER |
| FECHA_CELEBRACION | Texto | **texto libre** ("el 23 y 24 de septiembre de 2023") | TEXT |
| MUNICIPIOS | Texto | texto libre | TEXT |
| SOPORTES_PRESTADOS | Memo | lista multilínea (= "soportes cedidos") | TEXT |
| SOPORTES_ENTIDAD | Memo | lista multilínea (= "soportes propios") | TEXT |
| SOPORTES_ENUMERADOS | Memo | misma lista en una línea | TEXT |
| REPRESENTANTE_LEGAL, DNI_NIE_REPRESENT, TELEFONO, EMAIL | Texto | DNI con formatos mezclados | TEXT |
| NUM_CONTRATO | Double | en realidad es entero | INTEGER |
| PLAZO_EJECUCION | Fecha | todas a las 00:00 | TEXT ISO |
| FECHA_FIRMA | Fecha | solo Informe de Justificación; vacío en 62 filas | TEXT ISO |
| IMPORTE_REDING | Numérico(18,2) | importe del estudio de impacto | REAL |
| `IMPORTE _SIN_IVA`, `IVA` | Numérico | **obsoletos, siempre 0** | no migrar |

Se añadirá `id INTEGER PRIMARY KEY AUTOINCREMENT`, ya que no existe clave.

## 4. Relaciones

Ninguna. `MSysRelationships` está vacío. No hay tablas auxiliares ni listas desplegables ligadas.

## 5. Lógica VBA y de la consulta

**Consulta `ConsultaAnexos`** (la única fuente de los documentos):
- Selecciona todos los campos y filtra `TRAMITADO = False`.
- `ImportesinIVA = Format(IMPORTE_TOTAL / 1.21, "Currency")`
- `ImporteIVA = Format(IMPORTE_TOTAL − IMPORTE_TOTAL/1.21, "Currency")`
- `importeTOTAL` y `importeREDING` = `Format(..., "Currency")`
- Formato moneda en configuración regional española (`1.234,56 €`). Comprobado con los 104 registros: sin IVA + IVA redondeados siempre suman el total.

**Flujo de cada botón** (los 8 son iguales):
1. Abre la plantilla `.docx` desde la copia del usuario.
2. Recorre `ConsultaAnexos` y sustituye cada marcador (`Bookmarks(...).Range.Text`) por el campo.
3. Guarda **PDF** en `<usuario>\PDF\` y lo abre. Cierra Word sin guardar el `.docx`.

**Regla propia del Informe de Justificación**: marcador `CAMPAÑA` según `IMPORTE_TOTAL`: `>400.000` → A · `≥100.000` → B · `≥25.000` → C · `≥6.250` → D · `≥1.562` → E · resto → F (cada una con su frase fija; ver `Mapa_marcadores_Fase1.xlsx`).

**Formulario y carga**: al abrir, `RUTA_INICIO.CopiarDocumentos` copia todos los `.docx` de `Documentacion` a una carpeta con el nombre de usuario de Windows (para no modificar las originales). El botón "Cambiar ruta" solo asigna una variable que nada usa (código muerto). Hay barra de progreso, navegación (primero/anterior/siguiente/último), buscar, nuevo, guardar, eliminar y salir (esos botones no tienen VBA visible; son acciones estándar del asistente).

**Diseño del formulario**: pestañas *Datos de la Entidad* (entidad, CIF, representante, DNI/NIE, teléfono, email), *Datos del Evento* (anualidad, evento, fecha de celebración, plazo de ejecución, municipios, soportes cedidos / propios / enumerados) y *Datos económicos* (nº contrato, importe sin IVA, IVA, total, importe en letra, aplicación, importe REDING); casilla "Marcar si se ha tramitado"; grupos de botones *Anexos* (I, II, V, VI), *Contrato* e *Informes* (Competencial, Económico, Justificación).

**Comportamiento a corregir**: como la consulta devuelve *todos* los registros no tramitados y el bucle los recorre sin parar, si hubiera varios sin tramitar **el documento se rellenaría con el último** (hoy hay 4, de ahí que el flujo real sea trabajar con un solo registro pendiente). En la web se generará siempre del **registro seleccionado**.

## 6. Plantillas Word

| Plantilla | Marcadores | Notas |
|---|---|---|
| Anexo_I | 24 | único con IMPORTE_LETRA_SIN_IVA y CIF/TELEFONO/EMAIL/REPRE_LEGAL |
| Anexo_II | 16 | |
| Anexo_V | 20 | añade NUM_CONTRATO e IMPORTE_LETRA |
| Anexo_VI | 27 | añade PLAZO_EJECUCION, CIF |
| Contrato | 19 | datos del representante; `PLAZO_EJECUCION` comentado en VBA |
| Informe_Competencial | 8 | |
| Informe_Economico | 12 | usa IMPORTE_REDING y SOPORTES_ENUMERADOS |
| Informe_Justificacion_Impacto | 11 | usa FECHA_FIRMA y CAMPAÑA |

Hallazgos técnicos:
- **Todos los marcadores están vacíos** (rango colapsado): se rellenan insertando texto en ese punto. Al convertir a `{campo}` hay que copiar el formato (fuente, tamaño) del texto vecino y que cada etiqueta quede en un único *run* para docxtemplater.
- Los Anexos I, II, V y VI conservan un **campo de combinar correspondencia residual** `MERGEFIELD MUNICIPIOS` junto al marcador; se eliminará.
- Los nombres repetidos (`ENTIDAD_1…_5`, `IMPORTE_TOTAL_2…_6`) se unifican en una sola etiqueta por campo (`{entidad}`, `{importe_total}`…).
- Todas llevan imagen (logo) en cabecera; tablas en Anexo I (13), II/V/VI (5), Contrato (4).
- Los campos multilínea (soportes) usan saltos de línea y tabuladores: en la web se convertirán en párrafos.
- Ficheros a ignorar: `~$Anexo1.docx`, `~$GESTIÓN DE PATROCINIOS.xlsx`, `~WRL3163.tmp`, `Thumbs.db` (temporales). Se menciona un `GESTIÓN DE PATROCINIOS.xlsx` que no está en la carpeta.

## 7. Calidad de los datos (a tener en cuenta al migrar)

- **Registro casi vacío** (fila 50, ENTIDAD "Federación Andaluza de Balonmano", sin evento, importe 0): probablemente un borrador.
- Los 4 registros sin tramitar son de la Federación Andaluza de Balonmano (filas 50, 51, 64 y 88; 3 son "Liga de Promoción Diputación de Málaga"). Tres tienen importe 0 y sin nº de contrato; la 88 sí tiene (106) y 7.250 €.
- Hay otro registro con importe 0 y sin nº de contrato que **sí está tramitado** (fila 96, Deporte Internacional, S.L.).
- `NUM_CONTRATO` **repetido en 13 casos** (2 filas cada uno: 6, 20, 33, 57, 81, 83, 92, 96, 150, 151, 152, 181, 185) y vacío en 4.
- `IMPORTE_LETRA` vacío en 3 filas (50, 64, 96); en una de ellas (96) el registro está tramitado.
- CIF y DNI/NIE con formatos inconsistentes (puntos, guiones, espacios). Se migrarán tal cual (los documentos ya los usan así); se puede normalizar si se desea.
- Espacios duros en una entidad y un evento; espacios sobrantes en dos campos.
- Un registro con ANUALIDAD vacía (el mismo borrador).
- `APLICACION_PRE`: 5 valores; 3 filas usan `2025/0101/9121/22608`.
- Número de fila = orden de exportación, no un identificador.

## 8. Decisiones que necesito de ti antes de la fase 2

1. **PDF**: la web con docxtemplater genera **`.docx`** (el navegador no convierte a PDF con fidelidad). El flujo actual abría un PDF. Propuesta: guardar el `.docx` en `/documentos` y que lo imprimas/guardes como PDF desde Word. ¿Te vale?
2. **Importes y fechas**: propongo guardar los importes como números y formatearlos al generar (`1.234,56 €`); `FECHA_CELEBRACION` queda como texto libre; las fechas reales (plazo, firma) se muestran `dd/mm/aaaa`. ¿Correcto?
3. **IVA**: se mantiene el 21 % fijo (`/1.21`). ¿Es constante o puede variar?
4. **Campos obsoletos** `IMPORTE _SIN_IVA` e `IVA` (siempre 0): no migrarlos. ¿De acuerdo?
5. **Registro 50 casi vacío**: ¿lo migro o lo descarto?
6. **Contrato**: el plazo de ejecución está comentado en el VBA; ¿se queda sin ese dato?
7. **Nombre de los documentos generados** en `/documentos`: propongo `<NUM_CONTRATO>_<Plantilla>_<Entidad>.docx`. ¿Te encaja?
8. Los **8 documentos** se mantienen tal cual (Anexos I, II, V, VI, Contrato y 3 informes). ¿Hay alguna plantilla más que se use fuera de esta carpeta?

Cuando confirmes (o ajustes) estos puntos, paso a la **fase 2**: esquema SQLite y generación de `datos.sqlite`.
