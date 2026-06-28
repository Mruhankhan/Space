import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'))

export default defineConfig({
  base: '/',
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version || '0.0.0'),
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname, '..'), path.resolve(__dirname)],
    },
  },
  resolve: {
    alias: {
      '/src': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    // Force separate file output for audio / 3D assets.
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        // Vite 8 / rolldown only accepts the function form of manualChunks.
        // Route three's core + loaders + exporter into one chunk, and
        // react + react-dom into another.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (
            id.includes('/three/') ||
            id.includes('/three/examples/')
          ) return 'three'
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/scheduler/')
          ) return 'react'
          return undefined
        },
      },
    },
  },
  optimizeDeps: {
    include: ['three'],
    exclude: ['three/examples/jsm/loaders/DRACOLoader.js'],
  },
})