import { conCache } from './db'
import { descargarIpc } from './ipc'
import type { SerieDiaria, SerieMensual } from './analysis'

export async function cargarIpc(): Promise<SerieMensual> {
  return new Map(await conCache('ipc', 24, descargarIpc))
}

export type Casa = 'oficial' | 'blue' | 'bolsa'

export async function cargarDolar(casa: Casa): Promise<SerieDiaria> {
  const filas = await conCache(`dolar-${casa}`, 12, async () => {
    const res = await fetch(`https://api.argentinadatos.com/v1/cotizaciones/dolares/${casa}`)
    if (!res.ok) throw new Error(`ArgentinaDatos respondió ${res.status}`)
    const json = (await res.json()) as { fecha: string; venta: number }[]
    // Guardamos desde 2015 para no llenar la base con décadas de historia
    return json.filter((d) => d.fecha >= '2015-01-01').map((d) => [d.fecha, d.venta] as [string, number])
  })
  return new Map(filas)
}

export async function cargarFeriados(anio: number): Promise<Set<string>> {
  const fechas = await conCache(`feriados-${anio}`, 24 * 7, async () => {
    const res = await fetch(`https://api.argentinadatos.com/v1/feriados/${anio}`)
    if (!res.ok) throw new Error(`ArgentinaDatos respondió ${res.status}`)
    const json = (await res.json()) as { fecha: string }[]
    return json.map((f) => f.fecha)
  })
  return new Set(fechas)
}

export async function cargarTodo() {
  const [ipc, oficial, blue] = await Promise.allSettled([cargarIpc(), cargarDolar('oficial'), cargarDolar('blue')])
  return {
    ipc: ipc.status === 'fulfilled' ? ipc.value : undefined,
    oficial: oficial.status === 'fulfilled' ? oficial.value : undefined,
    blue: blue.status === 'fulfilled' ? blue.value : undefined,
    errores: [ipc, oficial, blue].filter((p) => p.status === 'rejected').length,
  }
}
