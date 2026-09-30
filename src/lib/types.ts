export type TipoConcepto = 'remunerativo' | 'no_remunerativo' | 'retencion'

export interface Concepto {
  codigo: string | null
  nombre: string
  cantidad: number | null
  tipo: TipoConcepto
  importe: number
}

export type TipoLiquidacion = 'mensual' | 'sac' | 'vacaciones' | 'final' | 'otro'

export interface DatosRecibo {
  /** YYYY-MM del mes liquidado */
  periodo: string
  tipoLiquidacion: TipoLiquidacion
  empleador: { nombre: string; cuit: string | null }
  empleado: {
    nombre: string
    cuil: string | null
    legajo: string | null
    categoria: string | null
    /** YYYY-MM-DD */
    fechaIngreso: string | null
    obraSocial: string | null
  }
  /** YYYY-MM-DD */
  fechaPago: string | null
  banco: string | null
  sussUltimoDeposito: { fecha: string | null; periodo: string | null } | null
  conceptos: Concepto[]
  totales: {
    remunerativo: number | null
    noRemunerativo: number | null
    retenciones: number | null
    neto: number | null
    /** El neto escrito en letras, convertido a número */
    netoEnLetras: number | null
  }
  costoEmpleador: number | null
}

export interface Recibo extends DatosRecibo {
  id: string
  creadoEn: string
  actualizadoEn: string
  notas: string
  /** Lo que el modelo no pudo leer bien */
  advertenciasLectura: string[]
}

export interface Adjunto {
  id?: number
  reciboId: string
  nombre: string
  tipo: string
  blob: Blob
}
