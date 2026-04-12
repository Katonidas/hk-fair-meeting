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
      manifest: {
        name: 'HK Fair Meeting - APPROX',
        short_name: 'HK Fair',
        description: 'Gestión de reuniones en HK Sources Fair',
        theme_color: '#1e3a5f',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
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
        // skipWaiting + clientsClaim → el SW nuevo toma control inmediato
        // sin esperar a cerrar todas las pestañas. Imprescindible en una
        // PWA instalada en el móvil porque si no, los usuarios pueden
        // quedarse bloqueados en una versión antigua para siempre.
        skipWaiting: true,
        clientsClaim: true,
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
  define: {
    // Timestamp inyectado en build time. Cada `npm run build` / `vercel --prod`
    // genera un valor distinto. Se usa como versión automática: el primer
    // dispositivo que carga el deploy nuevo actualiza Supabase, y los demás
    // dispositivos con timestamp más viejo quedan bloqueados.
    '__APP_BUILD_TS__': JSON.stringify(Date.now().toString()),
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
