import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/**'],
      workbox: {
        // Cache all app shell assets
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Network-first for navigations (always get latest HTML if online)
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            // Cache all same-origin requests (JS chunks, assets)
            urlPattern: ({ request }) =>
              request.destination === 'script' ||
              request.destination === 'style' ||
              request.destination === 'image' ||
              request.destination === 'font',
            handler: 'CacheFirst',
            options: {
              cacheName: 'assets-cache',
              expiration: { maxAgeSeconds: 60 * 60 * 24 * 30 }, // 30 days
            },
          },
        ],
      },
      manifest: {
        name: 'Shadow Ops',
        short_name: 'Shadow Ops',
        description: 'Covert agency management game',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: '/icons/icon-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
          },
          {
            src: '/icons/icon-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
          {
            src: '/icons/apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
});
