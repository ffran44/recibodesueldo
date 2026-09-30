export type Proveedor = 'gemini' | 'claude'

export const PROVEEDORES: Record<Proveedor, { nombre: string; detalle: string; consola: string; modelos: { id: string; nombre: string }[] }> = {
  gemini: {
    nombre: 'Gemini (gratis)',
    detalle: 'Plan gratuito de Google AI Studio. Google puede usar lo que se envía para mejorar sus productos: por eso solo se manda el texto, sin tus datos personales.',
    consola: 'https://aistudio.google.com/apikey',
    modelos: [
      { id: 'gemini-3.8-flash', nombre: 'Gemini 3.8 Flash' },
      { id: 'gemini-3.5-flash-lite', nombre: 'Gemini 3.5 Flash-Lite (más rápido)' },
    ],
  },
  claude: {
    nombre: 'Claude (pago)',
    detalle: 'API de Anthropic, se cobra por uso (centavos de dólar por recibo). No usa lo enviado para entrenar.',
    consola: 'https://console.anthropic.com/settings/keys',
    modelos: [
      { id: 'claude-opus-5-5', nombre: 'Claude Opus 5.5 (más preciso)' },
      { id: 'claude-sonnet-5-5', nombre: 'Claude Sonnet 5.5 (más barato)' },
    ],
  },
}

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
    // Almacenamiento bloqueado: el ajuste dura solo esta sesión
  }
}

export const obtenerProveedor = (): Proveedor => (leer('recibos.proveedor') === 'claude' ? 'claude' : 'gemini')
export const guardarProveedor = (p: Proveedor) => escribir('recibos.proveedor', p)

export const obtenerApiKey = (p: Proveedor = obtenerProveedor()) => leer(p === 'claude' ? 'recibos.apiKey' : `recibos.apiKey.${p}`)
export const guardarApiKey = (p: Proveedor, k: string | null) => escribir(p === 'claude' ? 'recibos.apiKey' : `recibos.apiKey.${p}`, k?.trim() || null)

export const obtenerModelo = (p: Proveedor = obtenerProveedor()) => {
  const guardado = leer(`recibos.modelo.${p}`)
  return PROVEEDORES[p].modelos.some((m) => m.id === guardado) ? guardado! : PROVEEDORES[p].modelos[0].id
}
export const guardarModelo = (p: Proveedor, m: string) => escribir(`recibos.modelo.${p}`, m)

/** Tu nombre, para ocultarlo del texto aunque el OCR lo lea con errores */
export const obtenerNombrePropio = () => leer('recibos.nombrePropio') ?? ''
export const guardarNombrePropio = (n: string) => escribir('recibos.nombrePropio', n.trim() || null)
