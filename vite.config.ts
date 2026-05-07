import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'FRC Scouting App',
        short_name: 'Scout',
        description: 'FRC scouting app for Team 2928',
        theme_color: '#1e40af',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.statbotics\.io\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'statbotics-cache', expiration: { maxAgeSeconds: 3600 } },
          },
          {
            urlPattern: /^https:\/\/www\.thebluealliance\.com\/api\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'tba-cache', expiration: { maxAgeSeconds: 3600 } },
          },
        ],
      },
    }),
  ],
})
