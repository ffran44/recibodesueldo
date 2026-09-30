import { GoogleGenAI } from '@google/genai'
import { z } from 'zod'
import { aDatosRecibo, EsquemaRecibo, INSTRUCCIONES } from './esquema'
import { SinApiKey } from './errores'
import { obtenerApiKey, obtenerModelo } from './settings'

function cliente() {
  const apiKey = obtenerApiKey('gemini')
  if (!apiKey) throw new SinApiKey('Gemini')
  return new GoogleGenAI({ apiKey })
}

/** Gemini acepta JSON Schema; el campo $schema no le sirve */
function esquemaJson() {
  const { $schema: _, ...resto } = z.toJSONSchema(EsquemaRecibo) as Record<string, unknown>
  return resto
}

export async function interpretarConGemini(texto: string) {
  const respuesta = await cliente().interactions.create({
    model: obtenerModelo('gemini'),
    system_instruction: INSTRUCCIONES,
    input: texto,
    response_format: { type: 'text', mime_type: 'application/json', schema: esquemaJson() },
  })
  const salida = respuesta.output_text
  if (!salida) throw new Error('Gemini no devolvió datos. Probá de nuevo en un minuto.')
  const validado = EsquemaRecibo.safeParse(JSON.parse(salida))
  if (!validado.success) throw new Error('Gemini devolvió datos incompletos. Probá de nuevo.')
  return aDatosRecibo(validado.data)
}

export async function preguntarAGemini(sistema: string, pregunta: string) {
  const respuesta = await cliente().interactions.create({
    model: obtenerModelo('gemini'),
    system_instruction: sistema,
    input: pregunta,
  })
  return respuesta.output_text ?? 'No hubo respuesta.'
}
