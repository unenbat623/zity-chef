import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => {
  // Vite reads NODE_ENV out of the .env file it loads for VITE_* variables —
  // and this project's .env carries the *server's* NODE_ENV. With
  // `NODE_ENV=development` in there, `vite build` stamped the bundle as
  // development: `import.meta.env.PROD` was false, so the client aimed every
  // API call at `<host>:3002` instead of its own origin, and React shipped in
  // its development build (twice the size and slower). A build is a production
  // build, whoever invokes it.
  // Setting process.env here is not enough: Vite loads the env file *after*
  // this callback and lets its NODE_ENV win. The values are pinned through
  // `define` below instead, which is a plain compile-time substitution nothing
  // can override.
  const isBuild = command === 'build';

  return {
    root: './client',
    // .env lives at the project root, but Vite's root is ./client — point the
    // env loader back at the project root so VITE_* vars are picked up.
    //
    // That same file carries the *server's* NODE_ENV, which Vite reads as the
    // build's own mode: with `NODE_ENV=development` in .env, `vite build`
    // produced a bundle stamped as development, so `import.meta.env.PROD` was
    // false and the client aimed every API call at `:3002` on the current host
    // instead of the same origin it was served from. `npm run build` pins
    // NODE_ENV=production for exactly this reason — build through the script,
    // not by calling `vite build` directly.
    envDir: __dirname,
    plugins: [react(), tailwindcss()],

    // A build is a production build, whoever invokes it and whatever the .env
    // says. Without this, React shipped in its development build and
    // `import.meta.env.PROD` was false — which sent every API call to
    // `<host>:3002` instead of the origin the app was served from.
    define: isBuild
      ? {
          'process.env.NODE_ENV': JSON.stringify('production'),
          'import.meta.env.MODE': JSON.stringify('production'),
          'import.meta.env.PROD': 'true',
          'import.meta.env.DEV': 'false',
        }
      : {},

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
      // jsdom rather than node: the client half of this app had no way to be
      // tested at all — a hook or component test could not even mount. Server
      // tests are indifferent to which environment they run in.
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}', '../server/**/*.test.ts'],
    },
  };
});
