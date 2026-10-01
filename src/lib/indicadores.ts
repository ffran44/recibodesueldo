import type { DatosRecibo } from './types'
import { totalesEfectivos } from './audit'
import { ultimoPeriodo, valorIpc, type PuntoSerie, type SerieMensual } from './analysis'
import { redondear, sumarMeses } from './format'

/** 'todo', últimos N meses ('u12') o un año ('a2026') */
export type Rango = 'todo' | `u${number}` | `a${number}`

export function filtrarPorRango<T extends DatosRecibo>(recibos: T[], rango: Rango): T[] {
  if (rango === 'todo' || !recibos.length) return recibos
  if (rango.startsWith('a')) return recibos.filter((r) => r.periodo.startsWith(rango.slice(1)))
  const ultimo = recibos.reduce((max, r) => (r.periodo > max ? r.periodo : max), recibos[0].periodo)
  const desde = sumarMeses(ultimo, -(Number(rango.slice(1)) - 1))
  return recibos.filter((r) => r.periodo >= desde)
}

export const soloMensuales = <T extends DatosRecibo>(recibos: T[]) => recibos.filter((r) => r.tipoLiquidacion === 'mensual')

const clave = (nombre: string) => nombre.toLowerCase().replace(/[^a-z0-9ñ]/g, '')

export interface PuntoComposicion {
  periodo: string
  remunerativo: number
  noRemunerativo: number
  retenciones: number
  neto: number
  /** Parte del bruto que no suma para jubilación ni aguinaldo */
  pctNoRemunerativo: number
  /** Descuentos sobre el remunerativo */
  pctDescuentos: number
}

export function composicion(recibos: DatosRecibo[]): PuntoComposicion[] {
  const porPeriodo = new Map<string, { remunerativo: number; noRemunerativo: number; retenciones: number; neto: number }>()
  for (const r of recibos) {
    const t = totalesEfectivos(r)
    const p = porPeriodo.get(r.periodo) ?? { remunerativo: 0, noRemunerativo: 0, retenciones: 0, neto: 0 }
    porPeriodo.set(r.periodo, {
      remunerativo: p.remunerativo + t.remunerativo,
      noRemunerativo: p.noRemunerativo + t.noRemunerativo,
      retenciones: p.retenciones + t.retenciones,
      neto: p.neto + t.neto,
    })
  }
  return [...porPeriodo.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([periodo, t]) => ({
      periodo,
      ...t,
      pctNoRemunerativo: t.remunerativo + t.noRemunerativo > 0 ? t.noRemunerativo / (t.remunerativo + t.noRemunerativo) : 0,
      pctDescuentos: t.remunerativo > 0 ? t.retenciones / t.remunerativo : 0,
    }))
}

export interface PuntoIndice {
  periodo: string
  real: number | null
  oficial: number | null
  blue: number | null
}

/** Poder de compra con base 100 en el primer mes: en pesos de hoy, en dólar oficial y en blue */
export function indiceBase100(serie: PuntoSerie[]): PuntoIndice[] {
  const base = (k: 'netoReal' | 'usdOficial' | 'usdBlue') => serie.find((p) => p[k] != null)?.[k] ?? null
  const b = { real: base('netoReal'), oficial: base('usdOficial'), blue: base('usdBlue') }
  const indice = (v: number | null, base: number | null) => (v != null && base ? (v / base) * 100 : null)
  return serie.map((p) => ({
    periodo: p.periodo,
    real: indice(p.netoReal, b.real),
    oficial: indice(p.usdOficial, b.oficial),
    blue: indice(p.usdBlue, b.blue),
  }))
}

export interface PuntoBrecha {
  periodo: string
  /** Lo cobrado menos lo que hubiera hecho falta para mantener el poder de compra del primer mes */
  diferencia: number
  acumulado: number
}

export function brechaInflacion(serie: PuntoSerie[], ipc: SerieMensual): PuntoBrecha[] {
  const primero = serie[0]
  const ipc0 = primero ? valorIpc(ipc, primero.periodo) : null
  if (!primero || !ipc0) return []
  let acumulado = 0
  return serie.flatMap((p) => {
    const ipcMes = valorIpc(ipc, p.periodo)
    if (!ipcMes) return []
    const diferencia = redondear(p.neto - (primero.neto * ipcMes) / ipc0)
    acumulado = redondear(acumulado + diferencia)
    return [{ periodo: p.periodo, diferencia, acumulado }]
  })
}

export interface PuntoAumento {
  periodo: string
  /** Variación del neto respecto del recibo anterior */
  aumento: number
  /** Inflación del mismo lapso */
  inflacion: number
}

export function aumentosVsInflacion(serie: PuntoSerie[], ipc: SerieMensual): PuntoAumento[] {
  return serie.slice(1).flatMap((p, i) => {
    const ant = serie[i]
    const i0 = valorIpc(ipc, ant.periodo)
    const i1 = valorIpc(ipc, p.periodo)
    if (!i0 || !i1 || ant.neto <= 0) return []
    return [{ periodo: p.periodo, aumento: p.neto / ant.neto - 1, inflacion: i1 / i0 - 1 }]
  })
}

/** El concepto que mejor representa el sueldo "de convenio": el básico, o el remunerativo más grande */
export function conceptoBasico(recibos: DatosRecibo[]): string | null {
  const ultimo = [...recibos].sort((a, b) => a.periodo.localeCompare(b.periodo)).at(-1)
  if (!ultimo) return null
  const rem = ultimo.conceptos.filter((c) => c.tipo === 'remunerativo')
  const basico = rem.find((c) => /b[aá]sic|sueldo\s*b|asig.*b[aá]s/i.test(c.nombre)) ?? [...rem].sort((a, b) => b.importe - a.importe)[0]
  return basico?.nombre ?? null
}

function serieBasico(recibos: DatosRecibo[]) {
  const nombre = conceptoBasico(recibos)
  if (!nombre) return []
  const k = clave(nombre)
  return soloMensuales(recibos)
    .map((r) => ({ periodo: r.periodo, importe: r.conceptos.filter((c) => clave(c.nombre) === k).reduce((s, c) => s + c.importe, 0) }))
    .filter((p) => p.importe > 0)
    .sort((a, b) => a.periodo.localeCompare(b.periodo))
}

/** Meses en que subió el básico (paritarias, cambios de categoría) */
export function detectarAumentos(recibos: DatosRecibo[], umbral = 0.01) {
  const s = serieBasico(recibos)
  return s.slice(1).flatMap((p, i) => {
    const variacion = p.importe / s[i].importe - 1
    return variacion > umbral ? [{ periodo: p.periodo, variacion }] : []
  })
}

export function desdeUltimoAumento(recibos: DatosRecibo[], ipc: SerieMensual) {
  const ultimo = detectarAumentos(recibos).at(-1)
  const hasta = ultimoPeriodo(ipc)
  if (!ultimo || !hasta) return null
  const i0 = valorIpc(ipc, ultimo.periodo)
  const i1 = valorIpc(ipc, hasta)
  if (!i0 || !i1) return null
  const inflacion = i1 / i0 - 1
  return { periodo: ultimo.periodo, variacion: ultimo.variacion, hasta, inflacion, perdidaPoderCompra: 1 - 1 / (1 + inflacion) }
}

/** Cuánto habría que cobrar con los precios de hoy para igualar el mejor mes */
export function netoParaMantener(serie: PuntoSerie[], ipc: SerieMensual) {
  const conReal = serie.filter((p) => p.netoReal != null)
  const hoy = ultimoPeriodo(ipc)
  if (conReal.length < 2 || !hoy) return null
  const mejor = conReal.reduce((m, p) => (p.netoReal! > m.netoReal! ? p : m))
  const i0 = valorIpc(ipc, mejor.periodo)
  const i1 = valorIpc(ipc, hoy)
  if (!i0 || !i1) return null
  const monto = redondear((mejor.neto * i1) / i0)
  const ultimo = serie[serie.length - 1]
  return { mejorPeriodo: mejor.periodo, mejorNeto: mejor.neto, preciosDe: hoy, monto, ultimoNeto: ultimo.neto, faltante: redondear(monto - ultimo.neto) }
}

export interface ResumenAnio {
  anio: string
  total: number
  aguinaldo: number
  meses: number
  promedioMensual: number
}

export function resumenAnual(recibos: DatosRecibo[]): ResumenAnio[] {
  const anios = new Map<string, { total: number; aguinaldo: number; mensual: number; periodos: Set<string> }>()
  for (const r of recibos) {
    const anio = r.periodo.slice(0, 4)
    const a = anios.get(anio) ?? { total: 0, aguinaldo: 0, mensual: 0, periodos: new Set<string>() }
    const neto = totalesEfectivos(r).neto
    a.total += neto
    if (r.tipoLiquidacion === 'sac') a.aguinaldo += neto
    if (r.tipoLiquidacion === 'mensual') {
      a.mensual += neto
      a.periodos.add(r.periodo)
    }
    anios.set(anio, a)
  }
  return [...anios.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([anio, a]) => ({
      anio,
      total: redondear(a.total),
      aguinaldo: redondear(a.aguinaldo),
      meses: a.periodos.size,
      promedioMensual: a.periodos.size ? redondear(a.mensual / a.periodos.size) : 0,
    }))
}

export interface FilaMatriz {
  nombre: string
  tipo: DatosRecibo['conceptos'][number]['tipo']
  valores: (number | null)[]
  /** Variación contra el mes anterior */
  variaciones: (number | null)[]
  /** Variación menos la inflación del mes, en puntos: > 0 le ganó */
  vsInflacion: (number | null)[]
}

/** Cada concepto mes a mes, como una planilla */
export function matrizConceptos(recibos: DatosRecibo[], ipc?: SerieMensual) {
  const mensuales = soloMensuales(recibos)
  const periodos = [...new Set(mensuales.map((r) => r.periodo))].sort()
  const filas = new Map<string, FilaMatriz>()
  const orden = { remunerativo: 0, no_remunerativo: 1, retencion: 2 }

  periodos.forEach((periodo, i) => {
    for (const r of mensuales.filter((x) => x.periodo === periodo)) {
      for (const c of r.conceptos) {
        const k = `${c.tipo}:${clave(c.nombre)}`
        const fila = filas.get(k) ?? { nombre: c.nombre, tipo: c.tipo, valores: periodos.map(() => null), variaciones: [], vsInflacion: [] }
        fila.nombre = c.nombre
        fila.valores[i] = (fila.valores[i] ?? 0) + c.importe
        filas.set(k, fila)
      }
    }
  })

  for (const fila of filas.values()) {
    fila.variaciones = fila.valores.map((v, i) => {
      const ant = fila.valores[i - 1]
      return i > 0 && v != null && ant ? v / ant - 1 : null
    })
    fila.vsInflacion = fila.variaciones.map((v, i) => {
      if (v == null || !ipc) return null
      const i0 = valorIpc(ipc, periodos[i - 1])
      const i1 = valorIpc(ipc, periodos[i])
      return i0 && i1 ? v - (i1 / i0 - 1) : null
    })
  }

  return {
    periodos,
    filas: [...filas.values()].sort((a, b) => orden[a.tipo] - orden[b.tipo] || (b.valores.at(-1) ?? 0) - (a.valores.at(-1) ?? 0)),
  }
}
