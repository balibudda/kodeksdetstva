import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Standalone project. No shared code or config with any other repo.
// Web build (dist/) is offline-first and later wrapped into APK / iOS with
// Capacitor — assets bundled into the app, no server.url, so it never reads
// as "just a website".
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'robots.txt'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,json}'],
        navigateFallback: '/index.html',
      },
      manifest: {
        name: 'Дитя Бога — родителям о правах ребёнка',
        short_name: 'Дитя Бога',
        description:
          'Родителям: права ребёнка простым языком, защита от насилия и травли, осознанные решения о здоровье, помощь в кризисах подростка.',
        lang: 'ru',
        theme_color: '#3a6b5f',
        background_color: '#faf7f0',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
