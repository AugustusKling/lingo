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
        icons: [
          {
            src: 'pwa/logo.svg',
            sizes: '512x512',
            type: 'image/svg+xml'
          }
        ]
      }
    })
  ]
}
