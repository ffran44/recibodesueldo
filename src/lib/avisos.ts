import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  AJUSTE_ACTIVOS,
  AJUSTE_NOTIFICADOS,
  AJUSTE_OCULTOS,
  avisosANotificar,
  avisosDeCobro,
  avisosVisibles,
  claveAviso,
  textoAviso,
  type AvisoCobro,
} from './avisoCobro'
import { guardarAjuste, leerAjuste, recibosOrdenados } from './db'
import { cargarFeriados } from './econ'

/** Fecha local YYYY-MM-DD (a la noche, la fecha UTC ya es la del día siguiente) */
export const hoyLocal = () => new Date().toLocaleDateString('sv-SE')

const sumarDias = (iso: string, n: number) => new Date(Date.parse(iso) + n * 86_400_000).toISOString().slice(0, 10)

async function feriadosDelAnio(hoy: string) {
  try {
    return await cargarFeriados(Number(hoy.slice(0, 4)))
  } catch {
    // Sin conexión ni caché: se calcula solo con fines de semana
    return new Set<string>()
  }
}

export function useAvisosCobro(): AvisoCobro[] {
  const recibos = useLiveQuery(recibosOrdenados, [])
  const ocultos = useLiveQuery(async () => (await leerAjuste<Record<string, string>>(AJUSTE_OCULTOS)) ?? {}, [])
  const [feriados, setFeriados] = useState<Set<string> | null>(null)
  const hoy = hoyLocal()

  useEffect(() => {
    let vivo = true
    feriadosDelAnio(hoy).then((f) => vivo && setFeriados(f))
    return () => {
      vivo = false
    }
  }, [hoy])

  if (!recibos || !ocultos || !feriados) return []
  return avisosVisibles(avisosDeCobro(recibos, hoy, feriados), ocultos, hoy)
}

/** "Ya cobré" oculta el aviso de ese mes; "más tarde" lo pospone unos días */
export async function ocultarAviso(aviso: AvisoCobro, dias?: number) {
  const ocultos = (await leerAjuste<Record<string, string>>(AJUSTE_OCULTOS)) ?? {}
  ocultos[claveAviso(aviso)] = dias ? sumarDias(hoyLocal(), dias - 1) : '9999-12-31'
  await guardarAjuste(AJUSTE_OCULTOS, ocultos)
}

// ---------- Notificaciones de Windows ----------

export const notificacionesSoportadas = typeof window !== 'undefined' && 'Notification' in window

export const useAvisosActivos = () => useLiveQuery(async () => (await leerAjuste<boolean>(AJUSTE_ACTIVOS)) ?? false, [])

type RegistroConSync = ServiceWorkerRegistration & {
  periodicSync?: { register(tag: string, opciones: { minInterval: number }): Promise<void>; unregister(tag: string): Promise<void> }
}

export async function activarNotificaciones() {
  const permiso = await Notification.requestPermission()
  if (permiso !== 'granted') throw new Error('El navegador no dio permiso para mostrar notificaciones. Podés habilitarlo desde el candado de la barra de direcciones.')
  await guardarAjuste(AJUSTE_ACTIVOS, true)
  // Si la app está instalada, el navegador puede revisar en segundo plano (lo decide Chrome/Edge)
  try {
    const registro = (await navigator.serviceWorker?.ready) as RegistroConSync | undefined
    await registro?.periodicSync?.register('aviso-cobro', { minInterval: 12 * 3600_000 })
  } catch {
    // No disponible: los avisos llegan cuando la app está abierta
  }
  await revisarYNotificar()
}

export async function desactivarNotificaciones() {
  await guardarAjuste(AJUSTE_ACTIVOS, false)
  try {
    const registro = (await navigator.serviceWorker?.ready) as RegistroConSync | undefined
    await registro?.periodicSync?.unregister('aviso-cobro')
  } catch {
    // Nada para desregistrar
  }
}

export async function revisarYNotificar() {
  if (!notificacionesSoportadas || Notification.permission !== 'granted' || !(await leerAjuste<boolean>(AJUSTE_ACTIVOS))) return
  const hoy = hoyLocal()
  const visibles = avisosVisibles(avisosDeCobro(await recibosOrdenados(), hoy, await feriadosDelAnio(hoy)), (await leerAjuste(AJUSTE_OCULTOS)) ?? {}, hoy)
  const notificados = (await leerAjuste<Record<string, string>>(AJUSTE_NOTIFICADOS)) ?? {}
  const pendientes = avisosANotificar(visibles, notificados, hoy)
  if (!pendientes.length) return

  const registro = await navigator.serviceWorker?.getRegistration()
  for (const aviso of pendientes) {
    const { titulo, cuerpo } = textoAviso(aviso)
    const opciones = { body: cuerpo, tag: `cobro-${claveAviso(aviso)}`, icon: `${import.meta.env.BASE_URL}icon-192.png`, data: { url: `${import.meta.env.BASE_URL}#/` } }
    if (registro) await registro.showNotification(titulo, opciones)
    else new Notification(titulo, opciones)
    notificados[claveAviso(aviso)] = hoy
  }
  await guardarAjuste(AJUSTE_NOTIFICADOS, notificados)
}

/** Con la app abierta: revisa al abrir, al volver a la pestaña y cada hora */
export function vigilarCobros() {
  const revisar = () => void revisarYNotificar().catch(() => {})
  revisar()
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && revisar())
  setInterval(revisar, 3600_000)
}
