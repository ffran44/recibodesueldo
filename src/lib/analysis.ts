import type { DatosRecibo } from './types'
import { totalesEfectivos } from './audit'
import { mesesEntre, redondear } from './format'

/** IPC por período YYYY-MM */
export type SerieMensual = Map<string, number>
/** Cotización (venta) por fecha YYYY-MM-DD */
export type SerieDiaria = Map<string, number>

export function valorIpc(ipc: SerieMensual, periodo: string) {
  if (ipc.has(periodo)) return ipc.get(periodo)!
  // Si INDEC todavía no publicó el mes, usamos el último disponible anterior
  const previos = [...ipc.keys()].filter((k) => k <= periodo).sort()
  return previos.length ? ipc.get(previos[previos.length - 1])! : null
}

export function ultimoPeriodo(serie: SerieMensual) {
  return [...serie.keys()].sort().at(-1) ?? null
}

export function cotizacionAl(serie: SerieDiaria, fecha: string) {
  if (serie.has(fecha)) return serie.get(fecha)!
  let mejor: string | null = null
  for (const k of serie.keys()) if (k <= fecha && (!mejor || k > mejor)) mejor = k
  return mejor ? serie.get(mejor)! : null
}

export const fechaReferencia = (r: DatosRecibo) => {
  if (r.fechaPago) return r.fechaPago
  const [a, m] = r.periodo.split('-').map(Number)
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10)
}

export interface PuntoSerie {
  periodo: string
  neto: number
  bruto: number
  /** Neto expresado en pesos del último IPC publicado */
  netoReal: number | null
  usdOficial: number | null
  usdBlue: number | null
}

export function serieSalarial(
  recibos: DatosRecibo[],
  { ipc, oficial, blue }: { ipc?: SerieMensual; oficial?: SerieDiaria; blue?: SerieDiaria },
): PuntoSerie[] {
  const base = ipc && ultimoPeriodo(ipc) ? valorIpc(ipc, ultimoPeriodo(ipc)!) : null
  // Si hay más de una liquidación en el mes (SAC, otro empleo) se suman
  const porPeriodo = new Map<string, { neto: number; bruto: number; fecha: string }>()
  for (const r of recibos) {
    const t = totalesEfectivos(r)
    const prev = porPeriodo.get(r.periodo)
    porPeriodo.set(r.periodo, {
      neto: (prev?.neto ?? 0) + t.neto,
      bruto: (prev?.bruto ?? 0) + t.bruto,
      fecha: prev?.fecha ?? fechaReferencia(r),
    })
  }
  return [...porPeriodo.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([periodo, { neto, bruto, fecha }]) => {
      const ipcMes = ipc ? valorIpc(ipc, periodo) : null
      const of = oficial ? cotizacionAl(oficial, fecha) : null
      const bl = blue ? cotizacionAl(blue, fecha) : null
      return {
        periodo,
        neto: redondear(neto),
        bruto: redondear(bruto),
        netoReal: base && ipcMes ? redondear((neto * base) / ipcMes) : null,
        usdOficial: of ? redondear(neto / of) : null,
        usdBlue: bl ? redondear(neto / bl) : null,
      }
    })
}

export interface Comparacion {
  desde: string
  hasta: string
  variacionNominal: number
  inflacion: number
  /** > 0 le ganaste a la inflación */
  variacionReal: number
}

export function contraInflacion(serie: PuntoSerie[], ipc: SerieMensual, meses?: number): Comparacion | null {
  if (serie.length < 2) return null
  const ultimo = serie[serie.length - 1]
  const primero = meses
    ? [...serie].reverse().find((p) => mesesEntre(p.periodo, ultimo.periodo) >= meses) ?? serie[0]
    : serie[0]
  if (primero === ultimo) return null
  const i0 = valorIpc(ipc, primero.periodo)
  const i1 = valorIpc(ipc, ultimo.periodo)
  if (!i0 || !i1) return null
  const variacionNominal = ultimo.neto / primero.neto - 1
  const inflacion = i1 / i0 - 1
  return { desde: primero.periodo, hasta: ultimo.periodo, variacionNominal, inflacion, variacionReal: (1 + variacionNominal) / (1 + inflacion) - 1 }
}

export interface EstimacionSac {
  semestre: string
  mejorPeriodo: string
  mejorRemuneracion: number
  meses: number
  bruto: number
  netoEstimado: number
  mesDePago: string
}

/**
 * Aguinaldo (Ley 23.041): 50% de la mejor remuneración mensual devengada del semestre,
 * proporcional al tiempo trabajado. Se toma solo lo remunerativo.
 */
export function estimarAguinaldo(recibos: DatosRecibo[], periodoRef: string, fechaIngreso?: string | null): EstimacionSac | null {
  const [anio, mes] = periodoRef.split('-').map(Number)
  const primerSemestre = mes <= 6
  const inicio = `${anio}-${primerSemestre ? '01' : '07'}`
  const fin = `${anio}-${primerSemestre ? '06' : '12'}`
  const delSemestre = recibos.filter((r) => r.tipoLiquidacion === 'mensual' && r.periodo >= inicio && r.periodo <= fin)
  if (!delSemestre.length) return null

  let mejor = delSemestre[0]
  for (const r of delSemestre) if (totalesEfectivos(r).remunerativo > totalesEfectivos(mejor).remunerativo) mejor = r
  const t = totalesEfectivos(mejor)

  let meses = 6
  if (fechaIngreso && fechaIngreso.slice(0, 7) > inicio) meses = Math.max(0, mesesEntre(fechaIngreso.slice(0, 7), fin) + 1)
  const bruto = redondear((t.remunerativo / 2) * (meses / 6))
  const tasaDescuentos = t.remunerativo > 0 ? t.retenciones / t.remunerativo : 0.17
  return {
    semestre: `${primerSemestre ? '1°' : '2°'} semestre ${anio}`,
    mejorPeriodo: mejor.periodo,
    mejorRemuneracion: t.remunerativo,
    meses,
    bruto,
    netoEstimado: redondear(bruto * (1 - tasaDescuentos)),
    mesDePago: primerSemestre ? `${anio}-06` : `${anio}-12`,
  }
}

/** Evolución de un concepto a lo largo de los recibos */
export function serieConcepto(recibos: DatosRecibo[], nombre: string) {
  const k = nombre.toLowerCase().replace(/[^a-z0-9ñ]/g, '')
  return recibos
    .map((r) => ({
      periodo: r.periodo,
      importe: r.conceptos.filter((c) => c.nombre.toLowerCase().replace(/[^a-z0-9ñ]/g, '') === k).reduce((s, c) => s + c.importe, 0),
    }))
    .filter((p) => p.importe > 0)
    .sort((a, b) => a.periodo.localeCompare(b.periodo))
}

export function antiguedad(fechaIngreso: string, hoy = new Date()) {
  const [a, m, d] = fechaIngreso.split('-').map(Number)
  let anios = hoy.getFullYear() - a
  let meses = hoy.getMonth() + 1 - m
  if (hoy.getDate() < d) meses--
  if (meses < 0) {
    anios--
    meses += 12
  }
  return { anios, meses }
}
