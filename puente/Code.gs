/**
 * GESTCON · Puente con Google Drive
 *
 * Pequeño script de Google Apps Script que guarda y lee los archivos de la carpeta «Patrocinios» de Drive
 * en nombre de su propietario. Así los usuarios de GESTCON entran solo con su usuario y contraseña,
 * sin iniciar sesión en Google.
 *
 * Seguridad:
 *  - Cada usuario de GESTCON tiene su propia credencial en el puente, calculada en su navegador a partir de su
 *    usuario y contraseña. El script solo guarda su huella (SHA-256).
 *  - Sin una credencial válida no se entrega nada, ni siquiera el archivo cifrado.
 *  - Los administradores dan de alta, cambian y retiran credenciales: un usuario eliminado o desactivado
 *    deja de tener acceso al momento. Cada usuario puede cambiar la suya (al cambiar su contraseña).
 *  - Arranque: mientras no hay ninguna credencial, se puede leer el archivo cifrado (para comprobar la
 *    contraseña) y el primer administrador se registra con el código de activación, de un solo uso.
 *
 * Propiedades del script (las pone la función configurar; ACCESOS lo mantiene la aplicación):
 *   CARPETA     id de la carpeta Patrocinios
 *   ACTIVACION  huella del código de activación (se borra al usarlo)
 *   ACCESOS     {usuario: {h: huella de su credencial, admin: true|false}}
 *   CREDENCIAL  (versión 1) huella de la credencial común; se sustituye por ACCESOS al migrar
 */
var VERSION = 2;
var MAGIA = 'GESTCON1';
var MIME_CARPETA = 'application/vnd.google-apps.folder';

function doGet() {
  return salida({ ok: true, app: 'gestcon-puente', version: VERSION });
}

function doPost(e) {
  try {
    var p = JSON.parse(e.postData.contents);
    return salida(atender(p));
  } catch (err) {
    return salida({ error: String((err && err.message) || err) });
  }
}

function atender(p) {
  var op = p.op;
  var ruta = p.ruta || [];
  var accesos = leerAccesos();
  var arranque = Object.keys(accesos).length === 0;
  var yo = quien(accesos, p);

  if (op === 'estado') {
    var estado = yo ? 'ok' : !arranque ? 'sin_permiso' : prop('CREDENCIAL') ? 'migrar' : 'sin_activar';
    return { ok: true, version: VERSION, estado: estado, admin: !!(yo && yo.admin) };
  }
  if (op === 'activar') return activar(p, accesos);

  // Mientras no hay ninguna credencial solo se puede leer el archivo cifrado (para comprobar la contraseña)
  var publico = arranque && ruta.length === 0 && p.nombre === 'datos.sqlite' && (op === 'existe' || op === 'marca' || op === 'leer');
  if (!yo && !publico) {
    if (arranque) throw new Error('sin_activar: la conexión aún no está activada.');
    Utilities.sleep(300);
    throw new Error('sin_permiso: usuario o credencial no válidos.');
  }

  switch (op) {
    case 'existe': {
      var d = carpeta(ruta, false);
      return { existe: !!(d && archivo(d, p.nombre)) };
    }
    case 'carpeta': {
      return { existe: !!carpeta(ruta, !!p.crear) };
    }
    case 'marca': {
      var f = archivoObligatorio(ruta, p.nombre);
      return { modificado: f.getLastUpdated().getTime(), marca: marcaDe(f) };
    }
    case 'leer': {
      var f2 = archivoObligatorio(ruta, p.nombre);
      var bytes = f2.getBlob().getBytes();
      if (!yo && !esCifrado(bytes)) throw new Error('sin_permiso: el archivo no está cifrado.');
      return { datos: Utilities.base64Encode(bytes), modificado: f2.getLastUpdated().getTime(), marca: marcaDe(f2) };
    }
    case 'escribir': return escribir(ruta, p.nombre, p.datos, p.mime);
    case 'borrar': {
      archivoObligatorio(ruta, p.nombre).setTrashed(true);
      return { ok: true };
    }
    case 'listar': {
      var dir = carpeta(ruta, false);
      if (!dir) throw new Error('No existe la carpeta «' + ruta.join('/') + '».');
      var out = [], it = dir.getFiles();
      while (it.hasNext()) {
        var x = it.next();
        out.push({ nombre: x.getName(), tamano: x.getSize(), modificado: x.getLastUpdated().getTime() });
      }
      return { archivos: out };
    }
    case 'acceso': return cambiarAcceso(p, yo);
    case 'accesos': {
      if (!yo.admin) throw new Error('Solo un administrador puede ver los accesos.');
      return { accesos: Object.keys(accesos).map(function (u) { return { usuario: u, admin: !!accesos[u].admin }; }) };
    }
  }
  throw new Error('Operación desconocida: ' + op);
}

// ---------- Accesos ----------
function leerAccesos() {
  try { return JSON.parse(prop('ACCESOS') || '{}'); } catch (e) { return {}; }
}

function guardarAccesos(a) {
  PropertiesService.getScriptProperties().setProperty('ACCESOS', JSON.stringify(a));
}

/** El usuario que hace la petición, si su credencial es válida */
function quien(accesos, p) {
  var u = p.usuario && accesos[p.usuario];
  if (!u || !p.credencial || huella(p.credencial) !== u.h) return null;
  return { usuario: p.usuario, admin: !!u.admin };
}

/** Registra al primer administrador: con el código de activación o, al migrar de la versión 1, con la credencial común */
function activar(p, accesos) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    accesos = leerAccesos();
    if (Object.keys(accesos).length) throw new Error('La conexión ya está activada.');
    var codigo = prop('ACTIVACION'), antigua = prop('CREDENCIAL');
    var vale = (codigo && p.codigo && huella(String(p.codigo).toUpperCase().replace(/[^A-Z0-9]/g, '')) === codigo) ||
      (antigua && p.legado && huella(p.legado) === antigua);
    if (!vale) {
      Utilities.sleep(800);
      throw new Error(p.legado ? 'No se pudo migrar la conexión.' : 'El código de activación no es correcto.');
    }
    if (!p.usuario || !p.credencial || String(p.credencial).length < 32) throw new Error('Credencial no válida.');
    accesos[p.usuario] = { h: huella(p.credencial), admin: true };
    guardarAccesos(accesos);
    var props = PropertiesService.getScriptProperties();
    props.deleteProperty('ACTIVACION');
    props.deleteProperty('CREDENCIAL');
    return { ok: true, estado: 'ok' };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Alta, cambio o baja del acceso de un usuario.
 *   objetivo: usuario; huella: huella de su credencial (null = quitar el acceso; sin indicar = no cambia); admin: true|false
 * Un administrador puede cambiar cualquiera; cada usuario, solo la huella del suyo.
 */
function cambiarAcceso(p, yo) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var accesos = leerAccesos();
    var obj = String(p.objetivo || '');
    if (!obj) throw new Error('Falta el usuario.');
    var propio = obj === yo.usuario;
    if (!yo.admin && !(propio && p.huella && p.admin === undefined)) throw new Error('Solo un administrador puede cambiar el acceso de otros usuarios.');
    if (p.huella === null) {
      delete accesos[obj];
    } else {
      var actual = accesos[obj];
      var h = p.huella || (actual && actual.h);
      if (h) {
        if (!/^[0-9a-f]{64}$/.test(h)) throw new Error('Huella no válida.');
        accesos[obj] = { h: h, admin: p.admin === undefined ? !!(actual && actual.admin) : !!p.admin };
      }
    }
    if (!Object.keys(accesos).some(function (u) { return accesos[u].admin; })) throw new Error('Tiene que quedar al menos un administrador con acceso.');
    guardarAccesos(accesos);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

// ---------- Archivos ----------
function escribir(ruta, nombre, b64, mime) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var dir = carpeta(ruta, true);
    var blob = Utilities.newBlob(Utilities.base64Decode(b64), mime || 'application/octet-stream', nombre);
    var f = archivo(dir, nombre);
    if (f) {
      // Se sustituye el contenido del mismo archivo (conserva su id y el historial de versiones de Drive)
      var r = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files/' + f.getId() + '?uploadType=media&supportsAllDrives=true', {
        method: 'patch', contentType: blob.getContentType(), payload: blob.getBytes(),
        headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true,
      });
      if (r.getResponseCode() >= 300) throw new Error('Drive no ha guardado «' + nombre + '» (' + r.getResponseCode() + ').');
      f = DriveApp.getFileById(f.getId());
    } else {
      f = dir.createFile(blob);
    }
    return { marca: marcaDe(f), modificado: f.getLastUpdated().getTime() };
  } finally {
    lock.releaseLock();
  }
}

function carpeta(ruta, crear) {
  var f = DriveApp.getFolderById(prop('CARPETA'));
  for (var i = 0; i < ruta.length; i++) {
    var it = f.getFoldersByName(ruta[i]);
    if (it.hasNext()) f = it.next();
    else if (crear) f = f.createFolder(ruta[i]);
    else return null;
  }
  return f;
}

/** El más reciente si hay varios con el mismo nombre */
function archivo(dir, nombre) {
  var it = dir.getFilesByName(nombre), mejor = null;
  while (it.hasNext()) {
    var x = it.next();
    if (x.getMimeType() === MIME_CARPETA) continue;
    if (!mejor || x.getLastUpdated() > mejor.getLastUpdated()) mejor = x;
  }
  return mejor;
}

function archivoObligatorio(ruta, nombre) {
  var d = carpeta(ruta, false);
  var f = d && archivo(d, nombre);
  if (!f) throw new Error('No existe «' + nombre + '» en la carpeta de Google Drive.');
  return f;
}

function marcaDe(f) { return f.getLastUpdated().getTime() + '-' + f.getSize(); }

function esCifrado(bytes) {
  if (bytes.length < 12) return false;
  for (var i = 0; i < MAGIA.length; i++) if (bytes[i] !== MAGIA.charCodeAt(i)) return false;
  return true;
}

// ---------- Utilidades ----------
function prop(k) { return PropertiesService.getScriptProperties().getProperty(k); }

function huella(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s), Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}

function salida(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Ejecutar una vez desde el editor al instalar: indica la carpeta y el código de activación (su huella).
 * No toca nada si la conexión ya está activada.
 */
function configurar() {
  var props = PropertiesService.getScriptProperties();
  props.setProperty('CARPETA', '1dHN52Rhci30OrJJu9oObRyYbGAN0rESL');
  if (!props.getProperty('CREDENCIAL') && !props.getProperty('ACCESOS')) props.setProperty('ACTIVACION', 'b6c66586a8f3ed7a468939afa5a2c60f3158241afa23bb5e201fdb85006fd9b3');
  // Comprueba el acceso a Drive y a internet (así Google pide los permisos ahora)
  ScriptApp.getOAuthToken();
  UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/about?fields=user', { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
  probar();
}

/** Ejecutar una vez desde el editor para comprobar el acceso a la carpeta (y conceder los permisos) */
function probar() {
  var d = DriveApp.getFolderById(prop('CARPETA'));
  Logger.log('Carpeta: ' + d.getName() + ' · datos.sqlite: ' + (archivo(d, 'datos.sqlite') ? 'sí' : 'no') + ' · usuarios con acceso: ' + Object.keys(leerAccesos()).length);
}
