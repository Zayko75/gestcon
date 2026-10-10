// Cifrado de datos.sqlite.
//
// El archivo se cifra con una «clave de datos» aleatoria (AES-256-GCM). Esa clave no se guarda tal cual:
// para cada usuario se guarda una copia «envuelta» con una clave derivada de su contraseña (PBKDF2-SHA256),
// y otra envuelta con el código de recuperación. Al entrar, la contraseña desenvuelve la clave de datos y
// con ella se descifra el archivo. Sin un usuario y contraseña válidos el archivo es ilegible.
//
// Formato del archivo cifrado:
//   «GESTCON1» (8 bytes) · longitud de la cabecera (4 bytes) · cabecera JSON · iv (12 bytes) · datos cifrados
// La cabecera (llaves de cada usuario) va en claro para poder entrar, pero queda autenticada: si alguien la
// modifica, el archivo no se descifra.

const MAGIA = new TextEncoder().encode('GESTCON1')
export const ITERACIONES = 150_000

/** Llave de un usuario (o del código de recuperación): la clave de datos envuelta con su contraseña */
export interface Llave {
  /** «u:<id de usuario>» o «recuperacion» */
  t: string
  /** Nombre de usuario en minúsculas (vacío en la de recuperación) */
  u: string
  /** Sal, iv y clave envuelta, en base64 */
  s: string
  i: string
  k: string
}
interface Cabecera { v: 1; it: number; llaves: Llave[] }

const b64 = (a: ArrayBuffer | Uint8Array) => { let s = ''; for (const c of new Uint8Array(a)) s += String.fromCharCode(c); return btoa(s) }
const deB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

export function estaCifrado(bytes: Uint8Array): boolean {
  return bytes.length > 12 && MAGIA.every((b, i) => bytes[i] === b)
}

function partes(bytes: Uint8Array): { cabeceraBytes: Uint8Array; cabecera: Cabecera; iv: Uint8Array; cuerpo: Uint8Array } {
  const largo = new DataView(bytes.buffer, bytes.byteOffset + 8, 4).getUint32(0)
  const cabeceraBytes = bytes.subarray(12, 12 + largo)
  const cabecera = JSON.parse(new TextDecoder().decode(cabeceraBytes)) as Cabecera
  const iv = bytes.subarray(12 + largo, 24 + largo)
  return { cabeceraBytes, cabecera, iv, cuerpo: bytes.subarray(24 + largo) }
}

/** Llaves guardadas en la cabecera de un archivo cifrado */
export function llavesDe(bytes: Uint8Array): Llave[] {
  return estaCifrado(bytes) ? partes(bytes).cabecera.llaves : []
}

async function claveDeContrasena(contrasena: string, sal: Uint8Array, iteraciones = ITERACIONES): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(contrasena.normalize('NFC')), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: sal as BufferSource, iterations: iteraciones }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

/** Clave de datos nueva (32 bytes aleatorios) */
export const nuevaClaveDatos = () => crypto.getRandomValues(new Uint8Array(32))

/** Envuelve la clave de datos con una contraseña: es la «llave» de ese usuario */
export async function envolver(claveDatos: Uint8Array, contrasena: string, titular: string, usuario: string): Promise<Llave> {
  const sal = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const kek = await claveDeContrasena(contrasena, sal)
  const k = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, kek, claveDatos as BufferSource)
  return { t: titular, u: usuario, s: b64(sal), i: b64(iv), k: b64(k) }
}

/** Abre una llave con la contraseña. Devuelve la clave de datos, o null si la contraseña no es la de esa llave. */
export async function desenvolver(llave: Llave, contrasena: string, iteraciones = ITERACIONES): Promise<Uint8Array | null> {
  try {
    const kek = await claveDeContrasena(contrasena, deB64(llave.s), iteraciones)
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deB64(llave.i) as BufferSource }, kek, deB64(llave.k) as BufferSource))
  } catch {
    return null
  }
}

/** Cifra la base de datos con la clave de datos y pone en la cabecera las llaves indicadas */
export async function cifrar(datos: Uint8Array, claveDatos: Uint8Array, llaves: Llave[]): Promise<Uint8Array> {
  const cabeceraBytes = new TextEncoder().encode(JSON.stringify({ v: 1, it: ITERACIONES, llaves } satisfies Cabecera))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const clave = await crypto.subtle.importKey('raw', claveDatos as BufferSource, 'AES-GCM', false, ['encrypt'])
  const cuerpo = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource, additionalData: cabeceraBytes as BufferSource }, clave, datos as BufferSource))
  const out = new Uint8Array(12 + cabeceraBytes.length + 12 + cuerpo.length)
  out.set(MAGIA, 0)
  new DataView(out.buffer).setUint32(8, cabeceraBytes.length)
  out.set(cabeceraBytes, 12)
  out.set(iv, 12 + cabeceraBytes.length)
  out.set(cuerpo, 24 + cabeceraBytes.length)
  return out
}

export class ClaveIncorrectaError extends Error {
  constructor() { super('No se pueden descifrar los datos con esta clave (¿se ha cambiado el archivo por otro?).') }
}

/** Descifra el archivo con la clave de datos */
export async function descifrar(bytes: Uint8Array, claveDatos: Uint8Array): Promise<Uint8Array> {
  const { cabeceraBytes, iv, cuerpo } = partes(bytes)
  const clave = await crypto.subtle.importKey('raw', claveDatos as BufferSource, 'AES-GCM', false, ['decrypt'])
  try {
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource, additionalData: cabeceraBytes as BufferSource }, clave, cuerpo as BufferSource))
  } catch {
    throw new ClaveIncorrectaError()
  }
}

/** Busca la llave del usuario y la abre con su contraseña. Devuelve la clave de datos o null. */
export async function entrarCon(bytes: Uint8Array, usuario: string, contrasena: string): Promise<{ claveDatos: Uint8Array; titular: string } | null> {
  if (!estaCifrado(bytes)) return null
  const { cabecera } = partes(bytes)
  const u = usuario.trim().toLowerCase()
  for (const ll of cabecera.llaves.filter((x) => x.u && x.u === u)) {
    const clave = await desenvolver(ll, contrasena, cabecera.it)
    if (clave) return { claveDatos: clave, titular: ll.t }
  }
  return null
}

/** Abre la llave de recuperación con el código */
export async function entrarConCodigo(bytes: Uint8Array, codigo: string): Promise<Uint8Array | null> {
  if (!estaCifrado(bytes)) return null
  const { cabecera } = partes(bytes)
  const ll = cabecera.llaves.find((x) => x.t === 'recuperacion')
  return ll ? desenvolver(ll, codigo, cabecera.it) : null
}

export const claveDatosAB64 = (c: Uint8Array) => b64(c)
export const claveDatosDeB64 = (s: string) => deB64(s)
