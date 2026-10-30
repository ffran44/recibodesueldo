import { afterEach, describe, expect, it, vi } from 'vitest'
import { descargarIpc, extenderIpc } from './ipc'

const base: [string, number][] = [
  ['2026-07', 100],
  ['2026-08', 200],
]

describe('extenderIpc', () => {
  it('agrega los meses que la serie todavía no tiene, con la variación publicada', () => {
    expect(extenderIpc(base, [['2026-09', 1.9]]).at(-1)).toEqual(['2026-09', 203.8])
  })

  it('encadena varios meses seguidos', () => {
    const r = extenderIpc(base, [
      ['2026-09', 10],
      ['2026-10', 10],
    ])
    expect(r.at(-1)?.[0]).toBe('2026-10')
    expect(r.at(-1)?.[1]).toBeCloseTo(242, 6)
  })

  it('no toca los meses que la serie ya tiene', () => {
    expect(extenderIpc(base, [['2026-08', 50]])).toEqual(base)
  })

  it('no deja huecos: si falta un mes, no sigue', () => {
    expect(extenderIpc(base, [['2026-10', 1.9]])).toEqual(base)
  })

  it('funciona aunque los datos vengan desordenados', () => {
    const r = extenderIpc([...base].reverse(), [
      ['2026-10', 10],
      ['2026-09', 10],
    ])
    expect(r.map(([p]) => p)).toEqual(['2026-07', '2026-08', '2026-09', '2026-10'])
  })
})

describe('descargarIpc', () => {
  afterEach(() => vi.unstubAllGlobals())

  const respuesta = (json: unknown, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => json })
  const indec = { data: [['2026-07-01', 100], ['2026-08-01', 200], ['2026-09-01', null]] }

  it('completa con ArgentinaDatos cuando INDEC está atrasado', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => respuesta(url.includes('argentinadatos') ? [{ fecha: '2026-09-30', valor: 1.9 }] : indec)))
    expect((await descargarIpc()).at(-1)).toEqual(['2026-09', 203.8])
  })

  it('si falla la fuente secundaria, sigue con la serie de INDEC', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (url.includes('argentinadatos') ? respuesta(null, false) : respuesta(indec))))
    expect((await descargarIpc()).at(-1)).toEqual(['2026-08', 200])
  })
})
