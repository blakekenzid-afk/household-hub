import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/household-hub/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'push-sw.js'],
      // Layer our push/notificationclick handlers onto the generated SW.
      workbox: {
        importScripts: ['push-sw.js'],
      },
      manifest: {
        name: 'Household Hub',
        short_name: 'Household Hub',
        description:
          'Your household, organized — brain dump, tasks, notes, meals & shopping.',
        theme_color: '#F2F2F7',
        background_color: '#F2F2F7',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
})
