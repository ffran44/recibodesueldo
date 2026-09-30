import { db } from './db'
import { aBase64, desdeBase64 } from './image'
import { totalesEfectivos } from './audit'
import type { Recibo } from './types'

interface Respaldo {
  version: 1
  exportadoEn: string
  recibos: Recibo[]
  adjuntos: { reciboId: string; nombre: string; tipo: string; base64: string }[]
}

function descargar(contenido: Blob, nombre: string) {
  const url = URL.createObjectURL(contenido)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const hoy = () => new Date().toISOString().slice(0, 10)

export async function exportarRespaldo() {
  const recibos = await db.recibos.toArray()
  const adjuntos = await db.adjuntos.toArray()
  const respaldo: Respaldo = {
    version: 1,
    exportadoEn: new Date().toISOString(),
    recibos,
    adjuntos: await Promise.all(adjuntos.map(async (a) => ({ reciboId: a.reciboId, nombre: a.nombre, tipo: a.tipo, base64: await aBase64(a.blob) }))),
  }
  descargar(new Blob([JSON.stringify(respaldo)], { type: 'application/json' }), `recibos-respaldo-${hoy()}.json`)
}

export async function importarRespaldo(archivo: File) {
  const respaldo = JSON.parse(await archivo.text()) as Respaldo
  if (respaldo.version !== 1 || !Array.isArray(respaldo.recibos)) throw new Error('El archivo no es un respaldo de esta app.')
  const adjuntos = await Promise.all(
    respaldo.adjuntos.map(async (a) => ({ reciboId: a.reciboId, nombre: a.nombre, tipo: a.tipo, blob: await desdeBase64(a.base64, a.tipo) })),
  )
  await db.transaction('rw', db.recibos, db.adjuntos, async () => {
    await db.recibos.bulkPut(respaldo.recibos)
    const ids = respaldo.recibos.map((r) => r.id)
    await db.adjuntos.where('reciboId').anyOf(ids).delete()
    await db.adjuntos.bulkAdd(adjuntos)
  })
  return respaldo.recibos.length
}

const celda = (v: unknown) => {
  const s = v == null ? '' : typeof v === 'number' ? v.toFixed(2).replace('.', ',') : String(v)
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** CSV con ; y coma decimal: se abre directo en Excel/Sheets configurados en español */
export async function exportarCsv() {
  const recibos = (await db.recibos.toArray()).sort((a, b) => a.periodo.localeCompare(b.periodo))
  const filas: unknown[][] = [['periodo', 'tipo', 'empleador', 'fecha_pago', 'concepto', 'columna', 'importe', 'neto_del_recibo']]
  for (const r of recibos) {
    const neto = totalesEfectivos(r).neto
    for (const c of r.conceptos) filas.push([r.periodo, r.tipoLiquidacion, r.empleador.nombre, r.fechaPago, c.nombre, c.tipo, c.importe, neto])
  }
  const csv = '﻿' + filas.map((f) => f.map(celda).join(';')).join('\r\n')
  descargar(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `recibos-${hoy()}.csv`)
}

export async function borrarTodo() {
  await Promise.all([db.recibos.clear(), db.adjuntos.clear()])
}
