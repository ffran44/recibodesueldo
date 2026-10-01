/**
 * Aviso de cobro: el sueldo de cada mes se paga hasta el 4° día hábil del mes siguiente (art. 128 LCT).
 * Funciones puras: las usa la app y también el service worker para avisar en segundo plano.
 */
import type { DatosRecibo } from './types'
import { diaHabilLimite } from './audit'
import { sumarMeses } from './format'

export interface AvisoCobro {
  empleador: string
  /** Mes cuyo recibo falta, YYYY-MM */
  periodo: string
  /** Último día para pagarlo, YYYY-MM-DD */
  limite: string
  estado: 'pendiente' | 'vence-hoy' | 'atrasado'
  /** Días que faltan (pendiente) o que pasaron (atrasado) */
  dias: number
}

const DIA = 86_400_000
const diasEntre = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DIA)
const mismo = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

export function avisosDeCobro(recibos: DatosRecibo[], hoy: string, feriados: Set<string>): AvisoCobro[] {
  const esperado = sumarMeses(hoy.slice(0, 7), -1)
  const limite = diaHabilLimite(esperado, feriados)
  if (!limite) return []

  // Solo empleos con recibos recientes: no tiene sentido avisar por un trabajo de hace un año
  const recientes = recibos.filter((r) => r.tipoLiquidacion === 'mensual' && r.periodo >= sumarMeses(esperado, -3))
  const empleadores = [...new Map(recientes.map((r) => [r.empleador.nombre.trim().toLowerCase(), r.empleador.nombre.trim()])).values()]

  return empleadores
    .filter((nombre) => !recientes.some((r) => mismo(r.empleador.nombre, nombre) && r.periodo >= esperado))
    .map((empleador) => {
      const estado: AvisoCobro['estado'] = hoy > limite ? 'atrasado' : hoy === limite ? 'vence-hoy' : 'pendiente'
      return { empleador, periodo: esperado, limite, estado, dias: Math.abs(diasEntre(limite, hoy)) }
    })
}

/** Clave para recordar que la persona ya cobró (o no quiere el aviso) de ese mes */
export const claveAviso = (a: Pick<AvisoCobro, 'empleador' | 'periodo'>) => `${a.periodo}|${a.empleador.toLowerCase()}`

export const AJUSTE_OCULTOS = 'avisoCobroOculto'
export const AJUSTE_NOTIFICADOS = 'avisoCobroNotificado'
export const AJUSTE_ACTIVOS = 'avisosActivos'

/** Avisos para mostrar: vencidos o que vencen hoy, salvo los que la persona ocultó */
export function avisosVisibles(avisos: AvisoCobro[], ocultos: Record<string, string>, hoy: string) {
  return avisos.filter((a) => a.estado !== 'pendiente' && !(ocultos[claveAviso(a)] && ocultos[claveAviso(a)] >= hoy))
}

/** De los visibles, los que todavía no se notificaron hoy */
export function avisosANotificar(visibles: AvisoCobro[], notificados: Record<string, string>, hoy: string) {
  return visibles.filter((a) => notificados[claveAviso(a)] !== hoy)
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export function textoAviso(a: AvisoCobro) {
  const mes = MESES[Number(a.periodo.slice(5)) - 1]
  const limite = a.limite.slice(8) + '/' + a.limite.slice(5, 7)
  return {
    titulo: a.estado === 'vence-hoy' ? `Hoy te tienen que pagar ${mes}` : `¿Cobraste ${mes}?`,
    cuerpo:
      a.estado === 'vence-hoy'
        ? `Hoy (${limite}) es el último día para que ${a.empleador} te pague el sueldo de ${mes}.`
        : `Ya pasó el 4° día hábil (${limite}) y no cargaste el recibo de ${mes} de ${a.empleador}.`,
  }
}
