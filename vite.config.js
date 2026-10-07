import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    allowedHosts: [
      'unteeming-uncommiserated-bradly.ngrok-free.dev',
      '.ngrok-free.dev',
      '.ngrok.app'
    ]
  },
  optimizeDeps: {
    force: true
  },
  build: {
    // Optimisation pour PWA
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  },
  publicDir: 'public' // Assure que les fichiers public sont copiés dans dist
})

