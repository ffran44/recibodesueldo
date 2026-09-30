import { conCache } from './db'
import type { SerieDiaria, SerieMensual } from './analysis'

// IPC Nacional nivel general, base dic-2016 (INDEC vía datos.gob.ar)
const IPC_URL = 'https://apis.datos.gob.ar/series/api/series/?ids=148.3_INIVELNAL_DICI_M_26&limit=1000&format=json'

export async function cargarIpc(): Promise<SerieMensual> {
  const filas = await conCache('ipc', 24, async () => {
    const res = await fetch(IPC_URL)
    if (!res.ok) throw new Error(`INDEC respondió ${res.status}`)
    const json = (await res.json()) as { data: [string, number | null][] }
    return json.data.filter(([, v]) => v != null).map(([fecha, v]) => [fecha.slice(0, 7), v] as [string, number])
  })
  return new Map(filas)
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
