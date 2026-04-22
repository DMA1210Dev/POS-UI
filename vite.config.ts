import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host: true,
    port: 3001,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'https://pruebasremota.somee.com',
        changeOrigin: true,
      },
    },
  },
})
