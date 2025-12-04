import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  
  // 🔥 KHỐI BUILD (Cần cho Vercel/Production)
  build: {
    outDir: 'dist', 
    rollupOptions: {
      external: [
        'i18next-browser-languagedetector', 
        'i18next-http-backend' 
      ],
    },
  },
  
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000', 
        changeOrigin: true, 
        secure: false,
      },
      '/socket.io': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
        ws: true 
      }
    }
  }
});