import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },

  build: {
    outDir: 'dist',
    sourcemap: true,
    // Suppress the chunk size warning — Leaflet + Recharts are large but lazily loaded
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React runtime
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // State management + data fetching
          'vendor-state': ['zustand', '@tanstack/react-query'],
          // Map (Leaflet is ~150kB)
          'vendor-map': ['leaflet', 'react-leaflet'],
          // Charts (Recharts is ~300kB)
          'vendor-charts': ['recharts'],
          // Icons
          'vendor-icons': ['lucide-react'],
          // HTTP client
          'vendor-http': ['axios']
        }
      }
    }
  }
});
