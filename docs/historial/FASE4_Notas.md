# GESTCON — Fase 4: aplicación web

Proyecto en `Fase4/gestcon` (React + Vite + Tailwind + TypeScript). Probar en local: `npm install` y `npm run dev` (Chrome o Edge). La publicación en GitHub Pages, el workflow y el README llegan en la fase 5.

## Qué hace
- **Carpeta de datos**: se elige una vez con el selector del navegador; el acceso se recuerda (IndexedDB) y en cada sesión el navegador vuelve a pedir permiso. Estructura: `datos.sqlite`, `plantillas/`, `documentos/`, `backups/` (las subcarpetas se crean solas). Si no hay `datos.sqlite`, ofrece crear uno vacío.
- **Listado**: búsqueda sin distinguir tildes (entidad, evento, CIF, municipio, nº de contrato, representante), filtros por anualidad y estado (pendiente/tramitado), orden por columnas.
- **Ficha**: tres bloques (entidad, evento, económicos) con la casilla «Marcar si se ha tramitado», navegación anterior/siguiente, duplicar y eliminar (con copia previa). Avisos no bloqueantes: nº de contrato repetido, formato de aplicación, campos que faltan para cada documento. Importes con formato español; sin IVA e IVA calculados al 21 % (`configuracion.tipo_iva`).
- **Guardado automático**: cada cambio se guarda en `datos.sqlite` 0,7 s después de dejar de escribir. Antes de escribir se comprueba `lastModified`; si el archivo cambió fuera de la ventana (otra pestaña/equipo) se avisa y se elige entre recargar o sobrescribir.
- **Copias**: al abrir se guarda `backups/datos_AAAA-MM-DD_HH-MM-SS.sqlite` y se conservan las últimas 30. Pantalla de copias con «Crear copia ahora» y «Restaurar» (guarda antes una copia de lo actual).
- **Documentos**: los 8, desde `plantillas/` con docxtemplater + PizZip, guardados en `documentos/` como `<nº contrato>_<Plantilla>_<Entidad>.docx` (`SC<id>` si no hay nº de contrato). «Generar todos». Tras generar se abre una vista previa fiel al Word con «Imprimir o guardar como PDF» y «Descargar .docx».

## PDF
Un navegador sin servidor no puede convertir Word a PDF automáticamente y guardarlo solo en la carpeta. Solución aplicada: el `.docx` se guarda siempre automáticamente; el PDF sale desde la vista previa con «Imprimir o guardar como PDF» (destino «Guardar como PDF»; el nombre del archivo ya viene puesto). Para un PDF 100 % automático habría que añadir un servicio de conversión (no encaja en «sin backend»).

## Pruebas (Chrome real, carpeta simulada con los datos y plantillas reales)
29 comprobaciones correctas, sin errores de consola: 103 registros, copia al abrir, búsqueda, filtros, autoguardado en el archivo, importe inválido, 8 documentos generados sin etiquetas sin rellenar, impresión a PDF, descarga, nuevo/duplicar/eliminar, conflicto de archivo (recargar/sobrescribir), restaurar copia, reapertura con carpeta recordada, poda a 30 copias. Además se generaron 824 documentos (103 registros × 8 plantillas) sin errores y con XML válido. No se ha podido probar con una unidad de red real ni con Edge.
