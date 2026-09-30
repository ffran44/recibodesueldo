import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import type { BetaContentBlockParam } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import { z } from 'zod'
import { aBase64, prepararImagen } from './image'
import { obtenerApiKey, obtenerModelo } from './settings'
import type { DatosRecibo } from './types'
import { totalesEfectivos } from './audit'

// Si el modelo declina por sus filtros de seguridad, el servidor reintenta con el modelo recomendado
const FALLBACK = { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }

export class SinApiKey extends Error {
  constructor() {
    super('Falta tu API key de Anthropic. Cargala en Ajustes.')
  }
}

function cliente() {
  const apiKey = obtenerApiKey()
  if (!apiKey) throw new SinApiKey()
  // App personal: la clave vive solo en este dispositivo y va directo a Anthropic
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
}

const fecha = z.string().nullable().describe('Formato YYYY-MM-DD, o null si no figura')

const EsquemaRecibo = z.object({
  periodo: z.string().describe('Mes liquidado en formato YYYY-MM (ej: "Haberes mensual del mes de Agosto de 2026" -> "2026-08")'),
  tipoLiquidacion: z.enum(['mensual', 'sac', 'vacaciones', 'final', 'otro']),
  empleador: z.object({ nombre: z.string(), cuit: z.string().nullable() }),
  empleado: z.object({
    nombre: z.string(),
    cuil: z.string().nullable(),
    legajo: z.string().nullable(),
    categoria: z.string().nullable().describe('Categoría, cargo o convenio'),
    fechaIngreso: fecha,
    obraSocial: z.string().nullable(),
  }),
  fechaPago: fecha,
  banco: z.string().nullable(),
  sussUltimoDeposito: z
    .object({ fecha, periodo: z.string().nullable().describe('Período depositado en formato YYYY-MM') })
    .nullable()
    .describe('Datos del último depósito de aportes (SUSS / art. 12 Ley 17.250), si figuran'),
  conceptos: z.array(
    z.object({
      codigo: z.string().nullable(),
      nombre: z.string().describe('Tal como figura, en mayúsculas si así está impreso'),
      cantidad: z.number().nullable(),
      tipo: z.enum(['remunerativo', 'no_remunerativo', 'retencion']).describe('Según la columna en la que figura el importe'),
      importe: z.number().describe('Siempre positivo, en pesos'),
    }),
  ),
  totales: z.object({
    remunerativo: z.number().nullable(),
    noRemunerativo: z.number().nullable(),
    retenciones: z.number().nullable(),
    neto: z.number().nullable(),
    netoEnLetras: z.number().nullable().describe('El importe escrito en palabras ("Recibí conforme la suma de..."), convertido a número'),
  }),
  costoEmpleador: z.number().nullable().describe('Costo total del empleador, si el recibo lo informa'),
  advertencias: z.array(z.string()).describe('Campos ilegibles, dudosos o ambiguos. Vacío si todo se leyó bien.'),
})

const INSTRUCCIONES = `Transcribís recibos de sueldo argentinos (Ley 20.744) a datos estructurados.

Reglas:
- Los montos argentinos usan punto para miles y coma para decimales: "74.030,18" es 74030.18.
- Cada concepto va en la columna de su importe: Remunerativos (haberes con aportes), No remunerativos, o Retenciones/Descuentos. Respetá la columna impresa, no lo que "debería" ser.
- Solo incluí en "conceptos" las líneas del detalle de liquidación. No incluyas las contribuciones patronales ni los cuadros resumen (composición salarial, gráficos).
- Los totales van tal como están impresos al pie de cada columna; no los calcules vos. Si no hay total impreso, null.
- No inventes datos. Si algo no se lee, usá null y explicalo en "advertencias".
- Fechas "dd/mm/aaaa" -> "aaaa-mm-dd". Período "07/2026" -> "2026-07".`

export interface ResultadoExtraccion {
  datos: DatosRecibo
  advertencias: string[]
}

export async function extraerRecibo(archivos: Blob[]): Promise<ResultadoExtraccion> {
  const contenido: BetaContentBlockParam[] = []
  for (const archivo of archivos) {
    if (archivo.type === 'application/pdf') {
      contenido.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: await aBase64(archivo) } })
    } else {
      const img = await prepararImagen(archivo)
      contenido.push({ type: 'image', source: { type: 'base64', media_type: img.tipo, data: img.base64 } })
    }
  }
  contenido.push({
    type: 'text',
    text: archivos.length > 1 ? 'Estas son las páginas de un mismo recibo. Transcribilo.' : 'Transcribí este recibo.',
  })

  const respuesta = await cliente().beta.messages.parse({
    model: obtenerModelo(),
    max_tokens: 16000,
    system: INSTRUCCIONES,
    output_config: { effort: 'high', format: betaZodOutputFormat(EsquemaRecibo) },
    messages: [{ role: 'user', content: contenido }],
    ...FALLBACK,
  })

  if (respuesta.stop_reason === 'refusal') throw new Error('El modelo no pudo procesar esta imagen. Probá con otra foto o cargalo a mano.')
  if (respuesta.stop_reason === 'max_tokens') throw new Error('El recibo es demasiado largo para leerlo de una vez.')
  const salida = respuesta.parsed_output
  if (!salida) throw new Error('No se pudo interpretar la respuesta. Probá de nuevo.')

  const { advertencias, ...datos } = salida
  return { datos, advertencias }
}

/** Preguntas en lenguaje natural sobre el historial de recibos */
export async function preguntar(
  pregunta: string,
  recibos: DatosRecibo[],
  contexto: string,
  alEscribir: (textoParcial: string) => void,
): Promise<string> {
  const historial = recibos.map((r) => ({
    periodo: r.periodo,
    tipo: r.tipoLiquidacion,
    empleador: r.empleador.nombre,
    fechaPago: r.fechaPago,
    totales: totalesEfectivos(r),
    conceptos: r.conceptos.map((c) => [c.nombre, c.tipo, c.importe]),
  }))

  const stream = cliente().beta.messages.stream({
    model: obtenerModelo(),
    max_tokens: 16000,
    output_config: { effort: 'medium' },
    system: [
      {
        type: 'text',
        text: `Sos un asistente que ayuda a una persona trabajadora en Argentina a entender sus recibos de sueldo. Respondé en español rioplatense, breve y concreto, con números exactos tomados de los datos. Si hacés cuentas, mostralas. Si la respuesta requiere información que no está en los datos, decilo. No des asesoramiento de inversiones.

Contexto económico: ${contexto}

Recibos (JSON, conceptos como [nombre, tipo, importe]):
${JSON.stringify(historial)}`,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: pregunta }],
    ...FALLBACK,
  })

  let texto = ''
  stream.on('text', (delta) => {
    texto += delta
    alEscribir(texto)
  })
  const final = await stream.finalMessage()
  if (final.stop_reason === 'refusal') return 'No puedo responder esa pregunta.'
  return texto
}
