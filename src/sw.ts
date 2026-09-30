/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

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
