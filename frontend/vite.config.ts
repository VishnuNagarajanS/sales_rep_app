import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['rocky-irritant-pointless.ngrok-free.dev'],
    watch: {
      usePolling: true,
      interval: 300,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5106',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:5106',
        changeOrigin: true,
      },
      '/hubs': {
        target: 'http://localhost:5106',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})