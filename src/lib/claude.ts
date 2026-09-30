import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { aDatosRecibo, EsquemaRecibo, INSTRUCCIONES } from './esquema'
import { SinApiKey } from './errores'
import { obtenerApiKey, obtenerModelo } from './settings'

// Si el modelo declina por sus filtros de seguridad, el servidor reintenta con el modelo recomendado
const FALLBACK = { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }

function cliente() {
  const apiKey = obtenerApiKey('claude')
  if (!apiKey) throw new SinApiKey('Anthropic')
  // App personal: la clave vive solo en este equipo y va directo a Anthropic
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
}

export async function interpretarConClaude(texto: string) {
  const respuesta = await cliente().beta.messages.parse({
    model: obtenerModelo('claude'),
    max_tokens: 16000,
    system: INSTRUCCIONES,
    output_config: { effort: 'high', format: betaZodOutputFormat(EsquemaRecibo) },
    messages: [{ role: 'user', content: texto }],
    ...FALLBACK,
  })
  if (respuesta.stop_reason === 'refusal') throw new Error('El modelo no pudo procesar este recibo. Cargalo a mano.')
  if (respuesta.stop_reason === 'max_tokens') throw new Error('El recibo es demasiado largo para leerlo de una vez.')
  if (!respuesta.parsed_output) throw new Error('No se pudo interpretar la respuesta. Probá de nuevo.')
  return aDatosRecibo(respuesta.parsed_output)
}

export async function preguntarAClaude(sistema: string, pregunta: string, alEscribir: (parcial: string) => void) {
  const stream = cliente().beta.messages.stream({
    model: obtenerModelo('claude'),
    max_tokens: 16000,
    output_config: { effort: 'medium' },
    system: [{ type: 'text', text: sistema, cache_control: { type: 'ephemeral' } }],
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
