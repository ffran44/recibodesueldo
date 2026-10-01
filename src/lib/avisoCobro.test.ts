import { describe, expect, it } from 'vitest'
import { avisosANotificar, avisosDeCobro, avisosVisibles, claveAviso, textoAviso } from './avisoCobro'
import { reciboDocente, variante } from './fixtures'

const agosto = variante(reciboDocente, { periodo: '2026-08' })
const sinFeriados = new Set<string>()

describe('avisosDeCobro', () => {
  it('avisa si pasó el 4° día hábil y no está el recibo del mes anterior', () => {
    // Octubre 2026: 1 (jue), 2 (vie), 5 (lun), 6 (mar) => límite 6/10
    expect(avisosDeCobro([agosto], '2026-10-07', sinFeriados)).toEqual([
      { empleador: 'INSTITUTO EJEMPLO', periodo: '2026-09', limite: '2026-10-06', estado: 'atrasado', dias: 1 },
    ])
  })

  it('el día límite avisa que vence hoy', () => {
    expect(avisosDeCobro([agosto], '2026-10-06', sinFeriados)[0].estado).toBe('vence-hoy')
  })

  it('antes del límite queda pendiente, con los días que faltan', () => {
    expect(avisosDeCobro([agosto], '2026-10-02', sinFeriados)[0]).toMatchObject({ estado: 'pendiente', dias: 4 })
  })

  it('no avisa si el recibo del mes ya está cargado', () => {
    const septiembre = variante(reciboDocente, { periodo: '2026-09' })
    expect(avisosDeCobro([agosto, septiembre], '2026-10-20', sinFeriados)).toEqual([])
  })

  it('los feriados corren el límite', () => {
    expect(avisosDeCobro([agosto], '2026-10-07', new Set(['2026-10-05']))[0]).toMatchObject({ limite: '2026-10-07', estado: 'vence-hoy' })
  })

  it('no molesta por empleos viejos', () => {
    const viejo = variante(reciboDocente, { periodo: '2025-12', empleador: { nombre: 'OTRO COLEGIO', cuit: null } })
    expect(avisosDeCobro([viejo, agosto], '2026-10-07', sinFeriados).map((a) => a.empleador)).toEqual(['INSTITUTO EJEMPLO'])
  })

  it('cuenta aguinaldos y otras liquidaciones solo si son mensuales', () => {
    const sac = variante(reciboDocente, { periodo: '2026-09', tipoLiquidacion: 'sac' })
    expect(avisosDeCobro([agosto, sac], '2026-10-07', sinFeriados)).toHaveLength(1)
  })

  it('sin recibos no hay avisos', () => {
    expect(avisosDeCobro([], '2026-10-07', sinFeriados)).toEqual([])
  })
})

describe('avisos visibles y notificaciones', () => {
  const aviso = avisosDeCobro([agosto], '2026-10-07', sinFeriados)[0]
  it('oculta lo que la persona marcó como cobrado o pospuso', () => {
    expect(avisosVisibles([aviso], { [claveAviso(aviso)]: '9999-12-31' }, '2026-10-07')).toEqual([])
    expect(avisosVisibles([aviso], { [claveAviso(aviso)]: '2026-10-06' }, '2026-10-07')).toHaveLength(1)
  })
  it('notifica una sola vez por día', () => {
    expect(avisosANotificar([aviso], { [claveAviso(aviso)]: '2026-10-07' }, '2026-10-07')).toEqual([])
    expect(avisosANotificar([aviso], { [claveAviso(aviso)]: '2026-10-06' }, '2026-10-07')).toHaveLength(1)
  })
  it('arma un texto claro', () => {
    expect(textoAviso(aviso)).toEqual({
      titulo: '¿Cobraste septiembre?',
      cuerpo: 'Ya pasó el 4° día hábil (06/10) y no cargaste el recibo de septiembre de INSTITUTO EJEMPLO.',
    })
  })
})
