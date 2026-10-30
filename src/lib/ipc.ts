/** IPC Nacional: lo usan la app y el service worker, por eso no depende de la base de datos */
import { sumarMeses } from './format'

// Índice nivel general, base dic-2016 (INDEC vía datos.gob.ar)
export const IPC_URL = 'https://apis.datos.gob.ar/series/api/series/?ids=148.3_INIVELNAL_DICI_M_26&limit=1000&format=json'
// Variación mensual: datos.gob.ar puede tardar semanas en cargar un mes que INDEC ya publicó
export const INFLACION_URL = 'https://api.argentinadatos.com/v1/finanzas/indices/inflacion'

type Fila = [periodo: string, valor: number]

/** Agrega al índice los meses siguientes usando su variación mensual en %, sin dejar huecos */
export function extenderIpc(indice: Fila[], variaciones: Fila[]): Fila[] {
  const filas = [...indice].sort(([a], [b]) => a.localeCompare(b))
  const porMes = new Map(variaciones)
  let ultimo = filas.at(-1)
  while (ultimo) {
    const periodo = sumarMeses(ultimo[0], 1)
    const variacion = porMes.get(periodo)
    if (variacion == null) break
    ultimo = [periodo, Math.round(ultimo[1] * (1 + variacion / 100) * 10000) / 10000]
    filas.push(ultimo)
  }
  return filas
}

async function descargarVariaciones(): Promise<Fila[]> {
  const res = await fetch(INFLACION_URL)
  if (!res.ok) throw new Error(`ArgentinaDatos respondió ${res.status}`)
  const json = (await res.json()) as { fecha: string; valor: number }[]
  return json.map((d) => [d.fecha.slice(0, 7), d.valor])
}

export async function descargarIpc(): Promise<Fila[]> {
  const res = await fetch(IPC_URL)
  if (!res.ok) throw new Error(`INDEC respondió ${res.status}`)
  const json = (await res.json()) as { data: [string, number | null][] }
  const indice = json.data.filter(([, v]) => v != null).map(([fecha, v]): Fila => [fecha.slice(0, 7), v as number])
  // Si la fuente secundaria falla, sirve igual la serie de INDEC aunque esté atrasada
  return extenderIpc(indice, await descargarVariaciones().catch(() => []))
}
