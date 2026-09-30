const ars = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const arsCorto = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })
const pct = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export const pesos = (n: number | null | undefined) => (n == null ? '—' : `$ ${ars.format(n)}`)
export const numero = (n: number | null | undefined) => (n == null ? '—' : ars.format(n))
export const pesosCorto = (n: number | null | undefined) => (n == null ? '—' : `$ ${arsCorto.format(n)}`)
export const porcentaje = (n: number | null | undefined, signo = false) =>
  n == null ? '—' : `${signo && n > 0 ? '+' : ''}${pct.format(n * 100)}%`

/** "74.030,18" -> 74030.18 ; también acepta "74030.18" */
export function parsearMonto(texto: string): number | null {
  const limpio = texto.replace(/[$\s]/g, '')
  if (!limpio) return null
  // Con coma, la coma es decimal. Sin coma, "3.000" o "1.234.567" usan el punto para miles.
  const normal = limpio.includes(',') || /^\d{1,3}(\.\d{3})+$/.test(limpio)
    ? limpio.replace(/\./g, '').replace(',', '.')
    : limpio
  const n = Number(normal)
  return Number.isFinite(n) ? n : null
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export function nombrePeriodo(periodo: string, corto = false) {
  const [a, m] = periodo.split('-').map(Number)
  const mes = MESES[m - 1] ?? '?'
  return corto ? `${mes.slice(0, 3)} ${String(a).slice(2)}` : `${mes} ${a}`
}

export function fechaLarga(iso: string | null) {
  if (!iso) return '—'
  const [a, m, d] = iso.split('-').map(Number)
  return `${d} de ${MESES[m - 1]} de ${a}`
}

export const redondear = (n: number) => Math.round(n * 100) / 100

/** Suma de periodos: sumarMeses('2026-01', -1) === '2025-12' */
export function sumarMeses(periodo: string, delta: number) {
  const [a, m] = periodo.split('-').map(Number)
  const total = a * 12 + (m - 1) + delta
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

export function mesesEntre(desde: string, hasta: string) {
  const [a1, m1] = desde.split('-').map(Number)
  const [a2, m2] = hasta.split('-').map(Number)
  return (a2 - a1) * 12 + (m2 - m1)
}
