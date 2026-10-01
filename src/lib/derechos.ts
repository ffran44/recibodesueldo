/**
 * Liquidación final estimada (LCT con las reformas de las leyes 27.742 y 27.802).
 * Orientativa: no aplica el tope del convenio ni regímenes especiales.
 */
import type { DatosRecibo } from './types'
import { totalesEfectivos } from './audit'
import { redondear } from './format'

export interface Bases {
  /** Mejor remuneración mensual, normal y habitual del último año (sin aguinaldo) */
  mejorRemunerativa: number
  /** Sumas no remunerativas del mismo mes, por si se incluyen en la base */
  noRemunerativaMensual: number
  ultimaRemunerativa: number
  /** Último mes completo: remunerativo + no remunerativo */
  ultimaTotal: number
  /** Mejor remunerativo del semestre del egreso, para el aguinaldo */
  mejorRemSemestre: number
}

export interface Rubro {
  id: string
  nombre: string
  monto: number
  detalle: string
  /** Lleva descuentos de jubilación y obra social (los indemnizatorios no) */
  conDescuentos: boolean
}

const fecha = (iso: string) => {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d))
}
const DIA = 86_400_000
const diasEntre = (desde: Date, hasta: Date) => Math.round((hasta.getTime() - desde.getTime()) / DIA) + 1
const diasDelMes = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()

export function antiguedadEntre(ingreso: string, egreso: string) {
  const a = fecha(ingreso)
  const b = fecha(egreso)
  let anios = b.getUTCFullYear() - a.getUTCFullYear()
  let meses = b.getUTCMonth() - a.getUTCMonth()
  let dias = b.getUTCDate() - a.getUTCDate()
  if (dias < 0) {
    meses--
    dias += new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), 0)).getUTCDate()
  }
  if (meses < 0) {
    anios--
    meses += 12
  }
  return { anios, meses, dias }
}

/** Art. 150 LCT: 14 días si la antigüedad al 31/12 no excede 5 años, 21 hasta 10, 28 hasta 20 y 35 si excede 20 */
export function diasVacacionesPorAntiguedad(anios: number) {
  if (anios <= 5) return 14
  if (anios <= 10) return 21
  if (anios <= 20) return 28
  return 35
}

export function calcularLiquidacion({
  ingreso,
  egreso,
  bases,
  incluirNoRemunerativo,
}: {
  ingreso: string
  egreso: string
  bases: Bases
  incluirNoRemunerativo: boolean
}) {
  const fin = fecha(egreso)
  const antiguedad = antiguedadEntre(ingreso, egreso)
  const enPrueba = antiguedad.anios === 0 && antiguedad.meses < 6

  // Indemnización por antigüedad (art. 245): un mes por año o fracción mayor de 3 meses, mínimo un mes
  const fraccion = antiguedad.meses > 3 || (antiguedad.meses === 3 && antiguedad.dias > 0) ? 1 : 0
  const anios = Math.max(1, antiguedad.anios + fraccion)
  const base245 = bases.mejorRemunerativa + (incluirNoRemunerativo ? bases.noRemunerativaMensual : 0)
  const indemnizacion = enPrueba ? 0 : base245 * anios

  // Preaviso (art. 231): 1 mes hasta 5 años, 2 meses después; no corresponde en período de prueba
  const mesesPreaviso = enPrueba ? 0 : antiguedad.anios >= 5 ? 2 : 1
  const preaviso = bases.ultimaTotal * mesesPreaviso

  // Días del mes del egreso
  const dm = diasDelMes(fin)
  const dia = fin.getUTCDate()
  const valorDia = bases.ultimaTotal / dm
  const diasTrabajados = valorDia * dia
  const integracion = enPrueba ? 0 : valorDia * (dm - dia)

  // Aguinaldo proporcional del semestre
  const inicioSemestre = new Date(Date.UTC(fin.getUTCFullYear(), fin.getUTCMonth() < 6 ? 0 : 6, 1))
  const finSemestre = new Date(Date.UTC(fin.getUTCFullYear(), fin.getUTCMonth() < 6 ? 6 : 12, 0))
  const desdeSemestre = fecha(ingreso) > inicioSemestre ? fecha(ingreso) : inicioSemestre
  const diasSemestre = diasEntre(desdeSemestre, fin)
  const totalSemestre = diasEntre(inicioSemestre, finSemestre)
  const sac = (bases.mejorRemSemestre / 2) * (diasSemestre / totalSemestre)

  // Vacaciones proporcionales no gozadas (arts. 150, 155 y 156)
  const inicioAnio = new Date(Date.UTC(fin.getUTCFullYear(), 0, 1))
  const desdeAnio = fecha(ingreso) > inicioAnio ? fecha(ingreso) : inicioAnio
  const diasAnio = diasEntre(desdeAnio, fin)
  const al31 = antiguedadEntre(ingreso, `${fin.getUTCFullYear()}-12-31`)
  // En años con decimales: 5 años y 2 meses ya "excede" los 5
  const aniosAl31 = al31.anios + al31.meses / 12 + al31.dias / 365
  const diasVacaciones = (diasVacacionesPorAntiguedad(aniosAl31) * diasAnio) / 365
  const vacaciones = (bases.ultimaRemunerativa / 25) * diasVacaciones

  const r = (id: string, nombre: string, monto: number, detalle: string, conDescuentos: boolean): Rubro => ({
    id,
    nombre,
    monto: redondear(monto),
    detalle,
    conDescuentos,
  })
  const fmtDias = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 1 })

  const comunes = [
    r('dias-trabajados', 'Días trabajados del mes', diasTrabajados, `${dia} de ${dm} días`, true),
    r('sac', 'Aguinaldo proporcional', sac, `${diasSemestre} de ${totalSemestre} días del semestre`, true),
    r('vacaciones', 'Vacaciones no gozadas', vacaciones, `${fmtDias(diasVacaciones)} días (de ${diasVacacionesPorAntiguedad(aniosAl31)} por año) a sueldo ÷ 25`, false),
    r('sac-vacaciones', 'Aguinaldo sobre vacaciones', vacaciones / 12, '1/12 de las vacaciones', false),
  ]

  const despido = [
    r(
      'indemnizacion',
      'Indemnización por antigüedad',
      indemnizacion,
      enPrueba ? 'No corresponde en el período de prueba (6 meses)' : `${anios} ${anios === 1 ? 'sueldo' : 'sueldos'} de la mejor remuneración del último año`,
      false,
    ),
    r('preaviso', 'Preaviso no otorgado', preaviso, enPrueba ? 'No corresponde en el período de prueba' : `${mesesPreaviso} ${mesesPreaviso === 1 ? 'mes' : 'meses'}`, false),
    r('sac-preaviso', 'Aguinaldo sobre preaviso', preaviso / 12, '1/12 del preaviso', false),
    r('integracion', 'Integración del mes de despido', integracion, `${dm - dia} días hasta fin de mes`, false),
    r('sac-integracion', 'Aguinaldo sobre integración', integracion / 12, '1/12 de la integración', false),
    ...comunes,
  ]

  const suma = (l: Rubro[]) => redondear(l.reduce((s, x) => s + x.monto, 0))
  return { antiguedad, enPrueba, aniosIndemnizacion: enPrueba ? 0 : anios, despido, renuncia: comunes, totalDespido: suma(despido), totalRenuncia: suma(comunes) }
}

/** Bases de cálculo a partir de los recibos cargados */
export function basesDesdeRecibos(recibos: DatosRecibo[], egreso: string): Bases | null {
  const desde = `${Number(egreso.slice(0, 4)) - 1}${egreso.slice(4, 7)}`
  const mensuales = recibos
    .filter((r) => r.tipoLiquidacion === 'mensual' && r.periodo <= egreso.slice(0, 7))
    .sort((a, b) => a.periodo.localeCompare(b.periodo))
  const ultimoAnio = mensuales.filter((r) => r.periodo >= desde)
  const ultimo = mensuales.at(-1)
  if (!ultimo) return null

  const conTotales = (ultimoAnio.length ? ultimoAnio : [ultimo]).map((r) => ({ periodo: r.periodo, ...totalesEfectivos(r) }))
  const mejor = conTotales.reduce((m, t) => (t.remunerativo > m.remunerativo ? t : m))
  const tu = totalesEfectivos(ultimo)
  const semestre = egreso.slice(5, 7) <= '06' ? [`${egreso.slice(0, 4)}-01`, `${egreso.slice(0, 4)}-06`] : [`${egreso.slice(0, 4)}-07`, `${egreso.slice(0, 4)}-12`]
  const delSemestre = conTotales.filter((t) => t.periodo >= semestre[0] && t.periodo <= semestre[1])

  return {
    mejorRemunerativa: mejor.remunerativo,
    noRemunerativaMensual: mejor.noRemunerativo,
    ultimaRemunerativa: tu.remunerativo,
    ultimaTotal: redondear(tu.remunerativo + tu.noRemunerativo),
    mejorRemSemestre: delSemestre.length ? Math.max(...delSemestre.map((t) => t.remunerativo)) : tu.remunerativo,
  }
}
