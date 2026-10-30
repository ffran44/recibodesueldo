import { describe, expect, it } from 'vitest'
import { contraInflacion, cotizacionAl, estimarAguinaldo, ipcDeSueldo, mesDeGasto, serieSalarial } from './analysis'
import { reciboDocente, variante } from './fixtures'
import { parsearMonto, sumarMeses } from './format'

const julio = variante(reciboDocente, { periodo: '2026-07', fechaPago: '2026-08-05' })
julio.totales.neto = 650000
julio.totales.remunerativo = 800000 // mejor remuneración del semestre
// A mes vencido: el sueldo de julio se gasta en agosto y el de agosto en septiembre
const ipc = new Map([
  ['2026-08', 12076.3937],
  ['2026-09', 12276.766],
])

describe('serieSalarial', () => {
  it('expresa el neto en pesos de hoy y en dólares', () => {
    const serie = serieSalarial([julio, reciboDocente], {
      ipc,
      oficial: new Map([
        ['2026-08-04', 1500],
        ['2026-09-03', 1540],
      ]),
    })
    expect(serie.map((p) => p.periodo)).toEqual(['2026-07', '2026-08'])
    expect(serie[1].netoReal).toBe(746193.37)
    expect(serie[0].netoReal).toBeCloseTo((650000 * 12276.766) / 12076.3937, 1)
    // Cotización del día hábil anterior más cercano a la fecha de pago
    expect(serie[1].usdOficial).toBeCloseTo(746193.37 / 1540, 2)
  })
})

describe('sueldo a mes vencido', () => {
  it('compara cada sueldo con los precios del mes en que se gasta', () => {
    expect(mesDeGasto('2026-09')).toBe('2026-10')
    expect(mesDeGasto('2026-12')).toBe('2027-01')
    expect(ipcDeSueldo(ipc, '2026-08')).toBe(12276.766)
  })
  it('no inventa valor real si todavía no se publicó esa inflación', () => {
    const septiembre = variante(reciboDocente, { periodo: '2026-09' })
    const serie = serieSalarial([reciboDocente, septiembre], { ipc })
    expect(serie[1].periodo).toBe('2026-09')
    expect(serie[1].netoReal).toBeNull()
  })
  it('contra la inflación llega hasta el último sueldo con dato publicado', () => {
    const septiembre = variante(reciboDocente, { periodo: '2026-09' })
    const c = contraInflacion(serieSalarial([julio, reciboDocente, septiembre], { ipc }), ipc)!
    expect(c.hasta).toBe('2026-08')
  })
})

describe('contraInflacion', () => {
  it('calcula la variación real', () => {
    const serie = serieSalarial([julio, reciboDocente], { ipc })
    const c = contraInflacion(serie, ipc)!
    expect(c.variacionNominal).toBeCloseTo(746193.37 / 650000 - 1, 6)
    expect(c.inflacion).toBeCloseTo(12276.766 / 12076.3937 - 1, 6)
    expect(c.variacionReal).toBeGreaterThan(0)
  })
})

describe('estimarAguinaldo', () => {
  it('toma la mejor remuneración del semestre', () => {
    const sac = estimarAguinaldo([julio, reciboDocente], '2026-08')!
    expect(sac.mejorPeriodo).toBe('2026-07')
    expect(sac.bruto).toBe(400000)
    expect(sac.mesDePago).toBe('2026-12')
  })
  it('es proporcional si entraste a mitad del semestre', () => {
    const sac = estimarAguinaldo([reciboDocente], '2026-08', '2026-10-01')!
    expect(sac.meses).toBe(3)
  })
})

describe('utilidades', () => {
  it('parsea montos argentinos', () => {
    expect(parsearMonto('74.030,18')).toBe(74030.18)
    expect(parsearMonto('$ 1.905,00')).toBe(1905)
    expect(parsearMonto('1905.5')).toBe(1905.5)
    // Punto como separador de miles, sin decimales
    expect(parsearMonto('3.000')).toBe(3000)
    expect(parsearMonto('1.234.567')).toBe(1234567)
    expect(parsearMonto('12.50')).toBe(12.5)
  })
  it('suma meses cruzando años', () => {
    expect(sumarMeses('2026-01', -1)).toBe('2025-12')
    expect(cotizacionAl(new Map([['2026-01-02', 10]]), '2026-01-05')).toBe(10)
  })
})
