# GESTCON · Base de datos versión 2 (implementada)

Aprobado por Bienve el 8/10/2026: todas las mejoras de PROPUESTA_BD.md, con estas condiciones:
- Los documentos impresos no cambian salvo donde el texto contradecía los datos.
- CIF: se queda exactamente como está escrito (sin normalizar ni validar). Las entidades se agrupan por CIF solo para comparar.
- Nº de contrato: se reinicia cada año y puede repetirse. La clave es `id`; no hay regla de unicidad sobre el número (solo aviso si se repite en la misma anualidad).

## Cambios
- Migración automática v1 → v2 al abrir el archivo, con copia `antes-de-actualizar` y resumen en pantalla.
- Tabla `entidades` (60 por CIF); cada patrocinio guarda su copia de los datos (lo que se imprime).
- `estado`: preparación, pendiente de firma, firmado, tramitado (antes `tramitado` 0/1).
- `iva_pct` por patrocinio (21 %); eliminada la vista `v_patrocinios` (IVA fijo) y los 4 índices.
- `fecha_inicio` / `fecha_fin` deducidas del texto en los 103 registros; el texto de celebración no cambia.
- Importe en letra generado a partir del número; se conserva el texto guardado cuando ya coincide.
- Soportes enumerados: se rellenan solos si están vacíos; botón para rehacerlos.
- Municipios: 103 de la provincia como sugerencia (texto libre).
- Documentos con la anualidad en el nombre (`2026_081_Contrato_…`); se siguen encontrando los antiguos sin anualidad.
- Aplicación presupuestaria propuesta por año y aviso si no coincide con la anualidad.
- Reglas CHECK (importes ≥ 0, anualidad 2000-2100, fechas válidas, fin ≥ inicio) y disparador de `modificado`.
- Copia automática una vez al día (30 días); guardado a los 2 s o al salir del campo.

## Verificación con los datos reales (103 patrocinios × 8 plantillas = 824 documentos)
- 759 documentos idénticos.
- 65 con diferencias, todas en el importe en letra:
  - Anexo I: 45 con el importe sin IVA en letra vacío «()» ahora completo, y id 76 corregido (14.876,02 €).
  - Anexos V y VI y Contrato de los id 19, 22, 24, 45 y 65: letra que no coincidía con el número
    (24: «Cuarenta y seis mil novecientos quince…» para 12.100 €; 65: «tres mil seiscientos» para 3.630 €;
    19: «iva incluido» duplicado; 22: faltaba «euros»; 45: «Docemil»).
- Integridad SQLite correcta, sin errores de claves ajenas, ids no reutilizados.
