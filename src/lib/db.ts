import Dexie, { type EntityTable } from 'dexie'
import type { Adjunto, Recibo } from './types'

export interface EntradaCache {
  clave: string
  guardadoEn: number
  datos: unknown
}

export const db = new Dexie('recibos') as Dexie & {
  recibos: EntityTable<Recibo, 'id'>
  adjuntos: EntityTable<Adjunto, 'id'>
  cache: EntityTable<EntradaCache, 'clave'>
}

db.version(1).stores({
  recibos: 'id, periodo, [empleador.nombre+periodo]',
  adjuntos: '++id, reciboId',
  cache: 'clave',
})

export async function guardarRecibo(recibo: Recibo, archivos?: File[] | Blob[]) {
  await db.transaction('rw', db.recibos, db.adjuntos, async () => {
    await db.recibos.put(recibo)
    if (archivos) {
      await db.adjuntos.where('reciboId').equals(recibo.id).delete()
      await db.adjuntos.bulkAdd(
        archivos.map((f, i) => ({
          reciboId: recibo.id,
          nombre: f instanceof File ? f.name : `adjunto-${i + 1}`,
          tipo: f.type,
          blob: f,
        })),
      )
    }
  })
}

export async function borrarRecibo(id: string) {
  await db.transaction('rw', db.recibos, db.adjuntos, async () => {
    await db.recibos.delete(id)
    await db.adjuntos.where('reciboId').equals(id).delete()
  })
}

export async function recibosOrdenados() {
  return (await db.recibos.toArray()).sort((a, b) => a.periodo.localeCompare(b.periodo) || a.creadoEn.localeCompare(b.creadoEn))
}

/** Recibo anterior del mismo empleador, para comparar */
export function anteriorDe(recibo: Recibo, todos: Recibo[]) {
  return (
    todos
      .filter((r) => r.id !== recibo.id && r.tipoLiquidacion === 'mensual' && r.empleador.nombre === recibo.empleador.nombre && r.periodo < recibo.periodo)
      .sort((a, b) => b.periodo.localeCompare(a.periodo))[0] ?? null
  )
}

export async function conCache<T>(clave: string, horas: number, cargar: () => Promise<T>): Promise<T> {
  const previo = await db.cache.get(clave)
  if (previo && Date.now() - previo.guardadoEn < horas * 3600_000) return previo.datos as T
  try {
    const datos = await cargar()
    await db.cache.put({ clave, guardadoEn: Date.now(), datos })
    return datos
  } catch (e) {
    // Sin conexión: mejor un dato viejo que nada
    if (previo) return previo.datos as T
    throw e
  }
}
