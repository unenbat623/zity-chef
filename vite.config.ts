import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    root: './client',
    // .env lives at the project root, but Vite's root is ./client — point the
    // env loader back at the project root so VITE_* vars are picked up.
    envDir: __dirname,
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
      outDir: '../dist',
      emptyOutDir: true,
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
        '@': path.resolve(__dirname, './client/src'),
      },
    },

    test: {
      globals: true,
      environment: 'node',
      include: ['src/**/*.test.{ts,tsx}', '../server/**/*.test.ts'],
    },
  };
});
