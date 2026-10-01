/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Publicado en GitHub Pages: https://ffran44.github.io/recibodesueldo/
const base = '/recibodesueldo/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      // El lector de PDF pesa 1,2 MB: se descarga recién la primera vez que cargás un PDF
      injectManifest: { globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'], globIgnores: ['**/pdf.worker*'] },
      manifest: {
        name: 'Mis recibos de sueldo',
        short_name: 'Recibos',
        description: 'Escaneá, auditá y seguí tus recibos de sueldo.',
        lang: 'es-AR',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#110e24',
        theme_color: '#110e24',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Permite "Compartir" una foto o PDF desde WhatsApp/Galería directo a la app (Android)
        share_target: {
          action: `${base}compartir`,
          method: 'POST',
          enctype: 'multipart/form-data',
          params: { files: [{ name: 'archivos', accept: ['image/*', 'application/pdf'] }] },
        },
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
