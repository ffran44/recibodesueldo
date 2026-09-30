import { useSyncExternalStore } from 'react'

// Ruteo por hash: funciona en GitHub Pages sin configurar el servidor
const suscribir = (cb: () => void) => {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

export function useRuta() {
  const hash = useSyncExternalStore(suscribir, () => window.location.hash)
  const [camino, consulta = ''] = hash.replace(/^#/, '').split('?')
  return { partes: camino.split('/').filter(Boolean), consulta: new URLSearchParams(consulta) }
}

export const navegar = (ruta: string) => {
  window.location.hash = ruta
}
