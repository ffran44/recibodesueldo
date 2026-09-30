import type { DatosRecibo } from './types'
import { totalesEfectivos } from './audit'
import { obtenerProveedor } from './settings'

export { SinApiKey } from './errores'

export interface ResultadoInterpretacion {
  datos: DatosRecibo
  advertencias: string[]
}

/** Convierte el texto (ya sin datos personales) en un recibo estructurado */
export async function interpretarTexto(texto: string): Promise<ResultadoInterpretacion> {
  if (obtenerProveedor() === 'claude') {
    const { interpretarConClaude } = await import('./claude')
    return interpretarConClaude(texto)
  }
  const { interpretarConGemini } = await import('./gemini')
  return interpretarConGemini(texto)
}

/** Preguntas sobre el historial. Se mandan importes y conceptos, nunca nombre ni CUIL. */
export async function preguntar(pregunta: string, recibos: DatosRecibo[], contexto: string, alEscribir: (parcial: string) => void) {
  const historial = recibos.map((r) => ({
    periodo: r.periodo,
    tipo: r.tipoLiquidacion,
    empleador: r.empleador.nombre,
    fechaPago: r.fechaPago,
    totales: totalesEfectivos(r),
    conceptos: r.conceptos.map((c) => [c.nombre, c.tipo, c.importe]),
  }))
  const sistema = `Sos un asistente que ayuda a una persona trabajadora en Argentina a entender sus recibos de sueldo. Respondé en español rioplatense, breve y concreto, con números exactos tomados de los datos. Si hacés cuentas, mostralas. Si la respuesta requiere información que no está en los datos, decilo. No des asesoramiento de inversiones. Respondé en texto plano, sin markdown.

Contexto económico: ${contexto}

Recibos (JSON, conceptos como [nombre, tipo, importe]):
${JSON.stringify(historial)}`

  if (obtenerProveedor() === 'claude') {
    const { preguntarAClaude } = await import('./claude')
    return preguntarAClaude(sistema, pregunta, alEscribir)
  }
  const { preguntarAGemini } = await import('./gemini')
  const respuesta = await preguntarAGemini(sistema, pregunta)
  alEscribir(respuesta)
  return respuesta
}
