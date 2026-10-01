/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { AJUSTE_ACTIVOS, AJUSTE_NOTIFICADOS, AJUSTE_OCULTOS, avisosANotificar, avisosDeCobro, avisosVisibles, claveAviso, textoAviso } from './lib/avisoCobro'
import type { DatosRecibo } from './lib/types'
import { AJUSTE_INFLACION_NOTIFICADA, AJUSTE_INFLACION_VISTA, avisoInflacion, textoAvisoInflacion } from './lib/avisoInflacion'
import { descargarIpc } from './lib/ipc'

declare const self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
registerRoute(new NavigationRoute(createHandlerBoundToURL(`${import.meta.env.BASE_URL}index.html`)))

// Tipografías de Google Fonts disponibles sin conexión
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({ cacheName: 'fuentes', plugins: [new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 })] }),
)

export const CACHE_COMPARTIDOS = 'compartidos'

// Web Share Target: guarda los archivos compartidos y abre la pantalla de escaneo
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'POST' || !url.pathname.endsWith('/compartir')) return
  event.respondWith(
    (async () => {
      const datos = await event.request.formData()
      const archivos = datos.getAll('archivos').filter((f): f is File => f instanceof File)
      const cache = await caches.open(CACHE_COMPARTIDOS)
      await Promise.all(
        archivos.map((f, i) =>
          cache.put(
            `${import.meta.env.BASE_URL}compartido/${Date.now()}-${i}`,
            new Response(f, { headers: { 'Content-Type': f.type, 'X-Nombre': encodeURIComponent(f.name) } }),
          ),
        ),
      )
      return Response.redirect(`${import.meta.env.BASE_URL}#/escanear?compartido=1`, 303)
    })(),
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

// ---------- Avisos de cobro e inflación en segundo plano (Periodic Background Sync, app instalada) ----------

interface EventoSyncPeriodico extends ExtendableEvent {
  tag: string
}

/** Lectura directa de la base de la app (Dexie usa IndexedDB por debajo) */
function abrirBase(): Promise<IDBDatabase> {
  return new Promise((ok, mal) => {
    const pedido = indexedDB.open('recibos')
    pedido.onsuccess = () => ok(pedido.result)
    pedido.onerror = () => mal(pedido.error)
  })
}

const promesa = <T>(pedido: IDBRequest<T>) =>
  new Promise<T>((ok, mal) => {
    pedido.onsuccess = () => ok(pedido.result)
    pedido.onerror = () => mal(pedido.error)
  })

async function revisarCobrosEnSegundoPlano() {
  const base = await abrirBase()
  try {
    const nombres = Array.from(base.objectStoreNames)
    if (!nombres.includes('recibos') || !nombres.includes('ajustes')) return
    const ajuste = async <T>(clave: string) => ((await promesa(base.transaction('ajustes').objectStore('ajustes').get(clave))) as { valor: T } | undefined)?.valor
    if (!(await ajuste<boolean>(AJUSTE_ACTIVOS))) return

    const hoy = new Date().toLocaleDateString('sv-SE')
    const recibos = (await promesa(base.transaction('recibos').objectStore('recibos').getAll())) as DatosRecibo[]
    const cache = nombres.includes('cache')
      ? ((await promesa(base.transaction('cache').objectStore('cache').get(`feriados-${hoy.slice(0, 4)}`))) as { datos: string[] } | undefined)
      : undefined
    const visibles = avisosVisibles(avisosDeCobro(recibos, hoy, new Set(cache?.datos ?? [])), (await ajuste(AJUSTE_OCULTOS)) ?? {}, hoy)
    const notificados = (await ajuste<Record<string, string>>(AJUSTE_NOTIFICADOS)) ?? {}

    for (const aviso of avisosANotificar(visibles, notificados, hoy)) {
      const { titulo, cuerpo } = textoAviso(aviso)
      await self.registration.showNotification(titulo, {
        body: cuerpo,
        tag: `cobro-${claveAviso(aviso)}`,
        icon: `${import.meta.env.BASE_URL}icon-192.png`,
        data: { url: `${import.meta.env.BASE_URL}#/` },
      })
      notificados[claveAviso(aviso)] = hoy
    }
    await promesa(base.transaction('ajustes', 'readwrite').objectStore('ajustes').put({ clave: AJUSTE_NOTIFICADOS, valor: notificados }))

    // Inflación nueva: solo si la app ya registró qué dato vio la persona
    const notificada = await ajuste<string>(AJUSTE_INFLACION_NOTIFICADA)
    if ((await ajuste<string>(AJUSTE_INFLACION_VISTA)) && notificada) {
      const aviso = avisoInflacion(new Map(await descargarIpc()), recibos, notificada)
      if (aviso) {
        const { titulo, cuerpo } = textoAvisoInflacion(aviso)
        await self.registration.showNotification(titulo, {
          body: cuerpo,
          tag: `inflacion-${aviso.periodo}`,
          icon: `${import.meta.env.BASE_URL}icon-192.png`,
          data: { url: `${import.meta.env.BASE_URL}#/` },
        })
        await promesa(base.transaction('ajustes', 'readwrite').objectStore('ajustes').put({ clave: AJUSTE_INFLACION_NOTIFICADA, valor: aviso.periodo }))
      }
    }
  } finally {
    base.close()
  }
}

self.addEventListener('periodicsync', (evento) => {
  const e = evento as EventoSyncPeriodico
  if (e.tag === 'aviso-cobro') e.waitUntil(revisarCobrosEnSegundoPlano())
})

// Tocar la notificación abre (o trae al frente) la app
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data as { url?: string } | null)?.url ?? import.meta.env.BASE_URL
  event.waitUntil(
    (async () => {
      const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const abierta = ventanas.find((v) => v.url.includes(import.meta.env.BASE_URL))
      if (abierta) {
        await abierta.focus()
        await abierta.navigate(url)
      } else await self.clients.openWindow(url)
    })(),
  )
})
