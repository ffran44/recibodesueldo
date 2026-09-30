import { useEffect, useState } from 'react'
import type { SerieDiaria, SerieMensual } from './analysis'
import { cargarTodo } from './econ'

export interface Economia {
  cargando: boolean
  ipc?: SerieMensual
  oficial?: SerieDiaria
  blue?: SerieDiaria
  errores: number
}

let enCurso: ReturnType<typeof cargarTodo> | null = null

/** IPC y dólar, con caché local de 12-24 h para funcionar sin conexión */
export function useEconomia(): Economia {
  const [estado, setEstado] = useState<Economia>({ cargando: true, errores: 0 })
  useEffect(() => {
    let vivo = true
    enCurso ??= cargarTodo()
    enCurso.then((datos) => vivo && setEstado({ cargando: false, ...datos }))
    return () => {
      vivo = false
    }
  }, [])
  return estado
}
