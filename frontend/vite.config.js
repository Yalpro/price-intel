import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  envDir: '../',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true
      },
      manifest: {
        name: 'Anaprice — Wholesale Price Intelligence',
        short_name: 'Anaprice',
        description: 'Compare wholesale prices and find better buying opportunities for independent UK retailers.',
        theme_color: '#0A0E0C',
        background_color: '#0A0E0C',
        display: 'standalone',
        icons: [
          {
            src: '/brand/anaprice-logo.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/brand/anaprice-logo.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
})
