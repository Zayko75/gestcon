# GESTCON · Resumen de las sesiones de trabajo (oct–nov 2026)

Resumen de todo lo tratado en las conversaciones del Proyecto «GESTCON» de claude.ai, para
continuar en Claude Code sin perder contexto. Conversación original:
https://claude.ai/chat/06050204-badd-4d79-b758-c4fc2563ed08 (última actividad 13/11/2026).

## 1. Migración original (5 fases, 5/10/2026)
1. **Análisis** del Access (`FASE1_Analisis.md`): una tabla `DATOS` (104 filas, 24 campos), una
   consulta `ConsultaAnexos`, un formulario y 9 módulos VBA; 137 marcadores en 8 plantillas.
2. **Esquema SQLite** y `datos.sqlite` (`FASE2_Notas.md`): 103 registros (se descartó la fila 50).
3. **Plantillas** convertidas a etiquetas `{campo}` (`FASE3_Notas.md`): 824 documentos de prueba sin errores.
4. **App** React/Vite/Tailwind/TS (`FASE4_Notas.md`): 29 pruebas de extremo a extremo en Chrome.
5. **Repositorio** con workflow de GitHub Pages y README (`FASE5_Notas.md`).

## 2. Cambio de ubicación de los datos
- Primero se pensó en una carpeta de red; después Bienve decidió que la carpeta `Patrocinios`
  esté en **su Google Drive** y que la app se conecte directamente a ella.
- **Se mantienen los dos modos**: Google Drive y carpeta local/de red (Bienve pidió
  expresamente no quitar ninguno).

## 3. Base de datos v2 (8/10/2026)
Ver `PROPUESTA_BD.md` (propuesta) y `MEJORAS_BD_v2.md` (lo aprobado e implementado):
entidades, estado del expediente, IVA por patrocinio, importe en letra automático,
soportes enumerados automáticos, fechas de inicio/fin, municipios, documentos con anualidad
en el nombre, reglas CHECK, migración automática con copia previa.
Condiciones de Bienve: CIF sin normalizar, nº de contrato repetible entre años, documentos
idénticos salvo errores reales de datos.

## 4. Mejoras posteriores de la app
- Corrección de la vista previa Word (paginación y alineación de tablas).
- Pantallas **Pendientes**, **Entidades**, **Resumen** (crédito por aplicación presupuestaria
  y límite de contrato menor de 15.000 € sin IVA), **Calendario** y **Eventos**.
- Lote de mejoras aprobado con «Implementa todo menos la 3, 5, 10»: se hicieron 1, 2, 4, 6,
  7, 8 (exportar a Excel) y 9 (panel resumen anual). **No** se hicieron la 3, la 5 ni la 10
  (historial de cambios por registro).
- Filtros avanzados, **deshacer/rehacer** en la ficha (Ctrl+Z / Ctrl+Y, «Ver cambios»).
- Estados ampliados: En preparación, Pendiente de firma, Firmado, Pendiente de factura,
  Tramitado, Pagado.
- Copias de seguridad: Bienve pidió conservar **una sola copia** (no 30).
- Dos cambios de logo; el segundo, más grande en la pantalla de entrada y sin el borde blanco.

## 5. Usuarios, cifrado y multiusuario
- Se sustituyó el acceso con cuenta de Google por **usuario y contraseña de GESTCON**.
- Roles: consulta, edición, administración. Siempre queda al menos un administrador activo.
- `datos.sqlite` cifrado con AES-256-GCM; clave del archivo envuelta con PBKDF2 por usuario;
  **código de recuperación** para administradores.
- Varios usuarios a la vez: cambios guardados como operaciones, combinación al guardar,
  sincronización cada 15 s, `creado_por` / `modificado_por`.
- Esquema: versión 4 con el cifrado; versión 5 con los estados «Pendiente de factura» y
  «Pagado»; **versión 6** (13/11/2026): los patrocinios de años anteriores a 2026 pasan a «Pagado».
- Opción de despliegue con Docker (nginx, puerto 8080) además de GitHub Pages.

## 6. Puente de Google Apps Script (`puente/Code.gs`)
- Instalado en la cuenta de Google de Bienve (dueña de `Patrocinios`); los usuarios nunca ven
  la pantalla de Google. URL `/exec` en `src/lib/puente.ts` (`URL_PUENTE`).
- **Versión 2 (13/11/2026)**: tras detectar Bienve que un usuario eliminado seguía pudiendo
  usar el puente, cada usuario tiene su **propia credencial** (PBKDF2 de su contraseña con sal
  dependiente del usuario; el script solo guarda la huella SHA-256 en la propiedad `ACCESOS`).
  Al desactivar o eliminar un usuario pierde el acceso al momento. Migración automática desde
  la v1 (credencial común). Código de activación de un solo uso.
- Probado ejecutando el `Code.gs` real en Node con servicios de Google simulados, e instalado
  y redesplegado en la misma URL.

## 7. Notas técnicas útiles
- Apps Script: para pegar código largo en el editor, usar
  `monaco.editor.getModels().find(m => m.uri.toString().endsWith('.js')).setValue(codigo)` y
  después Ctrl+S (escribir con el teclado trunca).
- Redesplegar sin cambiar la URL: Implementar → Gestionar implementaciones → Editar (lápiz)
  → Versión nueva → Implementar.
- La función `configurar()` del script fija las propiedades y lanza el consentimiento OAuth.
- Probar el puente desde la consola: `fetch(url, {method:'POST', body: JSON.stringify(...),
  headers:{'Content-Type':'text/plain;charset=utf-8'}, credentials:'omit'})` (evita CORS).
- Pruebas de la app: Playwright sin cabeza contra `npx vite preview --port 4173`.

## 8. Forma de trabajar de Bienve
- Propuestas numeradas; él aprueba o descarta por número.
- Los documentos Word generados no deben cambiar visualmente salvo datos erróneos.
- Verificación real de extremo a extremo antes de dar algo por terminado.
- Prefiere que se le diga claramente si algo está roto o es arriesgado.
- No da credenciales de Google; los pasos con su inicio de sesión los hace él.
