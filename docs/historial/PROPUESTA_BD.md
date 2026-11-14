# GESTCON · Propuesta de mejoras de la base de datos

Análisis de `datos.sqlite`: 103 patrocinios, anualidades 2023-2026, 60 entidades distintas por CIF.
Las plantillas Word no se tocan: todas las etiquetas `{campo}` siguen existiendo con el mismo nombre.

## A. Coherencia de los datos

| Nº | Mejora | Motivo (datos reales) | Prioridad |
|---|---|---|---|
| 1 | Importe en letra calculado automáticamente a partir del número (`importe_letra` e `importe_letra_sin_iva`), en lugar de escribirlo a mano. | 7 errores: id 24 dice «Cuarenta y seis mil novecientos quince euros con diez céntimos» para 12.100 €; id 65 «tres mil seiscientos» para 3.630 €; id 76 sin IVA 14.875,20 en vez de 14.876,02; otros sin «euros» o «Docemil». | Alta |
| 2 | Tabla `entidades` (CIF único, nombre, representante, DNI/NIE, teléfono, email). Al crear un patrocinio se elige la entidad y se rellenan sus datos; en el patrocinio se guarda una copia, para que los expedientes antiguos no cambien si cambia el representante. | 19 entidades repiten; 13 tienen nombre o representante escritos de varias formas («DEPORTE INTERNACIONAL, S.A.» / «S.A.»; «D. Joaquín» / «JOAQUIN»). | Alta |
| 3 | CIF normalizado (mayúsculas, sin espacios ni guiones) y validado con su letra/dígito de control. | 7 CIF escritos de varias formas («G- 56998461», «G-56998461», «G56998461»). Dos entidades con dos CIF distintos: Federación Andaluza de Balonmano (Q6855014D y G56998461) y Federación Andaluza de Gimnasia (G41193004 y V41193004). | Alta |
| 4 | Nº de contrato único por anualidad (regla en la base de datos). | El 185 de 2024 está dos veces (id 30 y id 85). | Alta |
| 5 | Nombre de los documentos con la anualidad: `2026_081_Contrato_….docx`. | Los números de contrato se reinician cada año (13 repetidos entre años): una misma entidad en dos años sobrescribiría sus documentos. | Alta |
| 6 | Aviso si la anualidad no coincide con el año de la aplicación presupuestaria, y aplicación propuesta automáticamente según el año. | id 50 e id 63: anualidad 2026 con aplicación 2025/1301/3411/22608. Solo hay 5 aplicaciones distintas. | Media |
| 7 | «Soportes enumerados» generados solos a partir de cedidos + propios (editables). | En 75 de 103 coincide exactamente con unir las dos listas; en 20 casi. | Media |
| 8 | Tipo de IVA guardado en cada patrocinio (por defecto el 21 % de la configuración). Se elimina la vista `v_patrocinios`, que no usa la app y tiene el 21 % fijo. | Si el IVA cambia, regenerar un expediente antiguo daría importes distintos a los firmados. | Media |
| 9 | Limpieza al guardar: espacios dobles, espacios al principio y al final, CIF en mayúsculas, emails validados. | «D. Sebastián  Fernández» (doble espacio), 19 emails con varias direcciones sin formato fijo. | Media |
| 10 | Municipios con lista de los municipios de la provincia para autocompletar (se sigue permitiendo texto libre) y un único estilo de escritura. | «Málaga» (8) y «MÁLAGA» (6) a la vez. | Baja |
| 11 | Fechas de inicio y fin del evento como fechas reales; el texto «del 2 al 4 de abril de 2026» se genera solo (se puede retocar). | Hoy la fecha de celebración es texto libre y no se puede ordenar ni filtrar por ella. | Baja |
| 12 | Estado del expediente con más pasos (por ejemplo: en preparación, pendiente de firma, firmado, tramitado) en lugar de solo «tramitado sí/no». | 100 de 103 están «tramitados»; la casilla no distingue fases. | Opcional |

## B. Eficiencia y seguridad

| Nº | Mejora | Motivo | Prioridad |
|---|---|---|---|
| 13 | Copia de seguridad automática una vez al día (no en cada apertura). Las 30 copias cubrirían 30 días. | Hoy, abrir la app varias veces el mismo día gasta copias. | Alta |
| 14 | Guardado algo más espaciado (2 s sin escribir, o al salir del campo) en lugar de 0,7 s. | Con Drive, cada guardado sube el archivo entero (≈130 KB). | Media |
| 15 | Reglas de integridad en la base de datos: importes ≥ 0, anualidad razonable, fechas con formato AAAA-MM-DD, `modificado` actualizado automáticamente. | Evitar datos imposibles aunque se edite el archivo fuera de la app. | Media |
| 16 | Sistema de versiones del esquema: la app actualiza sola un `datos.sqlite` antiguo, con copia previa. | Necesario para aplicar cualquiera de las mejoras sin perder datos. | Imprescindible |
| 17 | Quitar los 4 índices y compactar el archivo. | Con 103 filas la app filtra en memoria; los índices no aceleran nada y ocupan espacio. | Baja |

## C. Datos que revisar a mano (no se corrigen sin confirmación)

- Importe en letra erróneo: id 24, 65, 76 (y formato en 19, 22, 45).
- Contrato 185/2024 repetido: id 30 y 85.
- Anualidad/aplicación: id 50 y 63 (además con importe 0 €).
- CIF dobles: Federación Andaluza de Balonmano y Federación Andaluza de Gimnasia.
- Importe 0 €: id 50, 63 y 95.

## Cómo se aplicaría

1. Copia de seguridad antes de la migración.
2. Migración automática del archivo (punto 16) al abrirlo con la nueva versión.
3. Las correcciones de datos de la sección C solo con tu confirmación, caso por caso.
4. Pruebas: generar los 8 documentos de varios patrocinios y comprobar que salen igual que ahora salvo las correcciones aprobadas.
