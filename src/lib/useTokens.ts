import { useEffect, useState } from 'react'

const NOMBRES = [
  '--serie-real',
  '--serie-nominal',
  '--serie-blue',
  '--serie-ref',
  '--g-rem',
  '--g-norem',
  '--g-desc',
  '--div-pos',
  '--div-neg',
  '--tinta',
  '--tinta-2',
  '--tinta-3',
  '--regla',
  '--hoja',
] as const
type Tokens = Record<(typeof NOMBRES)[number], string>

const leer = (): Tokens => {
  const estilo = getComputedStyle(document.documentElement)
  return Object.fromEntries(NOMBRES.map((n) => [n, estilo.getPropertyValue(n).trim()])) as Tokens
}

/** Los atributos SVG de Recharts no aceptan var(): leemos los colores resueltos y seguimos el modo oscuro */
export function useTokens() {
  const [tokens, setTokens] = useState(leer)
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const actualizar = () => setTokens(leer())
    mq.addEventListener('change', actualizar)
    return () => mq.removeEventListener('change', actualizar)
  }, [])
  return tokens
}
