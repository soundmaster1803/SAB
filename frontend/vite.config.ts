import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy API and WS requests to the SAB backend during development.
    // The bridge runs on port 7777 by default.
    proxy: {
      '/api': {
        target: 'http://localhost:7777',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Output to ../public so the express server serves it as static.
    outDir: '../public',
    // Clear old build artifacts before each build.
    emptyOutDir: true,
  },
})
