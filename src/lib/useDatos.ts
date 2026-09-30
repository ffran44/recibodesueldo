import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { anteriorDe, recibosOrdenados } from './db'
import { auditar, type Chequeo } from './audit'
import { cargarFeriados } from './econ'
import { sumarMeses } from './format'
import type { Recibo } from './types'

export function useRecibos() {
  return useLiveQuery(recibosOrdenados, [])
}

/** Auditoría completa: incluye comparación con el mes anterior y feriados nacionales */
export function useAuditoria(recibo: Recibo | undefined | null, todos: Recibo[] | undefined): Chequeo[] {
  const [feriados, setFeriados] = useState<Set<string>>(new Set())
  const anioPago = recibo ? Number(sumarMeses(recibo.periodo, 1).slice(0, 4)) : null

  useEffect(() => {
    if (!anioPago) return
    let vivo = true
    cargarFeriados(anioPago)
      .then((f) => vivo && setFeriados(f))
      .catch(() => {}) // Sin feriados el cálculo sigue siendo válido para la mayoría de los meses
    return () => {
      vivo = false
    }
  }, [anioPago])

  return useMemo(() => {
    if (!recibo) return []
    return auditar(recibo, { anterior: todos ? anteriorDe(recibo, todos) : null, feriados })
  }, [recibo, todos, feriados])
}
