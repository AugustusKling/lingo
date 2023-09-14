import { VitePWA } from 'vite-plugin-pwa'

/** @type {import('vite').UserConfig} */
export default {
  build: {
    target: "es2022",
    outDir: "docs"
  },
  base: '/lingo/',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: [
          '**/*.{js,css,html,png,svg,txt}',
          'dist-data/courses/index.json'
        ]
      },
      manifest: {
        name: 'lingo',
        short_name: 'lingo',
        description: 'Vocabulary trainer based on Tatoeba data',
        theme_color: '#ffffff',
        // Fullscreen to work around Firefox showing white area in dark mode instead of dark status bar.
        display: "fullscreen",
        icons: [
          {
            src: 'pwa/logo.svg',
            sizes: '512x512',
            type: 'image/svg+xml'
          },
          {
            src: 'pwa/logo.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
}
