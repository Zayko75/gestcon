# GESTCON · Gestión de patrocinios deportivos

Aplicación web para registrar los patrocinios deportivos y generar sus documentos Word (anexos, contrato e informes). Sustituye a la base de datos Access `GESTCON.accdb`.

- **Sin servidor**: todo se ejecuta en el navegador. Los datos viven en un archivo SQLite dentro de una carpeta que la aplicación lee y escribe directamente: una carpeta de **Google Drive** o una carpeta del ordenador o de la red.
- **Un solo usuario**: no hay bloqueos. Si el archivo cambia fuera de la ventana (por ejemplo, la aplicación abierta en dos pestañas), la aplicación avisa antes de sobrescribirlo.
- **Navegador**: con Google Drive, cualquier navegador moderno. Con una carpeta del ordenador o de red, Google Chrome o Microsoft Edge en un ordenador.

Los datos y las plantillas **no están en este repositorio**: el repositorio solo contiene el código de la aplicación. Con Google Drive, el navegador habla directamente con Google; no hay ningún servidor intermedio.

---

## Parte 1 · Publicar la aplicación en GitHub (una sola vez)

1. En GitHub, crea un repositorio nuevo (por ejemplo `gestcon`), sin README ni `.gitignore`.
2. Sube el contenido de esta carpeta. Desde una terminal, dentro de la carpeta:
   ```bash
   git remote add origin https://github.com/TU_USUARIO/gestcon.git
   git push -u origin main
   ```
3. En GitHub, ve a **Settings → Pages** y en **Source** elige **GitHub Actions**.
4. Ve a la pestaña **Actions**: el flujo «Publicar en GitHub Pages» se ejecuta solo con cada subida a `main` (también se puede lanzar a mano con *Run workflow*). Cuando termina en verde, la dirección de la aplicación es:
   ```
   https://TU_USUARIO.github.io/gestcon/
   ```
   Guárdala en favoritos.

> Las páginas de GitHub Pages son públicas aunque el repositorio sea privado (salvo en planes Enterprise). No es un problema: la página solo contiene el programa, nunca datos.

## Parte 2 · Conectar con Google Drive (una sola vez)

### 2.1 Subir la carpeta a Drive
En [drive.google.com](https://drive.google.com) arrastra la carpeta `Patrocinios` (con `datos.sqlite` y `plantillas/`) a **Mi unidad**.

### 2.2 Crear el ID de cliente de Google
Google exige que la aplicación tenga un «ID de cliente» para poder pedirte permiso. Es gratuito.

1. Entra en [console.cloud.google.com](https://console.cloud.google.com) con tu cuenta de Google y crea un proyecto nuevo llamado `GESTCON`.
2. Menú **APIs y servicios → Biblioteca**, busca **Google Drive API** y pulsa **Habilitar**.
3. Menú **Google Auth Platform** (o **Pantalla de consentimiento de OAuth**) → **Comenzar**:
   - Nombre de la aplicación: `GESTCON`; correo de asistencia: el tuyo.
   - Público: **Externo**.
   - Información de contacto: tu correo. Acepta y pulsa **Crear**.
4. En **Público → Usuarios de prueba**, pulsa **Añadir usuarios** y añade tu correo de Gmail.
5. En **Clientes → Crear cliente**:
   - Tipo de aplicación: **Aplicación web**. Nombre: `GESTCON`.
   - **Orígenes de JavaScript autorizados** (uno por línea, sin barra al final):
     ```
     https://TU_USUARIO.github.io
     http://localhost:8080
     http://localhost:5173
     ```
   - No hace falta rellenar los URI de redireccionamiento. Pulsa **Crear**.
6. Copia el **ID de cliente** (termina en `.apps.googleusercontent.com`).

### 2.3 Darle el ID a la aplicación
Elige una de las dos formas:
- **En la propia aplicación**: la primera vez, pégalo en el recuadro «ID de cliente de Google» y pulsa *Guardar*. Se recuerda en ese navegador.
- **En el repositorio** (sirve para cualquier navegador): escribe el ID en el archivo `.env.production` (`VITE_GOOGLE_CLIENT_ID=...`) y súbelo; la publicación se repite sola.

### 2.4 Conectar
1. Abre la aplicación, comprueba que el nombre de la carpeta es `Patrocinios` y pulsa **Conectar con Google Drive**.
2. Elige tu cuenta. Como la aplicación es tuya y no está verificada por Google, aparecerá «Google no ha verificado esta aplicación»: pulsa **Configuración avanzada → Ir a GESTCON**.
3. Marca la casilla de acceso a **Google Drive** y pulsa **Continuar**.
4. Aparece el listado. Las carpetas `documentos` y `backups` se crean solas dentro de `Patrocinios` en tu Drive.

Las siguientes veces basta con pulsar **Continuar con «Patrocinios»** y confirmar la cuenta.

**A tener en cuenta con Google Drive**
- La sesión de Google dura una hora. Si caduca mientras trabajas, arriba aparece **Reconectar con Google**: los cambios no se pierden, se guardan al reconectar.
- Mientras la aplicación esté en modo «Prueba» en Google Cloud, Google puede pedirte que aceptes los permisos de nuevo cada semana. Para evitarlo, en **Público** pulsa **Publicar aplicación** (seguirá saliendo el aviso de aplicación no verificada, que puedes ignorar porque la aplicación es tuya).
- La aplicación pide acceso a tu Drive para poder leer y escribir en la carpeta `Patrocinios`; solo toca esa carpeta.
- Las copias de seguridad antiguas se mueven a la papelera de Drive, que se vacía sola a los 30 días.
- Si abres la aplicación en dos ordenadores a la vez, avisará de que «El archivo de datos ha cambiado».

## Parte 3 · Alternativa: carpeta del ordenador o de red

En lugar de Google Drive se puede usar una carpeta del ordenador o de una unidad de red (solo con Chrome o Edge). Crea una carpeta con esta estructura:

```
Patrocinios/
├── datos.sqlite        ← la base de datos con los datos migrados
├── plantillas/         ← las 8 plantillas Word con etiquetas {campo}
├── documentos/         ← aquí se guardan los documentos generados
└── backups/            ← copias de seguridad automáticas
```

- Copia en ella `datos.sqlite` y, dentro de `plantillas/`, los 8 archivos: `Anexo_I.docx`, `Anexo_II.docx`, `Anexo_V.docx`, `Anexo_VI.docx`, `Contrato.docx`, `Informe_Competencial.docx`, `Informe_Economico.docx`, `Informe_Justificacion_Impacto.docx`.
- `documentos/` y `backups/` se crean solas si no existen.
- Si empiezas sin datos, la aplicación ofrece crear un `datos.sqlite` vacío.

## Parte 4 · Uso diario

**Abrir.** Entra en la dirección de la aplicación con Chrome o Edge.
- La primera vez conecta con Google Drive (Parte 2) o pulsa **Elegir carpeta** y selecciona la carpeta `Patrocinios` del ordenador (Parte 3).
- Las siguientes veces pulsa **Continuar con «Patrocinios»** y confirma la cuenta de Google o el permiso de la carpeta.
- **Cambiar carpeta** (arriba a la derecha) vuelve a la pantalla de conexión.
- Al abrir se crea una copia de seguridad automática.

**Listado.** Escribe en *Buscar* parte de la entidad, evento, CIF, municipio o nº de contrato. Filtra por anualidad o por estado (pendientes / tramitados). Pulsa en una fila para abrir su ficha. *Nuevo patrocinio* crea un registro.

**Ficha.**
- Los cambios se guardan solos (arriba aparece «Guardado a las…»). No hay botón de guardar.
- Un patrocinio nuevo se guarda al pulsar **Crear patrocinio**; a partir de ahí se guarda solo.
- **Marcar si se ha tramitado** sirve para distinguir los expedientes cerrados.
- **Duplicar** crea una copia del patrocinio sin nº de contrato ni fecha de firma (útil cuando una entidad repite).
- **Eliminar** pide confirmación y deja antes una copia de seguridad.
- Los importes se escriben en formato español (`4.235,00` o `4235,5`). El importe sin IVA y el IVA se calculan al 21 %.
- Bajo cada documento se avisa de los datos que faltan para generarlo (por ejemplo, la fecha de firma); se puede generar igualmente y esos huecos quedan en blanco.

**Documentos.** En el panel de la derecha:
1. Pulsa **Generar** en el documento que necesites, o **Generar todos**.
2. El archivo Word se guarda en `documentos/` con el nombre `<nº contrato>_<documento>_<entidad>.docx` (por ejemplo `137_Contrato_CLUB_BTT_YUNQUERA.docx`). Si el patrocinio no tiene nº de contrato, el nombre empieza por `SC` seguido del identificador del registro.
3. Se abre una vista previa. Desde ella:
   - **Imprimir o guardar como PDF**: en la ventana de impresión elige el destino *Guardar como PDF*.
   - **Descargar .docx**: descarga una copia del Word.
4. **Volver a generar** sobrescribe el documento anterior. **Ver / PDF** abre el último generado.

> La aplicación no puede convertir a PDF por sí sola y guardarlo en la carpeta sin intervención (los navegadores no lo permiten). El Word se guarda automáticamente; el PDF se obtiene en un paso desde la vista previa.

**Copias de seguridad.** En *Copias de seguridad* se ven las copias de la carpeta `backups/` (se conservan las últimas 30). Se puede **Crear copia ahora** y **Restaurar** cualquiera; antes de restaurar se guarda una copia de los datos actuales, así que se puede deshacer.

**Si aparece «El archivo de datos ha cambiado».** Significa que `datos.sqlite` se modificó fuera de esta ventana (otra pestaña, otro ordenador o una copia manual).
- *Recargar los datos del archivo*: descarta tu último cambio y muestra lo que hay en el archivo.
- *Guardar mis cambios y sobrescribir*: conserva lo que ves aquí y pierde lo hecho en la otra ventana.

Para evitarlo, mantén la aplicación abierta en una sola pestaña.

## Parte 5 · Modificar las plantillas

Las plantillas son documentos Word normales con etiquetas `{campo}` donde deben aparecer los datos. Se editan con Word en la carpeta `plantillas/` y los cambios se aplican la próxima vez que se genere un documento.

La lista de etiquetas, qué contiene cada una y cuáles usa cada plantilla está en [`docs/etiquetas-plantillas.md`](docs/etiquetas-plantillas.md). Reglas:
- Escribe la etiqueta de una sola vez, con un único formato (negrita, tamaño…); si el formato cambia a mitad de etiqueta, Word la parte y deja de funcionar.
- Respeta las llaves y las minúsculas: `{importe_total}`.
- Una etiqueta se puede repetir todas las veces que haga falta.
- Una etiqueta que no existe sale en blanco.

## Parte 6 · Problemas habituales

| Síntoma | Qué hacer |
|---|---|
| «El navegador bloqueó la ventana de Google» | Permite las ventanas emergentes para la dirección de la aplicación (icono en la barra de direcciones). |
| Google muestra «Error 400: redirect_uri_mismatch» u «origin_mismatch» | La dirección de la aplicación no está en «Orígenes de JavaScript autorizados» (Parte 2.2, paso 5). Debe coincidir exactamente, sin barra final. |
| Google muestra «Acceso bloqueado» / «access_denied» | Añade tu correo en **Público → Usuarios de prueba** (Parte 2.2, paso 4). |
| «No hay ninguna carpeta llamada Patrocinios» | Comprueba el nombre exacto de la carpeta en Drive y que no está en la papelera. |
| «Elegir carpeta» no aparece | La carpeta del ordenador solo funciona con Chrome o Edge en un ordenador; usa Google Drive. |
| No deja continuar con la carpeta recordada | Pulsa «Permitir» cuando el navegador pida acceso. Si la unidad de red no está conectada, conéctala y vuelve a intentarlo. |
| «Falta la plantilla … en la carpeta plantillas» | Copia ese archivo a `plantillas/` con el nombre exacto. |
| El documento sale con huecos | Rellena en la ficha los datos que indica el aviso «Sin rellenar». |
| «El archivo no es una base de datos de GESTCON» | `datos.sqlite` no es el archivo correcto o está dañado: restaura una copia de `backups/` (cámbiale el nombre a `datos.sqlite`). |
| Un error al generar un documento | Comprueba que la plantilla no tiene llaves `{ }` sueltas ni etiquetas partidas por cambios de formato. |

## Desarrollo

Requisitos: Node.js 20 o superior.

```bash
npm install
npm run dev        # servidor local en http://localhost:5173
npm run typecheck  # comprobación de tipos
npm run build      # genera dist/ (lo que se publica en GitHub Pages)
```

Estructura:

```
src/
├── App.tsx                     rutas (#/, #/registro/ID, #/nuevo, #/copias)
├── components/                 pantallas: Listado, Ficha, PanelDocumentos, Copias, VistaPrevia…
├── lib/
│   ├── fs.ts                   interfaz de carpeta común; carpeta local (File System Access API)
│   ├── drive.ts                carpeta de Google Drive (Google Identity Services + Drive API v3)
│   ├── db.ts                   SQLite con sql.js
│   ├── store.tsx               estado, guardado automático y control de conflictos (lastModified)
│   ├── backups.ts              copias automáticas (últimas 30)
│   ├── documentos.ts           docxtemplater + PizZip, nombres de archivo, datos de las plantillas
│   ├── format.ts               importes, fechas y campaña
│   └── borrador.ts             formulario ⇄ base de datos
docs/
├── esquema.sql                 esquema de datos.sqlite
└── etiquetas-plantillas.md     etiquetas de las plantillas
```

Pila: React 18, Vite, Tailwind CSS, TypeScript, [sql.js](https://sql.js.org), [docxtemplater](https://docxtemplater.com), PizZip y docx-preview.

### Base de datos

`datos.sqlite` tiene la tabla `patrocinios` (un registro por patrocinio), la vista `v_patrocinios` (con el importe sin IVA y el IVA calculados) y la tabla `configuracion` (versión del esquema y tipo de IVA). El esquema completo está en [`docs/esquema.sql`](docs/esquema.sql).

## Origen

Migración de `GESTCON.accdb` (Access 2007): la tabla `DATOS` pasó a `patrocinios` y los marcadores de Word de las 8 plantillas a etiquetas `{campo}`. La consulta `ConsultaAnexos` (que filtraba los expedientes sin tramitar y calculaba importes sin IVA e IVA) se sustituye por la ficha de cada patrocinio.
