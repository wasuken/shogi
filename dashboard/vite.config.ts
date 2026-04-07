import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://server:3000', // This will be 'http://localhost:3000' if running server locally, or 'http://server:3000' in docker-compose network
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api'), // Keep the /api prefix for the backend
      },
    },
  },
})
