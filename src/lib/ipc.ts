/** IPC Nacional nivel general, base dic-2016 (INDEC vía datos.gob.ar). Sin dependencias: lo usa también el service worker. */
export const IPC_URL = 'https://apis.datos.gob.ar/series/api/series/?ids=148.3_INIVELNAL_DICI_M_26&limit=1000&format=json'

export async function descargarIpc(): Promise<[string, number][]> {
  const res = await fetch(IPC_URL)
  if (!res.ok) throw new Error(`INDEC respondió ${res.status}`)
  const json = (await res.json()) as { data: [string, number | null][] }
  return json.data.filter(([, v]) => v != null).map(([fecha, v]) => [fecha.slice(0, 7), v as number])
}
