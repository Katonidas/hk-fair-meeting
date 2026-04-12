import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      // Forzar que el SW nuevo tome control inmediato y limpie cachés
      // viejas. Sin esto, los usuarios pueden quedarse atascados en una
      // versión cacheada con bugs ya arreglados (ej. el botón de email
      // que no marcaba la reunión como enviada).
      injectRegister: 'auto',
      manifest: {
        name: 'HK Fair Meeting - APPROX',
        short_name: 'HK Fair',
        description: 'Gestión de reuniones en HK Sources Fair',
        theme_color: '#1e3a5f',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'any',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // skipWaiting + clientsClaim → el SW nuevo se activa de inmediato
        // sin esperar a que el usuario cierre todas las pestañas.
        skipWaiting: true,
        clientsClaim: true,
        // Limpia cachés de versiones anteriores al activarse.
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/glutewwayemuftmjvbcs\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
