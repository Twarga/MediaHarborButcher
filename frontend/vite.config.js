import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In dev (`npm run dev`), Vite proxies API paths to FastAPI on :8000.
// In production, FastAPI serves the built frontend on the same origin,
// so these proxy rules don't run.
const backend = { target: 'http://localhost:8000', changeOrigin: true }

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/health': backend,
      '/settings': backend,
      '/scan': backend,
      '/download': backend,
      '/history': backend,
      '/open-folder': backend,
    },
  },
})
