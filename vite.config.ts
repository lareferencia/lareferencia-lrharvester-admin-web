import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api/v5': {
        target: process.env.VITE_HARVESTER_ORIGIN || 'http://localhost:8090',
        changeOrigin: true,
        // The browser talks to Vite on the same origin. Do not forward its
        // Origin header to Spring, otherwise the local proxy is misclassified
        // as a cross-origin POST and v5 correctly rejects it under its strict
        // CORS policy.
        configure: proxy => proxy.on('proxyReq', request => request.removeHeader('origin')),
      },
    },
  },
  test: { environment: 'jsdom', setupFiles: './tests/setup.ts' },
})
