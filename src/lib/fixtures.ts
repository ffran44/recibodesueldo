import type { DatosRecibo } from './types'

/** Recibo docente con la estructura de uno real; nombres y montos son inventados */
export const reciboDocente: DatosRecibo = {
  periodo: '2026-08',
  tipoLiquidacion: 'mensual',
  empleador: { nombre: 'INSTITUTO EJEMPLO', cuit: null },
  empleado: { nombre: 'PERSONA EJEMPLO', cuil: null, legajo: null, categoria: 'docente', fechaIngreso: '2021-03-01', obraSocial: 'APROSS' },
  fechaPago: '2026-09-04',
  banco: null,
  sussUltimoDeposito: { fecha: '2026-08-11', periodo: '2026-07' },
  conceptos: [
    { codigo: null, nombre: 'ASIG BASICA', cantidad: null, tipo: 'remunerativo', importe: 215300.40 },
    { codigo: null, nombre: 'PROM CALID EDUC', cantidad: null, tipo: 'remunerativo', importe: 31250.10 },
    { codigo: null, nombre: 'ANTIGUEDAD', cantidad: null, tipo: 'remunerativo', importe: 64580.25 },
    { codigo: null, nombre: 'ESTADO DOCENTE', cantidad: null, tipo: 'remunerativo', importe: 88410.00 },
    { codigo: null, nombre: 'COMP REMUN', cantidad: null, tipo: 'remunerativo', importe: 19875.35 },
    { codigo: null, nombre: 'GTOS INH LAB DOCE', cantidad: null, tipo: 'remunerativo', importe: 52300.80 },
    { codigo: null, nombre: 'MAT DIDACT', cantidad: null, tipo: 'remunerativo', importe: 36940.15 },
    { codigo: null, nombre: 'ITEM PROFES DOCENTE', cantidad: null, tipo: 'remunerativo', importe: 65210.45 },
    { codigo: null, nombre: 'ADIC POR FUNC DOCENTE', cantidad: null, tipo: 'remunerativo', importe: 158620.50 },
    { codigo: null, nombre: 'COMPEN PROVINCIAL', cantidad: null, tipo: 'no_remunerativo', importe: 105000.00 },
    { codigo: null, nombre: 'COMPL NO REM', cantidad: 1, tipo: 'no_remunerativo', importe: 78120.60 },
    { codigo: null, nombre: 'Jubilacion 11%', cantidad: null, tipo: 'retencion', importe: 80573.68 },
    { codigo: null, nombre: 'FONDO ENF CATAS', cantidad: null, tipo: 'retencion', importe: 12100.00 },
    { codigo: null, nombre: 'AJ DIF MIN APROSS', cantidad: null, tipo: 'retencion', importe: 15230.40 },
    { codigo: null, nombre: 'OBRA SOCIAL', cantidad: null, tipo: 'retencion', importe: 47100.25 },
    { codigo: null, nombre: 'A OB L 10.724 ART 9', cantidad: null, tipo: 'retencion', importe: 14410.90 },
  ],
  totales: { remunerativo: 732488.00, noRemunerativo: 183120.60, retenciones: 169415.23, neto: 746193.37, netoEnLetras: 746193.37 },
  costoEmpleador: 1098730.60,
}

export function variante(base: DatosRecibo, cambios: Partial<DatosRecibo>): DatosRecibo {
  return structuredClone({ ...base, ...cambios })
}
