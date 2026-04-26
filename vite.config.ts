import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const isTauri = process.env.TAURI_ENV_PLATFORM !== undefined

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // Tauri espera un puerto fijo y no quiere que Vite borre la pantalla
  clearScreen: false,
  server: {
    host: true,
    port: 3001,
    strictPort: true,   // Tauri necesita el puerto exacto
    allowedHosts: true,
    // En modo Tauri dev, el frontend llama directo al VPS → no necesita proxy
    proxy: isTauri ? {} : {
      '/api': {
        target: 'https://pruebasremota.somee.com',
        changeOrigin: true,
      },
    },
  },
  // Tauri targets ES2021+
  build: {
    target: isTauri ? ['es2021', 'chrome105', 'safari15'] : 'modules',
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
})
