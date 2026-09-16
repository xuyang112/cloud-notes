import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/three/')) return 'three-vendor'
        },
      },
    },
  },
  server: {
    host: '127.0.0.1',
    watch: { ignored: ['**/.local/**', '**/test-results/**', '**/playwright-report/**', '**/*.tsbuildinfo'] },
  },
})
