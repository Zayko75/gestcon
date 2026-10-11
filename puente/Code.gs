/**
 * GESTCON · Puente con Google Drive
 *
 * Pequeño script de Google Apps Script que guarda y lee los archivos de la carpeta «Patrocinios» de Drive
 * en nombre de su propietario. Así los usuarios de GESTCON entran solo con su usuario y contraseña,
 * sin iniciar sesión en Google.
 *
 * Seguridad:
 *  - datos.sqlite está cifrado. Sin credencial solo se puede leer ese archivo cifrado (lo necesita la
 *    pantalla de entrada para comprobar el usuario y la contraseña) y nunca si estuviera sin cifrar.
 *  - Todo lo demás (guardar, plantillas, documentos, copias) exige una credencial que solo puede calcular
 *    quien ha entrado con una contraseña válida. El script guarda únicamente su huella (SHA-256).
 *  - La primera credencial se registra una sola vez con un código de activación de un solo uso.
 *
 * Propiedades del script (las pone la función configurar):
 *   CARPETA     id de la carpeta Patrocinios
 *   ACTIVACION  huella SHA-256 del código de activación (se borra al usarlo)
 *   CREDENCIAL  huella SHA-256 de la credencial (la pone la activación)
 */
var VERSION = 1;
var MAGIA = 'GESTCON1';
var MIME_CARPETA = 'application/vnd.google-apps.folder';

function doGet() {
  return salida({ ok: true, app: 'gestcon-puente', version: VERSION, activado: !!prop('CREDENCIAL') });
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
  var publico = ruta.length === 0 && p.nombre === 'datos.sqlite' && (op === 'existe' || op === 'marca' || op === 'leer');

  if (op === 'estado') {
    var h = prop('CREDENCIAL');
    return { ok: true, version: VERSION, estado: !h ? 'sin_activar' : (p.credencial && huella(p.credencial) === h ? 'ok' : 'sin_permiso') };
  }
  if (op === 'activar') return activar(p);
  if (!publico) comprobarCredencial(p.credencial);

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
      if (publico && !esCifrado(bytes)) comprobarCredencial(p.credencial); // nunca se entrega sin cifrar
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
  }
  throw new Error('Operación desconocida: ' + op);
}

// ---------- Credencial ----------
function activar(p) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var codigo = prop('ACTIVACION');
    if (prop('CREDENCIAL') && !codigo) throw new Error('La conexión ya está activada.');
    if (!codigo || !p.codigo || huella(String(p.codigo).toUpperCase().replace(/[^A-Z0-9]/g, '')) !== codigo) {
      Utilities.sleep(800);
      throw new Error('El código de activación no es correcto.');
    }
    if (!p.credencial || String(p.credencial).length < 32) throw new Error('Credencial no válida.');
    var props = PropertiesService.getScriptProperties();
    props.setProperty('CREDENCIAL', huella(p.credencial));
    props.deleteProperty('ACTIVACION');
    return { ok: true, estado: 'ok' };
  } finally {
    lock.releaseLock();
  }
}

function comprobarCredencial(c) {
  var h = prop('CREDENCIAL');
  if (!h) throw new Error('sin_activar: la conexión aún no está activada.');
  if (!c || huella(c) !== h) throw new Error('sin_permiso: credencial no válida.');
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
  if (!props.getProperty('CREDENCIAL')) props.setProperty('ACTIVACION', 'b6c66586a8f3ed7a468939afa5a2c60f3158241afa23bb5e201fdb85006fd9b3');
  // Comprueba el acceso a Drive y a internet (así Google pide los permisos ahora)
  ScriptApp.getOAuthToken();
  UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/about?fields=user', { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
  probar();
}

/** Ejecutar una vez desde el editor para comprobar el acceso a la carpeta (y conceder los permisos) */
function probar() {
  var d = DriveApp.getFolderById(prop('CARPETA'));
  Logger.log('Carpeta: ' + d.getName() + ' · datos.sqlite: ' + (archivo(d, 'datos.sqlite') ? 'sí' : 'no') + ' · activado: ' + !!prop('CREDENCIAL'));
}
