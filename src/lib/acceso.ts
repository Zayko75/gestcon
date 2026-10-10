// Control de acceso: roles, permisos y reglas de contraseñas.
// Las contraseñas no se guardan: con ellas se abre la llave que descifra los datos (ver cifrado.ts).
import type { Rol, Usuario } from '../types'

// ---------- Roles ----------
export const ROLES: { valor: Rol; texto: string; descripcion: string }[] = [
  { valor: 'consulta', texto: 'Consulta', descripcion: 'Ve los patrocinios, el resumen y los documentos ya generados, y exporta a Excel. No puede cambiar nada.' },
  { valor: 'edicion', texto: 'Edición', descripcion: 'Además crea y modifica patrocinios, los renueva y genera documentos.' },
  { valor: 'admin', texto: 'Administración', descripcion: 'Además elimina patrocinios, fija créditos y el límite del contrato menor, gestiona usuarios y copias de seguridad.' },
]
export const textoRol = (r: Rol) => ROLES.find((x) => x.valor === r)?.texto ?? r

export type Accion = 'ver' | 'editar' | 'administrar'
const NIVEL: Record<Rol, number> = { consulta: 0, edicion: 1, admin: 2 }
const NECESITA: Record<Accion, number> = { ver: 0, editar: 1, administrar: 2 }

export function puede(rol: Rol | null | undefined, accion: Accion): boolean {
  return !!rol && NIVEL[rol] >= NECESITA[accion]
}

export class SinPermisoError extends Error {
  constructor(accion: Accion) {
    super(accion === 'administrar' ? 'Solo un administrador puede hacer esto.' : 'Tu usuario es de consulta: no puede modificar datos.')
  }
}

// ---------- Contraseñas ----------
export const LONGITUD_MINIMA = 8

export function problemaClave(clave: string): string | null {
  if (clave.length < LONGITUD_MINIMA) return `La contraseña debe tener al menos ${LONGITUD_MINIMA} caracteres.`
  if (!/[A-Za-zÀ-ÿ]/.test(clave) || !/\d/.test(clave)) return 'La contraseña debe tener letras y números.'
  return null
}

/** Código de recuperación: 16 caracteres fáciles de copiar (sin 0/O, 1/I/L) */
export function nuevoCodigoRecuperacion(): string {
  const letras = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const v = crypto.getRandomValues(new Uint8Array(16))
  const s = [...v].map((n) => letras[n % letras.length]).join('')
  return s.match(/.{4}/g)!.join('-')
}
export const normalizarCodigo = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '')

// ---------- Usuarios ----------
export const normalizarUsuario = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '.')

/** Nombre que se guarda como autor de los cambios */
export const nombreAutor = (u: Pick<Usuario, 'nombre' | 'email' | 'usuario'>) => u.nombre || u.email || u.usuario || ''

/** Id único de cada operación */
export const nuevoIdOperacion = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`)
