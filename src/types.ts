export type Estado = 'preparacion' | 'pendiente_firma' | 'firmado' | 'tramitado'

export interface Patrocinio {
  id: number
  estado: Estado
  entidad_id: number | null
  entidad: string
  cif: string
  representante_legal: string
  dni_nie_representante: string
  telefono: string
  email: string
  anualidad: number | null
  evento: string
  fecha_celebracion: string
  fecha_inicio: string | null
  fecha_fin: string | null
  plazo_ejecucion: string | null
  municipios: string
  soportes_cedidos: string
  soportes_propios: string
  soportes_enumerados: string
  num_contrato: number | null
  importe_total: number
  iva_pct: number
  importe_letra: string
  importe_letra_sin_iva: string
  aplicacion: string
  importe_reding: number
  fecha_firma: string | null
  creado: string
  modificado: string
  creado_por: string
  modificado_por: string
}

export type DatosPatrocinio = Omit<Patrocinio, 'id' | 'creado' | 'modificado' | 'entidad_id' | 'creado_por' | 'modificado_por'>

// ---------- Usuarios ----------
export type Rol = 'consulta' | 'edicion' | 'admin'

export interface Usuario {
  id: number
  nombre: string
  email: string | null
  usuario: string | null
  clave_hash: string | null
  clave_sal: string | null
  cambiar_clave: number
  rol: Rol
  activo: number
  creado: string
  modificado: string
}

export interface Entidad {
  id: number
  clave_cif: string
  cif: string
  nombre: string
  representante_legal: string
  dni_nie_representante: string
  telefono: string
  email: string
}

/** Lo que cambió al actualizar el archivo a una versión nueva del esquema */
export interface InformeMigracion {
  desde: number
  hasta: number
  /** Versión 3: usuarios y trabajo simultáneo */
  usuarios?: boolean
  entidades: number
  fechasDeducidas: number
  cambiosTexto: { id: number; campo: string; antes: string; despues: string }[]
}

export interface Copia {
  nombre: string
  fecha: Date
  tamano: number
  motivo: string
}
