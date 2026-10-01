import { describe, expect, it } from 'vitest'
import { antiguedadEntre, basesDesdeRecibos, calcularLiquidacion, diasVacacionesPorAntiguedad, type Bases } from './derechos'
import { reciboDocente, variante } from './fixtures'

const bases: Bases = {
  mejorRemunerativa: 700000,
  noRemunerativaMensual: 100000,
  ultimaRemunerativa: 700000,
  ultimaTotal: 800000,
  mejorRemSemestre: 700000,
}

const rubro = (lista: { id: string; monto: number }[], id: string) => lista.find((r) => r.id === id)?.monto ?? 0

describe('antigüedad', () => {
  it('cuenta años, meses y días', () => {
    expect(antiguedadEntre('2023-11-07', '2026-10-15')).toEqual({ anios: 2, meses: 11, dias: 8 })
  })
  it('días de vacaciones según antigüedad (art. 150)', () => {
    expect([2, 5, 9, 10, 19, 20, 30].map((a) => diasVacacionesPorAntiguedad(a))).toEqual([14, 14, 21, 21, 28, 28, 35])
    // Apenas pasa de 5 años ya corresponden 21 días
    expect(diasVacacionesPorAntiguedad(5 + 2 / 12)).toBe(21)
  })
})

describe('despido sin causa', () => {
  const r = calcularLiquidacion({ ingreso: '2023-11-07', egreso: '2026-10-15', bases, incluirNoRemunerativo: false })

  it('cobra un mes por año y la fracción mayor a 3 meses cuenta como año', () => {
    // 2 años y 11 meses => 3 sueldos
    expect(rubro(r.despido, 'indemnizacion')).toBe(2100000)
  })

  it('preaviso de 1 mes con menos de 5 años', () => {
    expect(rubro(r.despido, 'preaviso')).toBe(800000)
    expect(rubro(r.despido, 'sac-preaviso')).toBeCloseTo(800000 / 12, 2)
  })

  it('integra los días que faltan del mes y paga los trabajados', () => {
    // Octubre tiene 31 días: trabajó 15, faltan 16
    expect(rubro(r.despido, 'integracion')).toBeCloseTo((800000 / 31) * 16, 2)
    expect(rubro(r.despido, 'dias-trabajados')).toBeCloseTo((800000 / 31) * 15, 2)
  })

  it('aguinaldo proporcional del semestre', () => {
    // 1 de julio al 15 de octubre = 107 días de 184
    expect(rubro(r.despido, 'sac')).toBeCloseTo((700000 / 2) * (107 / 184), 2)
  })

  it('vacaciones proporcionales con el día a sueldo / 25', () => {
    // Al 31/12/2026 tendría 3 años => 14 días; trabajó 288 días del año
    const dias = (14 * 288) / 365
    expect(rubro(r.despido, 'vacaciones')).toBeCloseTo((700000 / 25) * dias, 2)
  })

  it('suma todo en el total', () => {
    expect(r.totalDespido).toBeCloseTo(
      r.despido.reduce((s, x) => s + x.monto, 0),
      2,
    )
  })

  it('con más de 5 años el preaviso es de 2 meses', () => {
    const largo = calcularLiquidacion({ ingreso: '2018-03-01', egreso: '2026-10-15', bases, incluirNoRemunerativo: false })
    expect(rubro(largo.despido, 'preaviso')).toBe(1600000)
    expect(rubro(largo.despido, 'indemnizacion')).toBe(700000 * 9) // 8 años y 7 meses
  })

  it('puede incluir las sumas no remunerativas en la base', () => {
    const con = calcularLiquidacion({ ingreso: '2023-11-07', egreso: '2026-10-15', bases, incluirNoRemunerativo: true })
    expect(rubro(con.despido, 'indemnizacion')).toBe(800000 * 3)
  })
})

describe('período de prueba', () => {
  it('no hay indemnización ni preaviso en los primeros 6 meses', () => {
    const r = calcularLiquidacion({ ingreso: '2026-06-01', egreso: '2026-10-15', bases, incluirNoRemunerativo: false })
    expect(r.enPrueba).toBe(true)
    expect(rubro(r.despido, 'indemnizacion')).toBe(0)
    expect(rubro(r.despido, 'preaviso')).toBe(0)
    expect(rubro(r.despido, 'sac')).toBeGreaterThan(0)
  })
})

describe('renuncia', () => {
  it('no tiene indemnización ni preaviso, sí lo proporcional', () => {
    const r = calcularLiquidacion({ ingreso: '2023-11-07', egreso: '2026-10-15', bases, incluirNoRemunerativo: false })
    expect(r.renuncia.map((x) => x.id).sort()).toEqual(['dias-trabajados', 'sac', 'sac-vacaciones', 'vacaciones'])
    expect(r.totalRenuncia).toBeLessThan(r.totalDespido)
  })
})

describe('último día del mes', () => {
  it('no hay integración', () => {
    const r = calcularLiquidacion({ ingreso: '2023-11-07', egreso: '2026-10-31', bases, incluirNoRemunerativo: false })
    expect(rubro(r.despido, 'integracion')).toBe(0)
  })
})

describe('basesDesdeRecibos', () => {
  it('toma la mejor remuneración del último año, sin aguinaldos', () => {
    const julio = variante(reciboDocente, { periodo: '2026-07' })
    julio.totales.remunerativo = 800000
    const sac = variante(reciboDocente, { periodo: '2026-06', tipoLiquidacion: 'sac' })
    sac.totales.remunerativo = 5000000
    const viejo = variante(reciboDocente, { periodo: '2025-01' })
    viejo.totales.remunerativo = 9000000
    const b = basesDesdeRecibos([viejo, sac, julio, reciboDocente], '2026-10-15')!
    expect(b.mejorRemunerativa).toBe(800000)
    expect(b.ultimaRemunerativa).toBe(732488)
    expect(b.ultimaTotal).toBeCloseTo(732488 + 183120.6, 2)
    expect(b.mejorRemSemestre).toBe(800000)
  })
})
