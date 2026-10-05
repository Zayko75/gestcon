export interface Patrocinio {
  id: number
  tramitado: number
  entidad: string
  cif: string
  representante_legal: string
  dni_nie_representante: string
  telefono: string
  email: string
  anualidad: number | null
  evento: string
  fecha_celebracion: string
  plazo_ejecucion: string | null
  municipios: string
  soportes_cedidos: string
  soportes_propios: string
  soportes_enumerados: string
  num_contrato: number | null
  importe_total: number
  importe_letra: string
  importe_letra_sin_iva: string
  aplicacion: string
  importe_reding: number
  fecha_firma: string | null
  creado: string
  modificado: string
}

export type DatosPatrocinio = Omit<Patrocinio, 'id' | 'creado' | 'modificado'>

export interface Copia {
  nombre: string
  fecha: Date
  tamano: number
  motivo: string
}
