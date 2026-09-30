import { z } from 'zod'
import type { DatosRecibo } from './types'

const fecha = z.string().nullable().describe('Formato YYYY-MM-DD, o null si no figura')

/** Lo que el modelo tiene que devolver a partir del texto del recibo */
export const EsquemaRecibo = z.object({
  periodo: z.string().describe('Mes liquidado en formato YYYY-MM (ej: "Haberes mensual del mes de Agosto de 2026" -> "2026-08")'),
  tipoLiquidacion: z.enum(['mensual', 'sac', 'vacaciones', 'final', 'otro']),
  empleador: z.object({ nombre: z.string(), cuit: z.string().nullable() }),
  empleado: z.object({
    categoria: z.string().nullable().describe('Categoría, cargo o convenio'),
    fechaIngreso: fecha,
    obraSocial: z.string().nullable(),
  }),
  fechaPago: fecha,
  banco: z.string().nullable(),
  sussUltimoDeposito: z
    .object({ fecha, periodo: z.string().nullable().describe('Período depositado en formato YYYY-MM') })
    .nullable()
    .describe('Datos del último depósito de aportes (SUSS / art. 12 Ley 17.250), si figuran'),
  conceptos: z.array(
    z.object({
      codigo: z.string().nullable(),
      nombre: z.string().describe('Tal como figura, corrigiendo solo errores obvios de lectura'),
      cantidad: z.number().nullable(),
      tipo: z.enum(['remunerativo', 'no_remunerativo', 'retencion']).describe('Según la columna en la que figura el importe'),
      importe: z.number().describe('Siempre positivo, en pesos'),
    }),
  ),
  totales: z.object({
    remunerativo: z.number().nullable(),
    noRemunerativo: z.number().nullable(),
    retenciones: z.number().nullable(),
    neto: z.number().nullable(),
    netoEnLetras: z.number().nullable().describe('El importe escrito en palabras ("Recibí conforme la suma de..."), convertido a número'),
  }),
  costoEmpleador: z.number().nullable().describe('Costo total del empleador, si el recibo lo informa'),
  advertencias: z.array(z.string()).describe('Importes o campos dudosos, ilegibles o corregidos. Vacío si todo se leyó bien.'),
})

export type SalidaModelo = z.infer<typeof EsquemaRecibo>

export const INSTRUCCIONES = `Recibís el texto de un recibo de sueldo argentino (Ley 20.744) obtenido por OCR y lo pasás a datos estructurados.

El texto viene del OCR de una foto: mantiene más o menos las columnas, pero puede tener errores.
- Los montos usan punto para miles y coma para decimales: "74.030,18" es 74030.18.
- El OCR a veces pierde separadores ("1210000" puede ser 12.100,00) o confunde letras y números (O/0, S/5, l/1). Usá los totales impresos al pie de cada columna para deducir el valor correcto, y anotá en "advertencias" cada importe que corregiste.
- Cada concepto va en la columna de su importe: Remunerativos (con aportes), No remunerativos, o Retenciones/Descuentos.
- Solo incluí en "conceptos" las líneas del detalle de liquidación. No incluyas contribuciones patronales ni cuadros resumen (composición salarial, gráficos).
- Los totales van tal como están impresos; no los calcules vos. Si no hay total impreso, null.
- Los datos personales fueron reemplazados por marcas como [NOMBRE] o [CUIL/CUIT]: ignoralas.
- No inventes datos. Si algo no se puede leer, usá null y explicalo en "advertencias".
- Fechas "dd/mm/aaaa" -> "aaaa-mm-dd". Período "07/2026" -> "2026-07".`

/** Completa lo que no se le pide al modelo (datos personales que nunca salen del equipo) */
export function aDatosRecibo(salida: SalidaModelo): { datos: DatosRecibo; advertencias: string[] } {
  const { advertencias, empleado, ...resto } = salida
  return {
    datos: { ...resto, empleado: { ...empleado, nombre: '', cuil: null, legajo: null } },
    advertencias,
  }
}
