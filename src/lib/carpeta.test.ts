import { describe, expect, it } from 'vitest'
import { CARPETA_HISTORIAL, ARCHIVO_RESPALDO, ARCHIVO_CSV, escribirEnCarpeta, leerRespaldoDeCarpeta, type Carpeta } from './carpeta'

/** Carpeta en memoria con la misma forma que un FileSystemDirectoryHandle */
function carpetaFalsa(): Carpeta & { archivos: Map<string, string>; sub: Map<string, ReturnType<typeof carpetaFalsa>> } {
  const archivos = new Map<string, string>()
  const sub = new Map<string, ReturnType<typeof carpetaFalsa>>()
  return {
    archivos,
    sub,
    async getFileHandle(nombre, opciones) {
      if (!archivos.has(nombre) && !opciones?.create) throw new DOMException('No existe', 'NotFoundError')
      return {
        async getFile() {
          return new File([archivos.get(nombre) ?? ''], nombre)
        },
        async createWritable() {
          let contenido = ''
          return {
            async write(dato: string | Blob) {
              contenido += typeof dato === 'string' ? dato : await dato.text()
            },
            async close() {
              archivos.set(nombre, contenido)
            },
          }
        },
      }
    },
    async getDirectoryHandle(nombre, opciones) {
      if (!sub.has(nombre)) {
        if (!opciones?.create) throw new DOMException('No existe', 'NotFoundError')
        sub.set(nombre, carpetaFalsa())
      }
      return sub.get(nombre)!
    },
    async removeEntry(nombre) {
      archivos.delete(nombre)
    },
    async *keys() {
      yield* [...archivos.keys(), ...sub.keys()]
    },
  }
}

const respaldo = (n: number) => ({ version: 1 as const, exportadoEn: '2026-10-01T10:00:00Z', recibos: Array.from({ length: n }, (_, i) => ({ id: `r${i}` })), adjuntos: [] })

describe('escribirEnCarpeta', () => {
  it('escribe el respaldo, el CSV y la copia del día', async () => {
    const c = carpetaFalsa()
    const r = await escribirEnCarpeta(c, respaldo(3) as never, 'csv;datos', new Date('2026-10-01T15:00:00'))
    expect(r).toEqual({ escrito: true, recibos: 3 })
    expect(JSON.parse(c.archivos.get(ARCHIVO_RESPALDO)!).recibos).toHaveLength(3)
    expect(c.archivos.get(ARCHIVO_CSV)).toBe('csv;datos')
    expect([...c.sub.get(CARPETA_HISTORIAL)!.archivos.keys()]).toEqual(['recibos-2026-10-01.json'])
  })

  it('no pisa un respaldo con datos cuando la app quedó vacía', async () => {
    const c = carpetaFalsa()
    await escribirEnCarpeta(c, respaldo(5) as never, 'csv', new Date('2026-10-01'))
    const r = await escribirEnCarpeta(c, respaldo(0) as never, '', new Date('2026-10-02'))
    expect(r).toEqual({ escrito: false, recibos: 0 })
    expect(JSON.parse(c.archivos.get(ARCHIVO_RESPALDO)!).recibos).toHaveLength(5)
  })

  it('conserva solo las últimas 14 copias diarias', async () => {
    const c = carpetaFalsa()
    for (let d = 1; d <= 20; d++) await escribirEnCarpeta(c, respaldo(1) as never, '', new Date(2026, 9, d, 12))
    const copias = [...c.sub.get(CARPETA_HISTORIAL)!.archivos.keys()].sort()
    expect(copias).toHaveLength(14)
    expect(copias[0]).toBe('recibos-2026-10-07.json')
    expect(copias.at(-1)).toBe('recibos-2026-10-20.json')
  })

  it('no borra archivos ajenos que la persona tenga en la carpeta de historial', async () => {
    const c = carpetaFalsa()
    await escribirEnCarpeta(c, respaldo(1) as never, '', new Date(2026, 9, 1))
    c.sub.get(CARPETA_HISTORIAL)!.archivos.set('notas.txt', 'mío')
    for (let d = 2; d <= 20; d++) await escribirEnCarpeta(c, respaldo(1) as never, '', new Date(2026, 9, d))
    expect(c.sub.get(CARPETA_HISTORIAL)!.archivos.get('notas.txt')).toBe('mío')
  })
})

describe('leerRespaldoDeCarpeta', () => {
  it('lee el respaldo principal', async () => {
    const c = carpetaFalsa()
    await escribirEnCarpeta(c, respaldo(2) as never, '', new Date())
    expect(JSON.parse(await leerRespaldoDeCarpeta(c)).recibos).toHaveLength(2)
  })
  it('explica qué pasa si la carpeta no tiene respaldo', async () => {
    await expect(leerRespaldoDeCarpeta(carpetaFalsa())).rejects.toThrow(/no hay un respaldo/i)
  })
})
