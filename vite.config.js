import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      // Allow Vite to serve files from the workspace root as well, but prefer local MICS/src
      allow: [path.resolve(__dirname, '..'), path.resolve(__dirname)]
    }
  },
  resolve: {
    alias: {
      // Resolve '/src' to the MICS local src so imports use MICS/src by default
      '/src': path.resolve(__dirname, 'src')
    }
  }
})
