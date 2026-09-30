const CLAVE = 'recibos.apiKey'
const MODELO = 'recibos.modelo'

export const MODELOS = [
  { id: 'claude-opus-5-5', nombre: 'Claude Opus 5.5 (más preciso)' },
  { id: 'claude-sonnet-5-5', nombre: 'Claude Sonnet 5.5 (más barato)' },
] as const

function leer(clave: string) {
  try {
    return localStorage.getItem(clave)
  } catch {
    return null
  }
}

function escribir(clave: string, valor: string | null) {
  try {
    if (valor) localStorage.setItem(clave, valor)
    else localStorage.removeItem(clave)
  } catch {
    // Almacenamiento bloqueado: la clave dura solo esta sesión
  }
}

export const obtenerApiKey = () => leer(CLAVE)
export const guardarApiKey = (k: string | null) => escribir(CLAVE, k?.trim() || null)
export const obtenerModelo = () => leer(MODELO) ?? MODELOS[0].id
export const guardarModelo = (m: string) => escribir(MODELO, m)
