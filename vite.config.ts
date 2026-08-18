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
      // Sentry cannot un-minify a stack trace without these. `hidden` emits the
      // .map files but omits the sourceMappingURL comment, so they are uploaded
      // to Sentry at deploy time rather than exposed to every visitor.
      sourcemap: 'hidden' as const,
      rollupOptions: {
        output: {
          /**
           * Split vendors by resolved module path rather than by package name.
           *
           * The previous object form (`{'vendor-react': ['react','react-dom']}`)
           * only matched those exact entry specifiers, so the deep imports the
           * app actually uses — `react-dom/client`, the JSX runtime, and every
           * transitive dependency of Supabase and React Query — all fell
           * through into the single entry chunk. That is how a ~1 MB `index`
           * chunk sat next to a 9 kB "vendor-react".
           */
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return undefined;
            const path = id.split('node_modules/').pop() ?? '';

            if (/^(react|react-dom|scheduler)\//.test(path)) return 'vendor-react';
            if (path.startsWith('motion') || path.startsWith('framer-motion')) return 'vendor-motion';
            if (path.startsWith('lucide-react')) return 'vendor-icons';
            if (path.startsWith('@supabase')) return 'vendor-supabase';
            if (path.startsWith('@tanstack')) return 'vendor-query';
            // Everything else third-party shares one cacheable chunk.
            return 'vendor';
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
