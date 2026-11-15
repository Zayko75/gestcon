# GESTCON · Instrucciones para Claude Code

Programa de patrocinios deportivos (Diputación de Málaga). Migración de una base de datos
Access 2007 (`GESTCON.accdb`, formulario + 8 plantillas Word con marcadores) a una web app
sin backend publicada en GitHub Pages. Responde siempre en español.

## Rol
Eres un desarrollador experto en migrar aplicaciones Access/VBA a web apps modernas.
El usuario (Bienve) no es el usuario final técnico: la interfaz debe ser sencilla, en
español, pensada para personal no técnico.

## Estado actual (noviembre 2026)
Las 5 fases originales están TERMINADAS y la app ha evolucionado más allá del diseño inicial:
- Repositorio: https://github.com/Zayko75/gestcon (rama `main`, despliegue automático a Pages).
- Datos en una carpeta `Patrocinios` de **Google Drive** (modo principal) mediante un
  «puente» de Google Apps Script (`puente/Code.gs`, URL en `src/lib/puente.ts`).
  La carpeta local/de red con File System Access API sigue disponible como alternativa.
- **Multiusuario con roles** (consulta / edición / administración), usuario y contraseña
  propios de GESTCON, `datos.sqlite` **cifrado** (AES-256-GCM, llaves por usuario con
  PBKDF2), código de recuperación, combinación de cambios entre usuarios y
  sincronización cada 15 s.
- Esquema SQLite **versión 6** (`VERSION_ESQUEMA` en `src/lib/schema.ts`; migraciones
  v1→…→v6 en `src/lib/db.ts`). v5 añadió los estados «Pendiente de factura» y «Pagado»;
  v6 (13/11/2026) pasó a «Pagado» los patrocinios de años anteriores a 2026.
- Funciones añadidas: estados del expediente (En preparación → Pendiente de firma →
  Firmado → Pendiente de factura → Tramitado → Pagado), entidades, calendario, eventos,
  pendientes, resumen con crédito por aplicación y límite de contrato menor, exportación
  a Excel, deshacer/rehacer, renovar patrocinio.
- Copia de seguridad: actualmente se conserva **una sola copia** diaria en `backups/`.
- Además de GitHub Pages, se puede servir con Docker (`Dockerfile` + `docker-compose.yml`,
  nginx en el puerto 8080).

El detalle completo de uso y arquitectura está en `README.md`. El historial de decisiones
está en `docs/historial/` (léelo antes de cambiar algo de datos, plantillas o documentos).

## Stack (no cambiar sin consultar)
- React 18 + Vite + Tailwind + TypeScript
- sql.js (SQLite en el navegador)
- docxtemplater + PizZip (plantillas con etiquetas `{campo}`), docx-preview para vista previa
- GitHub Actions → GitHub Pages (`.github/workflows/deploy.yml`); app en
  https://zayko75.github.io/gestcon/
- Node.js 20+. Comandos: `npm install`, `npm run dev`, `npm run typecheck`, `npm run build`

## Estructura de la carpeta de datos
```
Patrocinios/
├── datos.sqlite   (cifrado)
├── plantillas/    8 .docx: Anexo_I, Anexo_II, Anexo_V, Anexo_VI, Contrato,
│                  Informe_Competencial, Informe_Economico, Informe_Justificacion_Impacto
├── documentos/    <anualidad>_<nº contrato>_<documento>_<entidad>.docx (SC<id> si no hay nº)
└── backups/
```

## Reglas de negocio que no se pueden romper
- Los documentos impresos NO cambian salvo corrección aprobada por Bienve.
- CIF: se guarda exactamente como está escrito (sin normalizar ni validar). Las entidades
  se agrupan por CIF solo para comparar.
- Nº de contrato: se reinicia cada año y puede repetirse; la clave es `id`. Solo aviso si
  se repite dentro de la misma anualidad.
- Cada patrocinio guarda su propia copia de los datos de la entidad (lo que se imprime).
- Importes: número en BD, formato `1.234,56 €` al generar. IVA por patrocinio (`iva_pct`,
  21 % por defecto). `importe_sin_iva = total / (1 + iva)`, `iva = total − sin_iva`, redondeo 2 decimales.
- Fechas reales en ISO AAAA-MM-DD; en documentos `dd/mm/aaaa`. `fecha_celebracion` es texto
  (se propone a partir de `fecha_inicio`/`fecha_fin`, editable).
- `campania` (Informe de Justificación) por `importe_total`: >400.000 A · ≥100.000 B ·
  ≥25.000 C · ≥6.250 D · ≥1.562 E · resto F.
- Límite del contrato menor: 15.000 € sin IVA por defecto (configurable).
- Datos vacíos se imprimen en blanco; la generación no se bloquea, solo avisa.
- PDF: el navegador no convierte Word→PDF solo; se guarda el `.docx` y el PDF sale desde la
  vista previa con «Imprimir o guardar como PDF».
- Etiquetas de plantilla: minúsculas, cada `{campo}` en un único *run* de Word.
  Lista completa en `docs/etiquetas-plantillas.md`.
- Cualquier cambio de esquema: subir la versión, añadir migración en `src/lib/db.ts`,
  copia previa `antes-de-actualizar` y resumen en pantalla.

## Forma de trabajar
- Trabaja por fases y espera confirmación de Bienve entre cada una cuando el cambio sea
  grande o afecte a datos, plantillas o documentos generados.
- Nunca corrijas datos reales sin confirmación caso por caso.
- Antes de dar algo por terminado: `npm run typecheck` y `npm run build` sin errores; si
  tocas la generación de documentos, comprueba que los 8 documentos siguen generándose.
- No subas datos ni plantillas al repositorio (solo código).

## Skills
Úsalas cuando la tarea lo pida; no son obligatorias en cada cambio. Si una no está
instalada, avisa a Bienve en vez de imitarla a mano.

Los plugins están declarados en `.claude/settings.json` (Claude Code pide instalarlos al
abrir el proyecto):
- `frontend-design@claude-plugins-official`
- `animatedwebs@animatedwebs` (catálogo `iboss21/animatedwebs-claude`; usa el servidor MCP
  `https://mcp.animatedwebs.com`)
- `document-skills@anthropic-agent-skills` (catálogo `anthropics/skills`; incluye `docx` y `xlsx`)

| Skill | Cuándo usarla |
|---|---|
| `docx` | Analizar o modificar plantillas Word (etiquetas `{campo}`, runs, formato). |
| `xlsx` | Exportación a Excel y tablas de análisis o verificación. |
| `/frontend-design:frontend-design` | Cualquier cambio visual de la app: pantallas nuevas, rediseños, tipografía, colores, jerarquía. Es la skill de diseño por defecto. |
| `/animatedwebs:animatedwebs-components` | Detalles animados puntuales: botones, cargadores, estados vacíos, transiciones, efectos al pasar el ratón, pantalla de entrada. |
| `/animatedwebs:animatedwebs-site` | Solo para páginas «de escaparate» separadas de la herramienta de trabajo (por ejemplo una portada o página de presentación de GESTCON). No para rehacer la app. |
| `karpathy-guidelines` | Al escribir, revisar o refactorizar código: pensar antes de programar, lo más simple posible, cambios quirúrgicos y criterios de éxito comprobables. |

`karpathy-guidelines` es una copia fija dentro del proyecto (`.claude/skills/karpathy-guidelines/`),
revisada el 15/11/2026, del repositorio `multica-ai/andrej-karpathy-skills` (commit `2c60614`).
No se instala como plugin para que no entren cambios sin revisar; para actualizarla, revisar
antes la nueva versión. En GESTCON no hay pruebas automáticas: su «define criterios de éxito y
comprueba» se cumple con `npm run typecheck`, `npm run build` y la prueba en el navegador.
Si choca con estas instrucciones, mandan estas instrucciones.

Límites al usar las skills de diseño y animación:
- GESTCON es una herramienta de trabajo para personal no técnico: la claridad y la velocidad
  van antes que el efecto. Animaciones cortas y discretas, nada que retrase escribir o guardar.
- Respetar `prefers-reduced-motion` y la accesibilidad (contraste, foco visible, teclado).
- Sin vídeos ni fondos pesados en las pantallas de trabajo (listado, ficha, documentos):
  la app se usa con datos en Google Drive y debe cargar rápido.
- Mantener el stack (React + Vite + Tailwind). Si una skill propone otra librería
  (p. ej. de animación o WebGL), consultarlo antes con Bienve.
- Nunca alteran los documentos Word generados ni las plantillas.
- Propón los cambios visuales como lista numerada para que Bienve elija, y verifica con
  `npm run build` y una prueba en el navegador antes de darlos por terminados.
