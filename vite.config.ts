import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],

    // ── Dev proxy: frontend on :3000 → backend on :3002 ─────────────────
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api': {
          target: 'http://localhost:3002',
          changeOrigin: true,
        },
      },
    },

    // ── Code splitting: split vendor chunks to reduce initial load ────────
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-motion': ['motion'],
            'vendor-icons': ['lucide-react'],
          },
        },
      },
      chunkSizeWarningLimit: 300,
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
