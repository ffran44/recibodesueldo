/** Escritura del respaldo en una carpeta elegida por la persona (File System Access API) */

export const ARCHIVO_RESPALDO = 'recibos-respaldo.json'
export const ARCHIVO_CSV = 'recibos.csv'
export const CARPETA_HISTORIAL = 'copias-diarias'
const COPIAS_A_CONSERVAR = 14
const PATRON_COPIA = /^recibos-\d{4}-\d{2}-\d{2}\.json$/

interface ArchivoEscribible {
  getFile(): Promise<File>
  createWritable(): Promise<{ write(dato: string | Blob): Promise<void>; close(): Promise<void> }>
}

/** Lo mínimo que se usa de un FileSystemDirectoryHandle (permite probarlo con una carpeta en memoria) */
export interface Carpeta {
  getFileHandle(nombre: string, opciones?: { create?: boolean }): Promise<ArchivoEscribible>
  getDirectoryHandle(nombre: string, opciones?: { create?: boolean }): Promise<Carpeta>
  removeEntry(nombre: string): Promise<void>
  keys(): AsyncIterable<string>
}

interface RespaldoMinimo {
  recibos: unknown[]
}

async function escribir(carpeta: Carpeta, nombre: string, contenido: string) {
  const archivo = await carpeta.getFileHandle(nombre, { create: true })
  const flujo = await archivo.createWritable()
  await flujo.write(contenido)
  await flujo.close()
}

const fechaLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export async function escribirEnCarpeta(carpeta: Carpeta, respaldo: RespaldoMinimo, csv: string, ahora: Date) {
  // Si la app quedó vacía (navegador borrado, "Borrar todo"), no se pisa el último respaldo bueno
  if (!respaldo.recibos.length) return { escrito: false, recibos: 0 }

  const json = JSON.stringify(respaldo)
  await escribir(carpeta, ARCHIVO_RESPALDO, json)
  await escribir(carpeta, ARCHIVO_CSV, csv)

  // Una copia por día, para poder volver atrás si algo sale mal
  const historial = await carpeta.getDirectoryHandle(CARPETA_HISTORIAL, { create: true })
  await escribir(historial, `recibos-${fechaLocal(ahora)}.json`, json)
  const copias: string[] = []
  for await (const nombre of historial.keys()) if (PATRON_COPIA.test(nombre)) copias.push(nombre)
  for (const viejo of copias.sort().slice(0, -COPIAS_A_CONSERVAR)) await historial.removeEntry(viejo)

  return { escrito: true, recibos: respaldo.recibos.length }
}

export async function leerRespaldoDeCarpeta(carpeta: Carpeta): Promise<string> {
  try {
    const archivo = await carpeta.getFileHandle(ARCHIVO_RESPALDO)
    return await (await archivo.getFile()).text()
  } catch {
    throw new Error(`En esa carpeta no hay un respaldo de la app (${ARCHIVO_RESPALDO}).`)
  }
}
