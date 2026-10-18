import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Em desenvolvimento, o Vite encaminha a API para o backend local.
      '/api': { target: 'http://localhost:4000', changeOrigin: false },
      '/healthz': { target: 'http://localhost:4000', changeOrigin: false },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
});
