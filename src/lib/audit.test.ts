import { describe, expect, it } from 'vitest'
import { auditar, diaHabilLimite, estadoGeneral } from './audit'
import { reciboDocente, variante } from './fixtures'

const porId = (chequeos: ReturnType<typeof auditar>) => Object.fromEntries(chequeos.map((c) => [c.id, c.estado]))

describe('auditar', () => {
  it('da todo OK para un recibo docente correcto', () => {
    const chequeos = auditar(reciboDocente)
    expect(porId(chequeos)).toEqual({
      'suma-rem': 'ok',
      'suma-norem': 'ok',
      'suma-ret': 'ok',
      neto: 'ok',
      letras: 'ok',
      jubilacion: 'ok',
      pago: 'ok',
      suss: 'ok',
    })
    expect(estadoGeneral(chequeos)).toBe('ok')
  })

  it('detecta un importe mal leído', () => {
    const r = variante(reciboDocente, {})
    r.conceptos[0].importe = 215030.40 // dígitos invertidos
    const chequeos = porId(auditar(r))
    expect(chequeos['suma-rem']).toBe('error')
  })

  it('detecta neto en letras distinto', () => {
    const r = variante(reciboDocente, {})
    r.totales.netoEnLetras = 746139.37
    expect(porId(auditar(r)).letras).toBe('error')
  })

  it('avisa si pagaron tarde (considerando feriados)', () => {
    const r = variante(reciboDocente, { fechaPago: '2026-09-07' })
    expect(porId(auditar(r)).pago).toBe('alerta')
  })

  it('avisa si los aportes no se depositan hace meses', () => {
    const r = variante(reciboDocente, { sussUltimoDeposito: { fecha: '2026-06-10', periodo: '2026-05' } })
    expect(porId(auditar(r)).suss).toBe('error')
  })

  it('compara contra el mes anterior', () => {
    const anterior = variante(reciboDocente, { periodo: '2026-07' })
    anterior.conceptos.push({ codigo: null, nombre: 'PLUS ZONA', cantidad: null, tipo: 'remunerativo', importe: 5000 })
    const actual = variante(reciboDocente, {})
    actual.conceptos.find((c) => c.nombre === 'OBRA SOCIAL')!.importe = 50000
    const ids = porId(auditar(actual, { anterior }))
    expect(ids.faltan).toBe('alerta')
    expect(ids.alicuotas).toBe('alerta')
  })
})

describe('diaHabilLimite', () => {
  it('cuenta 4 días hábiles desde el 1° del mes siguiente', () => {
    // Septiembre 2026 empieza martes: 1, 2, 3, 4
    expect(diaHabilLimite('2026-08', new Set())).toBe('2026-09-04')
  })
  it('saltea fines de semana y feriados', () => {
    // Enero 2027: 1 feriado (viernes), 4-7 lunes a jueves
    expect(diaHabilLimite('2026-12', new Set(['2027-01-01']))).toBe('2027-01-07')
  })
})
