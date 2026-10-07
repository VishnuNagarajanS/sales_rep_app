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
      '/api/chat': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/chat/, '/api'),
      },
      '/socket.io': {
        target: 'http://localhost:4000',
        ws: true,
      },
      '/api': {
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