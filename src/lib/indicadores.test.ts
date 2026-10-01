import { describe, expect, it } from 'vitest'
import { reciboDocente, variante } from './fixtures'
import type { DatosRecibo } from './types'
import { serieSalarial } from './analysis'
import {
  aumentosVsInflacion,
  brechaInflacion,
  composicion,
  conceptoBasico,
  desdeUltimoAumento,
  detectarAumentos,
  filtrarPorRango,
  indiceBase100,
  matrizConceptos,
  netoParaMantener,
  resumenAnual,
} from './indicadores'

/** Recibo con todos los importes multiplicados por f (los totales se recalculan) */
function escalado(periodo: string, f: number, tipo: DatosRecibo['tipoLiquidacion'] = 'mensual'): DatosRecibo {
  const r = variante(reciboDocente, { periodo, tipoLiquidacion: tipo })
  r.conceptos = r.conceptos.map((c) => ({ ...c, importe: Math.round(c.importe * f * 100) / 100 }))
  r.totales = { remunerativo: null, noRemunerativo: null, retenciones: null, neto: null, netoEnLetras: null }
  return r
}

// Precios: +10% en febrero, +0% en marzo, +10% en abril
const ipc = new Map([
  ['2026-01', 100],
  ['2026-02', 110],
  ['2026-03', 110],
  ['2026-04', 121],
])
// Sueldo: igual en febrero, +20% en marzo (aumento), igual en abril
const recibos = [escalado('2026-01', 1), escalado('2026-02', 1), escalado('2026-03', 1.2), escalado('2026-04', 1.2)]
const serie = serieSalarial(recibos, { ipc })
const neto0 = serie[0].neto

describe('filtrarPorRango', () => {
  it('se queda con los últimos N meses contando desde el último recibo', () => {
    expect(filtrarPorRango(recibos, 'u3').map((r) => r.periodo)).toEqual(['2026-02', '2026-03', '2026-04'])
    expect(filtrarPorRango(recibos, 'todo')).toHaveLength(4)
    expect(filtrarPorRango([...recibos, escalado('2025-12', 1)], 'a2025').map((r) => r.periodo)).toEqual(['2025-12'])
  })
})

describe('composicion', () => {
  it('calcula qué parte del bruto es no remunerativa y cuánto se descuenta', () => {
    const [enero] = composicion([reciboDocente])
    expect(enero.pctNoRemunerativo).toBeCloseTo(183120.6 / (732488 + 183120.6), 6)
    expect(enero.pctDescuentos).toBeCloseTo(169415.23 / 732488, 6)
  })
})

describe('indiceBase100', () => {
  it('lleva todas las series a 100 en el primer mes', () => {
    const idx = indiceBase100(serie)
    expect(idx[0].real).toBe(100)
    // Marzo: cobra 20% más con precios 10% más altos que en enero
    expect(idx[2].real).toBeCloseTo((1.2 / 1.1) * 100, 4)
  })
})

describe('brechaInflacion', () => {
  it('mide cuánto cobraste de más o de menos respecto de mantener el poder de compra del primer mes', () => {
    const b = brechaInflacion(serie, ipc)
    expect(b[1].diferencia).toBeCloseTo(neto0 - neto0 * 1.1, 1) // febrero: perdió el 10%
    expect(b[2].diferencia).toBeCloseTo(neto0 * 1.2 - neto0 * 1.1, 1) // marzo: ganó
    expect(b[3].acumulado).toBeCloseTo(b[0].diferencia + b[1].diferencia + b[2].diferencia + b[3].diferencia, 1)
  })
})

describe('aumentosVsInflacion', () => {
  it('compara la suba de cada mes con la inflación de ese mes', () => {
    const a = aumentosVsInflacion(serie, ipc)
    expect(a.map((x) => x.periodo)).toEqual(['2026-02', '2026-03', '2026-04'])
    expect(a[0]).toMatchObject({ aumento: 0, inflacion: expect.closeTo(0.1, 6) })
    expect(a[1].aumento).toBeCloseTo(0.2, 4)
  })
})

describe('aumentos', () => {
  it('detecta el concepto básico', () => {
    expect(conceptoBasico(recibos)).toBe('ASIG BASICA')
  })
  it('detecta los meses con aumento del básico', () => {
    expect(detectarAumentos(recibos)).toEqual([{ periodo: '2026-03', variacion: expect.closeTo(0.2, 4) }])
  })
  it('calcula la inflación acumulada desde el último aumento', () => {
    const d = desdeUltimoAumento(recibos, ipc)!
    expect(d.periodo).toBe('2026-03')
    expect(d.inflacion).toBeCloseTo(0.1, 6)
    expect(d.perdidaPoderCompra).toBeCloseTo(1 - 1 / 1.1, 6)
  })
})

describe('netoParaMantener', () => {
  it('dice cuánto habría que cobrar hoy para igualar el mejor mes', () => {
    const n = netoParaMantener(serie, ipc)!
    expect(n.mejorPeriodo).toBe('2026-03')
    expect(n.monto).toBeCloseTo(neto0 * 1.2 * 1.1, 1)
    expect(n.faltante).toBeCloseTo(neto0 * 1.2 * 0.1, 1)
  })
})

describe('resumenAnual', () => {
  it('suma lo cobrado por año, aguinaldo aparte', () => {
    const conSac = [...recibos, escalado('2026-06', 0.5, 'sac')]
    const [a2026] = resumenAnual(conSac)
    expect(a2026.anio).toBe('2026')
    expect(a2026.meses).toBe(4)
    expect(a2026.aguinaldo).toBeCloseTo(serieSalarial([escalado('2026-06', 0.5, 'sac')], {})[0].neto, 2)
  })
})

describe('matrizConceptos', () => {
  it('arma una fila por concepto con la variación de cada mes contra la inflación', () => {
    const m = matrizConceptos(recibos, ipc)
    expect(m.periodos).toEqual(['2026-01', '2026-02', '2026-03', '2026-04'])
    const basico = m.filas.find((f) => f.nombre === 'ASIG BASICA')!
    expect(basico.variaciones[0]).toBeNull()
    expect(basico.variaciones[2]).toBeCloseTo(0.2, 4)
    // Febrero: no subió y la inflación fue 10% => quedó 10 puntos abajo
    expect(basico.vsInflacion[1]).toBeCloseTo(-0.1, 4)
  })
})
