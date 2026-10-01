import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { activarRespaldoAutomatico } from './lib/respaldoAuto'
import { vigilarCobros } from './lib/avisos'

registerSW({ immediate: true })
activarRespaldoAutomatico()
vigilarCobros()

if (import.meta.env.DEV) {
  // Para probar a mano desde la consola: __db.recibos.toArray()
  import('./lib/db').then(({ db }) => Object.assign(window, { __db: db }))
  import('./lib/fixtures').then((m) => Object.assign(window, { __fixtures: m }))
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
