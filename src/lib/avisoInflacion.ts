/**
 * Aviso de inflación nueva: cuando INDEC publica un mes de IPC que la persona todavía no vio.
 * Funciones puras: las usa la app y también el service worker.
 */
import type { DatosRecibo } from './types'
import { serieSalarial, ultimoPeriodo, valorIpc, type SerieMensual } from './analysis'
import { desdeUltimoAumento, soloMensuales } from './indicadores'
import { sumarMeses } from './format'

export const AJUSTE_INFLACION_VISTA = 'inflacionVista'
export const AJUSTE_INFLACION_NOTIFICADA = 'inflacionNotificada'

export interface AvisoInflacion {
  periodo: string
  mensual: number
  interanual: number | null
  /** Cuánto subió tu neto ese mes y la diferencia (en puntos) contra la inflación */
  tuMes: { variacion: number; diferencia: number } | null
  desdeAumento: { periodo: string; inflacion: number; perdida: number } | null
}

export function avisoInflacion(ipc: SerieMensual, recibos: DatosRecibo[], vista: string | undefined): AvisoInflacion | null {
  const periodo = ultimoPeriodo(ipc)
  if (!periodo || (vista && periodo <= vista)) return null
  const actual = ipc.get(periodo)!
  const anterior = valorIpc(ipc, sumarMeses(periodo, -1))
  if (!anterior) return null
  const haceUnAnio = ipc.get(sumarMeses(periodo, -12))
  const mensual = actual / anterior - 1

  const serie = serieSalarial(soloMensuales(recibos), {})
  const neto = (p: string) => serie.find((s) => s.periodo === p)?.neto
  const n1 = neto(periodo)
  const n0 = neto(sumarMeses(periodo, -1))
  const variacion = n1 && n0 ? n1 / n0 - 1 : null

  const aumento = desdeUltimoAumento(recibos, ipc)
  return {
    periodo,
    mensual,
    interanual: haceUnAnio ? actual / haceUnAnio - 1 : null,
    tuMes: variacion == null ? null : { variacion, diferencia: variacion - mensual },
    desdeAumento: aumento && aumento.periodo < periodo ? { periodo: aumento.periodo, inflacion: aumento.inflacion, perdida: aumento.perdidaPoderCompra } : null,
  }
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const mes = (p: string) => MESES[Number(p.slice(5)) - 1]
const pct = (n: number) => `${(n * 100).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`

export function textoAvisoInflacion(a: AvisoInflacion) {
  const partes: string[] = []
  if (a.interanual != null) partes.push(`Interanual: ${pct(a.interanual)}.`)
  if (a.tuMes) {
    const { variacion, diferencia } = a.tuMes
    // Poder de compra real: lo que subió el sueldo descontando lo que subieron los precios
    const real = (1 + variacion) / (1 + a.mensual) - 1
    if (variacion <= 0.0005) partes.push(`Ese mes tu sueldo no subió: perdiste ${pct(-real)} de poder de compra.`)
    else if (diferencia >= 0) partes.push(`Ese mes tu sueldo subió ${pct(variacion)}: le ganaste a la inflación.`)
    else partes.push(`Ese mes tu sueldo subió ${pct(variacion)}, menos que los precios: perdiste ${pct(-real)} de poder de compra.`)
  }
  if (a.desdeAumento) {
    partes.push(`Desde tu último aumento (${mes(a.desdeAumento.periodo)}) los precios subieron ${pct(a.desdeAumento.inflacion)}: tu sueldo compra ${pct(a.desdeAumento.perdida)} menos.`)
  }
  return { titulo: `Inflación de ${mes(a.periodo)}: ${pct(a.mensual)}`, cuerpo: partes.join(' ') }
}
