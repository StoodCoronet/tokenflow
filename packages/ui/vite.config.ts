import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 40002,
    proxy: {
      '/api': 'http://0.0.0.0:40001',
      '/v1': 'http://0.0.0.0:40001',
    },
  },
})
