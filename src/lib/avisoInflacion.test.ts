import { describe, expect, it } from 'vitest'
import { avisoInflacion, textoAvisoInflacion } from './avisoInflacion'
import { reciboDocente, variante } from './fixtures'
import type { DatosRecibo } from './types'

/** Recibo con los importes escalados (totales recalculados) */
function escalado(periodo: string, f: number): DatosRecibo {
  const r = variante(reciboDocente, { periodo })
  r.conceptos = r.conceptos.map((c) => ({ ...c, importe: Math.round(c.importe * f * 100) / 100 }))
  r.totales = { remunerativo: null, noRemunerativo: null, retenciones: null, neto: null, netoEnLetras: null }
  return r
}

// Precios: +2% en agosto y +3% en septiembre; un año antes, 100
const ipc = new Map([
  ['2025-09', 100],
  ['2026-07', 120],
  ['2026-08', 122.4],
  ['2026-09', 126.072],
])
// Sueldo: aumento de 10% en agosto, igual en septiembre
const recibos = [escalado('2026-07', 1), escalado('2026-08', 1.1), escalado('2026-09', 1.1)]

describe('avisoInflacion', () => {
  it('avisa cuando hay un mes de IPC posterior al último visto', () => {
    const a = avisoInflacion(ipc, recibos, '2026-08')!
    expect(a.periodo).toBe('2026-09')
    expect(a.mensual).toBeCloseTo(0.03, 6)
    expect(a.interanual).toBeCloseTo(0.26072, 5)
  })

  it('no avisa si ya se vio ese mes', () => {
    expect(avisoInflacion(ipc, recibos, '2026-09')).toBeNull()
  })

  it('compara con lo que subió tu sueldo ese mes', () => {
    const a = avisoInflacion(ipc, recibos, '2026-08')!
    expect(a.tuMes).toEqual({ variacion: 0, diferencia: expect.closeTo(-0.03, 6) })
  })

  it('suma la inflación desde el último aumento', () => {
    const a = avisoInflacion(ipc, recibos, '2026-08')!
    expect(a.desdeAumento?.periodo).toBe('2026-08')
    expect(a.desdeAumento?.inflacion).toBeCloseTo(0.03, 6)
  })

  it('funciona sin recibos del mes (solo el dato de INDEC)', () => {
    const a = avisoInflacion(ipc, [escalado('2026-07', 1)], '2026-08')!
    expect(a.tuMes).toBeNull()
    expect(textoAvisoInflacion(a).titulo).toBe('Inflación de septiembre: 3,0%')
  })

  it('arma un texto claro', () => {
    const { titulo, cuerpo } = textoAvisoInflacion(avisoInflacion(ipc, recibos, '2026-08')!)
    expect(titulo).toBe('Inflación de septiembre: 3,0%')
    expect(cuerpo).toContain('Interanual: 26,1%.')
    expect(cuerpo).toContain('Ese mes tu sueldo no subió: perdiste 2,9% de poder de compra.')
    expect(cuerpo).toContain('Desde tu último aumento (agosto) los precios subieron 3,0%')
  })
})
