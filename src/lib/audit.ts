import type { DatosRecibo, TipoConcepto } from './types'
import { mesesEntre, pesos, porcentaje, redondear, sumarMeses } from './format'

export type EstadoChequeo = 'ok' | 'alerta' | 'error' | 'info'

export interface Chequeo {
  id: string
  estado: EstadoChequeo
  titulo: string
  detalle: string
}

/** Tolerancia de redondeo: cada línea se redondea a centavos, así que $1 alcanza y sobra */
const TOLERANCIA = 1

export const sumaPorTipo = (r: DatosRecibo, tipo: TipoConcepto) =>
  redondear(r.conceptos.filter((c) => c.tipo === tipo).reduce((s, c) => s + c.importe, 0))

export function totalesEfectivos(r: DatosRecibo) {
  const remunerativo = r.totales.remunerativo ?? sumaPorTipo(r, 'remunerativo')
  const noRemunerativo = r.totales.noRemunerativo ?? sumaPorTipo(r, 'no_remunerativo')
  const retenciones = r.totales.retenciones ?? sumaPorTipo(r, 'retencion')
  const neto = r.totales.neto ?? redondear(remunerativo + noRemunerativo - retenciones)
  return { remunerativo, noRemunerativo, retenciones, neto, bruto: redondear(remunerativo + noRemunerativo) }
}

function chequeoSuma(id: string, titulo: string, tipo: TipoConcepto, declarado: number | null, r: DatosRecibo): Chequeo | null {
  if (declarado == null) return null
  const suma = sumaPorTipo(r, tipo)
  const dif = redondear(declarado - suma)
  if (Math.abs(dif) <= TOLERANCIA) {
    return { id, estado: 'ok', titulo, detalle: `Los conceptos suman ${pesos(suma)}, igual al total impreso.` }
  }
  return {
    id,
    estado: 'error',
    titulo,
    detalle: `Los conceptos suman ${pesos(suma)} pero el total impreso dice ${pesos(declarado)} (diferencia ${pesos(dif)}). Puede ser un error de lectura: revisá los importes contra la foto.`,
  }
}

/** Días hábiles (lun-vie, sin feriados) */
export function diaHabilLimite(periodo: string, feriados: Set<string>, n = 4) {
  const [a, m] = sumarMeses(periodo, 1).split('-').map(Number)
  let habiles = 0
  for (let d = 1; d <= 31; d++) {
    const fecha = new Date(Date.UTC(a, m - 1, d))
    const iso = fecha.toISOString().slice(0, 10)
    const dia = fecha.getUTCDay()
    if (dia !== 0 && dia !== 6 && !feriados.has(iso)) habiles++
    if (habiles === n) return iso
  }
  return null
}

const buscar = (r: DatosRecibo, patron: RegExp, tipo?: TipoConcepto) =>
  r.conceptos.filter((c) => patron.test(c.nombre) && (!tipo || c.tipo === tipo))

export interface OpcionesAuditoria {
  anterior?: DatosRecibo | null
  feriados?: Set<string>
}

export function auditar(r: DatosRecibo, { anterior = null, feriados = new Set() }: OpcionesAuditoria = {}): Chequeo[] {
  const out: Chequeo[] = []
  const push = (c: Chequeo | null) => c && out.push(c)
  const t = totalesEfectivos(r)

  push(chequeoSuma('suma-rem', 'Suma de haberes remunerativos', 'remunerativo', r.totales.remunerativo, r))
  push(chequeoSuma('suma-norem', 'Suma de haberes no remunerativos', 'no_remunerativo', r.totales.noRemunerativo, r))
  push(chequeoSuma('suma-ret', 'Suma de descuentos', 'retencion', r.totales.retenciones, r))

  if (r.totales.neto != null) {
    const calculado = redondear(t.remunerativo + t.noRemunerativo - t.retenciones)
    const dif = redondear(r.totales.neto - calculado)
    push(
      Math.abs(dif) <= TOLERANCIA
        ? { id: 'neto', estado: 'ok', titulo: 'Sueldo neto', detalle: `Remunerativo + no remunerativo − descuentos = ${pesos(calculado)}.` }
        : { id: 'neto', estado: 'error', titulo: 'Sueldo neto', detalle: `La cuenta da ${pesos(calculado)} pero el neto impreso es ${pesos(r.totales.neto)} (diferencia ${pesos(dif)}).` },
    )
  }

  if (r.totales.netoEnLetras != null && r.totales.neto != null) {
    const dif = redondear(r.totales.neto - r.totales.netoEnLetras)
    push(
      Math.abs(dif) < 0.01
        ? { id: 'letras', estado: 'ok', titulo: 'Neto en letras', detalle: 'El importe en letras coincide con el número.' }
        : { id: 'letras', estado: 'error', titulo: 'Neto en letras', detalle: `En letras dice ${pesos(r.totales.netoEnLetras)} y en números ${pesos(r.totales.neto)}. Ante una diferencia, vale lo que figura en letras.` },
    )
  }

  // Aporte jubilatorio: 11% del remunerativo en el régimen general (SIPA)
  const jubilacion = buscar(r, /jubil|sipa/i, 'retencion')
  if (jubilacion.length && t.remunerativo > 0) {
    const importe = jubilacion.reduce((s, c) => s + c.importe, 0)
    const alicuota = importe / t.remunerativo
    push(
      Math.abs(alicuota - 0.11) < 0.0015
        ? { id: 'jubilacion', estado: 'ok', titulo: 'Aporte jubilatorio', detalle: `${pesos(importe)} es el ${porcentaje(alicuota)} de tu remunerativo, como corresponde en el régimen general.` }
        : { id: 'jubilacion', estado: 'alerta', titulo: 'Aporte jubilatorio', detalle: `${pesos(importe)} es el ${porcentaje(alicuota)} de tu remunerativo; en el régimen general es 11%. Puede estar bien si tu caja es provincial o si superás el tope de la base imponible.` },
    )
  }

  // Fecha de pago: art. 128 LCT, hasta el 4° día hábil del mes siguiente
  if (r.fechaPago && r.tipoLiquidacion === 'mensual') {
    const limite = diaHabilLimite(r.periodo, feriados)
    if (limite) {
      push(
        r.fechaPago <= limite
          ? { id: 'pago', estado: 'ok', titulo: 'Fecha de pago', detalle: `Cobraste dentro del plazo legal (hasta el ${limite.split('-').reverse().join('/')}, 4° día hábil).` }
          : { id: 'pago', estado: 'alerta', titulo: 'Fecha de pago', detalle: `La ley (art. 128 LCT) fija como límite el 4° día hábil: ${limite.split('-').reverse().join('/')}. Este recibo figura pagado después.` },
      )
    }
  }

  // Depósito de aportes (SUSS): el último período depositado no debería atrasarse más de un mes
  if (r.sussUltimoDeposito?.periodo) {
    const atraso = mesesEntre(r.sussUltimoDeposito.periodo, r.periodo)
    push(
      atraso <= 1
        ? { id: 'suss', estado: 'ok', titulo: 'Depósito de aportes', detalle: 'Tu empleador informa aportes depositados al día.' }
        : {
            id: 'suss',
            estado: atraso > 2 ? 'error' : 'alerta',
            titulo: 'Depósito de aportes',
            detalle: `El último depósito informado es del período ${r.sussUltimoDeposito.periodo}, ${atraso} meses antes de este recibo. Verificalo en Mi Argentina → Trabajo → Mi Liquidación Digital.`,
          },
    )
  }

  if (r.empleado.fechaIngreso) {
    const [ai, mi] = r.empleado.fechaIngreso.split('-').map(Number)
    const [ap, mp] = r.periodo.split('-').map(Number)
    const anios = ap - ai - (mp < mi ? 1 : 0)
    if (mp === mi && anios > 0) {
      push({ id: 'antiguedad', estado: 'info', titulo: 'Aniversario', detalle: `Este mes cumplís ${anios} año${anios > 1 ? 's' : ''} de antigüedad. Fijate si el adicional se actualiza.` })
    }
  }

  if (anterior) out.push(...compararConAnterior(r, anterior))
  return out
}

const clave = (nombre: string) => nombre.toLowerCase().replace(/[^a-z0-9ñ]/g, '')

/** Cambios de alícuotas y conceptos que aparecen o desaparecen respecto del mes anterior */
export function compararConAnterior(r: DatosRecibo, ant: DatosRecibo): Chequeo[] {
  const out: Chequeo[] = []
  const t = totalesEfectivos(r)
  const ta = totalesEfectivos(ant)

  const actuales = new Map(r.conceptos.map((c) => [clave(c.nombre), c]))
  const previos = new Map(ant.conceptos.map((c) => [clave(c.nombre), c]))

  const faltan = [...previos.values()].filter((c) => c.tipo !== 'retencion' && !actuales.has(clave(c.nombre)))
  if (faltan.length) {
    out.push({
      id: 'faltan',
      estado: 'alerta',
      titulo: 'Conceptos que ya no cobrás',
      detalle: `El mes anterior cobraste ${faltan.map((c) => `${c.nombre} (${pesos(c.importe)})`).join(', ')} y este mes no aparece${faltan.length > 1 ? 'n' : ''}.`,
    })
  }
  const nuevos = [...actuales.values()].filter((c) => !previos.has(clave(c.nombre)))
  if (nuevos.length) {
    out.push({ id: 'nuevos', estado: 'info', titulo: 'Conceptos nuevos', detalle: nuevos.map((c) => `${c.nombre} (${pesos(c.importe)})`).join(', ') })
  }

  if (t.remunerativo > 0 && ta.remunerativo > 0) {
    const cambios: string[] = []
    for (const c of r.conceptos.filter((c) => c.tipo === 'retencion')) {
      const p = previos.get(clave(c.nombre))
      if (!p) continue
      const ahora = c.importe / t.remunerativo
      const antes = p.importe / ta.remunerativo
      if (Math.abs(ahora - antes) > 0.002) cambios.push(`${c.nombre}: ${porcentaje(antes)} → ${porcentaje(ahora)}`)
    }
    if (cambios.length) {
      out.push({ id: 'alicuotas', estado: 'alerta', titulo: 'Cambió el peso de un descuento', detalle: `Sobre tu remunerativo: ${cambios.join('; ')}.` })
    }
  }

  if (t.neto < ta.neto) {
    out.push({ id: 'baja', estado: 'alerta', titulo: 'Cobraste menos que el mes anterior', detalle: `El neto bajó ${pesos(ta.neto - t.neto)} (${porcentaje(t.neto / ta.neto - 1)}).` })
  }
  return out
}

export function estadoGeneral(chequeos: Chequeo[]): EstadoChequeo {
  if (chequeos.some((c) => c.estado === 'error')) return 'error'
  if (chequeos.some((c) => c.estado === 'alerta')) return 'alerta'
  return 'ok'
}
