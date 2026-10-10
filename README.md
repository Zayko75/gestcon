# GESTCON · Gestión de patrocinios deportivos

Aplicación web para registrar los patrocinios deportivos y generar sus documentos Word (anexos, contrato e informes). Sustituye a la base de datos Access `GESTCON.accdb`.

- **Sin servidor**: todo se ejecuta en el navegador. Los datos viven en un archivo SQLite dentro de una carpeta que la aplicación lee y escribe directamente: una carpeta de **Google Drive** o una carpeta del ordenador o de la red.
- **Varios usuarios a la vez, con roles**: cada persona entra con su usuario y contraseña y tiene un rol: consulta, edición o administración. Los datos se guardan cifrados. Los cambios de cada uno se combinan al guardar y la aplicación recoge sola los de los demás cada pocos segundos.
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
- Mientras la aplicación esté en modo «Prueba» en Google Cloud, Google puede pedirte que aceptes los permisos de nuevo cada semana. Para evitarlo, en **Público** pulsa **Publicar aplicación** (seguirá saliendo el aviso de aplicación no verificada, que puedes ignorar porque la aplicación es tuya). Para publicarla, Google pide antes la página principal y la política de privacidad en **Información de la marca**: usa la dirección de la aplicación y la página `privacidad.html` que se publica con ella.
- La aplicación pide acceso a tu Drive para poder leer y escribir en la carpeta `Patrocinios`; solo toca esa carpeta.
- Cuando se hace una copia de seguridad nueva, la anterior se mueve a la papelera de Drive, que se vacía sola a los 30 días.
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
- Después se entra con usuario y contraseña de GESTCON (Parte 5).
- La primera vez que alguien con permiso de edición abre la aplicación cada día se crea una copia de seguridad automática, que sustituye a la anterior.
- Si el `datos.sqlite` es de una versión anterior, la aplicación lo actualiza sola (antes guarda una copia en `backups/`) y muestra un resumen de lo que ha cambiado.

**Listado.** Escribe en *Buscar* parte de la entidad, evento, CIF, municipio o nº de contrato. Filtra por anualidad y por estado. En **Más filtros** puedes filtrar además por municipio, aplicación presupuestaria, importe (desde / hasta) y fecha del evento. Encima de la tabla se ve cuántos patrocinios coinciden y su importe total. Pulsa en una fila para abrir su ficha. *Nuevo patrocinio* crea un registro.

**Exportar a Excel.** El botón *Exportar a Excel* del listado descarga un `.xlsx` con los patrocinios que se están viendo (todos o solo los filtrados), con todos sus datos, la cabecera fija, filtros en cada columna y una fila de totales.

**Pendientes.** Reúne lo que queda por hacer en los expedientes no tramitados. El número junto a *Pendientes* en el menú cuenta los dos primeros grupos:
- *Firmar antes del evento*: en preparación o pendientes de firma, con el evento en los próximos 30 días o ya celebrado.
- *Por justificar*: el evento ya se celebró (o venció el plazo de ejecución) y el expediente no está tramitado.
- *Próximos eventos*: firmados, con el evento en los próximos 30 días.
- *Sin firmar*: el resto de los que están en preparación o pendientes de firma.

**Entidades.** Lista de entidades con su número de patrocinios, el último año y el importe total. En la ficha de una entidad se ven sus patrocinios agrupados por año, con lo que suman con y sin IVA. **Renovar para…** crea un patrocinio nuevo copiando el último (entidad, evento, municipios, soportes e importe), en estado «En preparación» y sin nº de contrato, fechas ni fecha de firma. Desde la ficha de un patrocinio, *Ver sus patrocinios* lleva a la de su entidad.

**Resumen.** Elige el año arriba a la derecha.
- *Crédito por aplicación presupuestaria*: escribe el crédito de cada aplicación y verás lo comprometido (en firme y en curso), lo que queda y si se supera. El crédito se guarda en `datos.sqlite`. Para preparar otro año, usa *Indicar el crédito de otra aplicación*.
- *Por estado*, *Eventos por mes* y *Municipios con más patrocinios*. Pulsando un estado se abre el listado filtrado.
- *Límite del contrato menor*: 15.000 € sin IVA por defecto (se puede cambiar) y las entidades que lo superan sumando sus patrocinios del año.

**Ficha.**
- Los cambios se guardan solos (arriba aparece «Guardado a las…»). No hay botón de guardar.
- Un patrocinio nuevo se guarda al pulsar **Crear patrocinio**; a partir de ahí se guarda solo.
- **Deshacer y Rehacer** (debajo del nombre de la entidad): deshace el último cambio guardado, aunque ya se haya guardado en la carpeta. También con **Ctrl+Z** y **Ctrl+Y** cuando no estás escribiendo en un campo (dentro de un campo, Ctrl+Z sigue deshaciendo lo que escribes, como siempre).
  - *Ver cambios* muestra los cambios de esta sesión con el valor anterior y el nuevo; *Deshacer hasta aquí* deja la ficha como estaba antes de ese cambio.
  - Si otro usuario ha cambiado después ese mismo campo, no se pisa su cambio: se avisa.
  - Se recuerda mientras la pestaña está abierta (también al ir a otras fichas y volver). Al cerrar la pestaña o la sesión se olvida.
- **Estado del expediente**: En preparación, Pendiente de firma, Firmado o Tramitado. En el listado, «Pendientes» son todos los que aún no están tramitados.
- **Entidad**: en un patrocinio nuevo, al elegir una entidad que ya ha tenido patrocinios se rellenan su CIF, representante, DNI/NIE, teléfono y email. Cada patrocinio guarda su propia copia de esos datos, que es la que se imprime.
- **Anualidad**: un patrocinio nuevo empieza con el año en curso y la aplicación `año/1301/3411/22608`. Al cambiar la anualidad cambia también el año de la aplicación; si no coinciden, se avisa.
- **DNI/NIE** y **Aplicación presupuestaria** tienen máscara: los puntos, guiones y barras se ponen solos (`12.345.678-Z`, `X-1234567-L`, `2026/1301/3411/22608`). Si la letra del DNI/NIE no corresponde al número, se avisa.
- **Avisos de importe**: si el importe sin IVA supera el límite del contrato menor, si la entidad lo supera sumando sus patrocinios del año, o si la aplicación presupuestaria se queda sin crédito (cuando se ha indicado en *Resumen*). Son avisos: no impiden guardar.
- **Nº de contrato**: se reinicia cada año, así que puede repetirse entre años. Solo se avisa si se repite dentro de la misma anualidad.
- **Fechas del evento**: primer y último día como fechas; el texto de celebración se propone solo y se puede retocar (para días sueltos, escríbelo a mano).
- **Importe en letra**: se escribe solo a partir del importe y del tipo de IVA del patrocinio.
- **Soportes cedidos y propios**: escribe un soporte y pulsa **Intro**. Mientras escribes se proponen los usados en otros patrocinios (la primera propuesta se añade con Intro; las flechas eligen otra). Pulsa un soporte para corregirlo; las flechas lo suben o bajan y la ✕ lo quita. Se guardan como siempre, uno por línea con guion («- Soporte.»).
- **Soportes enumerados**: se vuelve a escribir solo, con las dos listas separadas por comas, cada vez que añades, quitas u ordenas un soporte. Se puede retocar.
- **Duplicar** crea una copia del patrocinio sin nº de contrato ni fecha de firma (útil cuando una entidad repite).
- **Eliminar** (solo administradores) pide confirmación y deja antes una copia de seguridad.
- Los importes se escriben en formato español (`4.235,00` o `4235,5`). El importe sin IVA y el IVA se calculan con el tipo de IVA del patrocinio (21 % por defecto).
- Bajo cada documento se avisa de los datos que faltan para generarlo (por ejemplo, la fecha de firma); se puede generar igualmente y esos huecos quedan en blanco.

**Documentos.** En el panel de la derecha:
1. Pulsa **Generar** en el documento que necesites, o **Generar todos**.
2. El archivo Word se guarda en `documentos/` con el nombre `<anualidad>_<nº contrato>_<documento>_<entidad>.docx` (por ejemplo `2026_137_Contrato_CLUB_BTT_YUNQUERA.docx`). La anualidad va delante porque el nº de contrato se reinicia cada año. Los documentos generados con versiones anteriores (sin la anualidad) se siguen encontrando. Si el patrocinio no tiene nº de contrato, el nombre empieza por `SC` seguido del identificador del registro.
3. Se abre una vista previa. Desde ella:
   - **Imprimir o guardar como PDF**: en la ventana de impresión elige el destino *Guardar como PDF*.
   - **Descargar .docx**: descarga una copia del Word.
4. **Volver a generar** sobrescribe el documento anterior. **Ver / PDF** abre el último generado.

> La aplicación no puede convertir a PDF por sí sola y guardarlo en la carpeta sin intervención (los navegadores no lo permiten). El Word se guarda automáticamente; el PDF se obtiene en un paso desde la vista previa.

**Copias de seguridad** (solo administradores). En la carpeta `backups/` se guarda **una sola copia** de los datos: cada copia nueva sustituye a la anterior. Se hace sola la primera vez que se abre la aplicación cada día, y también antes de eliminar un patrocinio, de restaurar o de actualizar la base de datos. En *Copias de seguridad* se puede **Crear copia ahora** y **Restaurar** la que hay; antes de restaurar se guarda como copia el estado actual, así que se puede deshacer.

**Trabajar varios a la vez.** Cada cambio se guarda solo con los campos que has tocado. Antes de escribir, la aplicación relee `datos.sqlite` y aplica encima tus cambios, así que si otra persona ha modificado otros datos (incluso del mismo patrocinio) se conservan los de los dos. Cada 15 segundos (y al volver a la ventana) recoge lo que han guardado los demás; si alguien cambia el patrocinio que tienes abierto, la ficha se actualiza y te avisa. Si los dos cambiáis el mismo campo a la vez, queda el último que se guarda. Bajo el nombre de cada patrocinio se ve quién lo modificó por última vez.

## Parte 5 · Usuarios y roles

| Rol | Puede |
|---|---|
| **Consulta** | Ver patrocinios, pendientes, entidades y resumen; ver los documentos ya generados; exportar a Excel. No puede cambiar nada. |
| **Edición** | Además, crear, modificar, duplicar y renovar patrocinios, y generar documentos. |
| **Administración** | Además, eliminar patrocinios, fijar créditos y el límite del contrato menor, gestionar usuarios y copias de seguridad. |

**Cómo se entra.** Siempre con **usuario y contraseña de GESTCON**, tanto si los datos están en Google Drive como en una carpeta de red.
1. En cada ordenador, la primera vez, se conecta la carpeta: con Google Drive (con una cuenta de Google que tenga acceso a la carpeta, por ejemplo la del servicio) o eligiendo la carpeta de red. Si Google muestra «Google no ha verificado esta aplicación», pulsa **Configuración avanzada → Ir a GESTCON**: solo ocurre esa vez.
2. Después, cada persona escribe su usuario y contraseña. Al recargar la pestaña no se vuelve a pedir; al pulsar *Cerrar sesión* o cerrar la pestaña, sí.

**La primera vez con esta versión.** La aplicación actualiza `datos.sqlite` (con copia previa) y muestra *Protege los datos*: escribe tu nombre, usuario y contraseña de administrador. A partir de ese momento el archivo queda **cifrado**. Después se muestra un **código de recuperación**: apúntalo y guárdalo fuera de la carpeta.

**Datos cifrados.** `datos.sqlite` (y su copia de seguridad) se guarda cifrado (AES-256). La clave del archivo solo se puede abrir con la contraseña de un usuario activo o con el código de recuperación, así que nadie puede leer los datos sin entrar en GESTCON, aunque abra la carpeta. Las plantillas y los documentos Word generados no se cifran.
> **Importante:** si se perdieran todas las contraseñas de administrador **y** el código de recuperación, los datos no se podrían recuperar. Guarda el código en un lugar seguro.

**Dar de alta.** En *Usuarios* → *Nuevo usuario*: nombre, usuario, una contraseña provisional y el rol. La persona entra con esa contraseña y la aplicación le pide cambiarla por una suya. Los usuarios de la versión anterior que no tenían usuario aparecen como «Sin usuario»: ábrelos y ponles usuario y contraseña.

**Cambiar o quitar el acceso.** Pulsa el usuario en la lista: cambia su rol, ponle una contraseña nueva (si la ha olvidado), desmárcale *Activo* o elimínalo. Un usuario desactivado o eliminado deja de poder descifrar los datos. Los cambios llegan a quien esté trabajando en unos segundos. Siempre queda al menos un administrador activo, y nadie puede desactivarse a sí mismo.

**Olvidé la contraseña.** Un usuario normal: un administrador le pone una nueva en *Usuarios*. Un administrador: *¿Has olvidado la contraseña?* en la pantalla de entrada, con el código de recuperación (después se genera otro). En *Usuarios* se puede generar un código nuevo en cualquier momento; el anterior deja de valer.

**Restaurar una copia** recupera los datos, pero no los usuarios ni las contraseñas de entonces: el acceso sigue como está.

**Cerrar sesión / cambiar contraseña.** Abajo en el menú lateral (en móvil, arriba).

## Parte 6 · Modificar las plantillas

Las plantillas son documentos Word normales con etiquetas `{campo}` donde deben aparecer los datos. Se editan con Word en la carpeta `plantillas/` y los cambios se aplican la próxima vez que se genere un documento.

La lista de etiquetas, qué contiene cada una y cuáles usa cada plantilla está en [`docs/etiquetas-plantillas.md`](docs/etiquetas-plantillas.md). Reglas:
- Escribe la etiqueta de una sola vez, con un único formato (negrita, tamaño…); si el formato cambia a mitad de etiqueta, Word la parte y deja de funcionar.
- Respeta las llaves y las minúsculas: `{importe_total}`.
- Una etiqueta se puede repetir todas las veces que haga falta.
- Una etiqueta que no existe sale en blanco.

## Parte 7 · Problemas habituales

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
| «Usuario o contraseña incorrectos» | Revisa el usuario y la contraseña. Si el usuario está desactivado, también sale este mensaje: un administrador debe activarlo. |
| No encuentro la carpeta con otra cuenta de Google | Esa cuenta no tiene acceso a la carpeta: compártela en Drive con esa cuenta (o usa la cuenta del servicio). |
| Un administrador olvidó su contraseña | *¿Has olvidado la contraseña?* con el código de recuperación. Si se perdió, otro administrador puede asignarle una nueva en *Usuarios*. |
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
├── App.tsx                     rutas (#/, #/registro/ID, #/nuevo, #/pendientes, #/entidades, #/entidad/ID, #/resumen, #/copias)
├── components/                 pantallas: Listado, Ficha, Pendientes, Entidades, Resumen, PanelDocumentos, Copias, VistaPrevia…
├── lib/
│   ├── fs.ts                   interfaz de carpeta común; carpeta local (File System Access API)
│   ├── drive.ts                carpeta de Google Drive (Google Identity Services + Drive API v3)
│   ├── db.ts                   SQLite con sql.js
│   ├── store.tsx               estado, identidad, guardado y sincronización entre usuarios
│   ├── operaciones.ts          cambios como operaciones: combinar y comprobar que no se pierden
│   ├── acceso.ts               roles, permisos y reglas de contraseñas
│   ├── cifrado.ts              cifrado de datos.sqlite (AES-GCM) y llaves por usuario (PBKDF2)
│   ├── backups.ts              copia de seguridad (se conserva una sola)
│   ├── documentos.ts           docxtemplater + PizZip, nombres de archivo, datos de las plantillas
│   ├── format.ts               importes, fechas y campaña
│   ├── control.ts              contrato menor, crédito por aplicación, pendientes, municipios
│   ├── excel.ts                exportación a .xlsx (escrita con PizZip)
│   ├── textos.ts               importe en letra, fechas del evento, soportes enumerados
│   ├── schema.ts               esquema SQLite (versión 2)
│   ├── municipios.ts           municipios de la provincia (sugerencias)
│   └── borrador.ts             formulario ⇄ base de datos
docs/
├── esquema.sql                 esquema de datos.sqlite
└── etiquetas-plantillas.md     etiquetas de las plantillas
```

Pila: React 18, Vite, Tailwind CSS, TypeScript, [sql.js](https://sql.js.org), [docxtemplater](https://docxtemplater.com), PizZip y docx-preview.

### Base de datos

`datos.sqlite` (esquema versión 4) se guarda cifrado: `GESTCON1` + cabecera con las llaves de los usuarios activos (la clave del archivo envuelta con la contraseña de cada uno, PBKDF2-SHA256 + AES-GCM) + la base de datos cifrada con AES-256-GCM. Dentro tiene:
- `patrocinios`: un registro por expediente. La clave es `id`; `num_contrato` se reinicia cada año y puede repetirse. Guarda su propia copia de los datos de la entidad, el estado, las fechas de inicio y fin, el tipo de IVA y los importes en letra.
- `entidades`: una por CIF (agrupado sin espacios ni guiones, sin modificar cómo está escrito), con los datos de su patrocinio más reciente.
- `usuarios`: nombre, usuario, rol, si está activo y si debe cambiar la contraseña. Las contraseñas no se guardan.
- `llaves`: la llave de cada usuario y la del código de recuperación (de aquí se copian a la cabecera al guardar).
- `operaciones`: el identificador de cada cambio guardado en los últimos 30 días. Al trabajar varios a la vez, sirve para detectar un cambio que se haya perdido (dos personas escribiendo en el mismo instante) y volver a aplicarlo.
- `patrocinios.creado_por` y `modificado_por`: quién creó y quién modificó por última vez cada patrocinio.
- `configuracion`: versión del esquema, tipo de IVA por defecto, crédito de cada aplicación presupuestaria (`credito:<aplicación>`), límite del contrato menor (`limite_contrato_menor`, 15.000 € sin IVA si no se indica).

Reglas en la base de datos: importes no negativos, anualidad entre 2000 y 2100, fechas AAAA-MM-DD válidas, fin del evento no anterior al inicio, y fecha de modificación automática. Las actualizaciones desde las versiones 1, 2 y 3 están en `src/lib/db.ts` (`migrar`). El esquema completo está en [`docs/esquema.sql`](docs/esquema.sql).

## Origen

Migración de `GESTCON.accdb` (Access 2007): la tabla `DATOS` pasó a `patrocinios` y los marcadores de Word de las 8 plantillas a etiquetas `{campo}`. La consulta `ConsultaAnexos` (que filtraba los expedientes sin tramitar y calculaba importes sin IVA e IVA) se sustituye por la ficha de cada patrocinio.
