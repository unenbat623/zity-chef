import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createApp } from './app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3002;
const IS_PROD = process.env.NODE_ENV === 'production';

// ── Environment validation ───────────────────────────────────────────────────
// Anything the app cannot honestly serve without is fatal in production. These
// used to be warnings, so a deployment missing its database credentials booted
// happily and served every visitor the in-memory fallback store: no accounts,
// no catalog, data lost on restart, and nothing in the UI to say so.
const REQUIRED_IN_PROD = [
  ['SUPABASE_URL', 'database, auth and the recipe/store catalog'],
  ['SUPABASE_ANON_KEY', 'public database reads'],
  ['SUPABASE_SERVICE_ROLE_KEY', 'server-side token verification'],
] as const;

if (IS_PROD) {
  const missing = REQUIRED_IN_PROD.filter(([key]) => !process.env[key]);
  if (missing.length) {
    console.error('❌ Refusing to start — required environment variables are missing:');
    for (const [key, why] of missing) console.error(`   • ${key} — needed for ${why}`);
    console.error('   See DEPLOYMENT.md §2 for where each value comes from.');
    process.exit(1);
  }

  // Degraded but serviceable: the feature is off, the rest of the app works.
  const OPTIONAL_IN_PROD = [
    ['GEMINI_API_KEY', 'the AI chef and receipt scanning are disabled'],
    ['ALLOWED_ORIGINS', 'CORS falls back to its development default'],
    ['QPAY_INVOICE_CODE', 'payments run in simulated mode — no money is collected'],
  ] as const;
  for (const [key, effect] of OPTIONAL_IN_PROD) {
    if (!process.env[key]) console.warn(`⚠️  ${key} is not set — ${effect}.`);
  }
}

const app = createApp();

// ── Production static asset serving (SPA) ────────────────────────────────────
if (IS_PROD) {
  const distPath = path.resolve(__dirname, '../dist');

  // Hashed bundles under /assets are immutable — a content change produces a
  // new filename. Without this every chunk was revalidated on every load,
  // which vercel.json already avoided but the Node/Docker path did not.
  app.use(
    '/assets',
    express.static(path.join(distPath, 'assets'), {
      maxAge: '1y',
      immutable: true,
    })
  );
  // Everything else (icons, manifest, sw.js) keeps a short TTL: index.html and
  // the service worker must never be pinned, or clients stick to an old build.
  app.use(express.static(distPath, { maxAge: '1h', index: false }));
  app.get('*', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.resolve(distPath, 'index.html'));
  });
}

// ── Start server ─────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(
    `🚀 Zity Chef Server active on port ${PORT} [ENV: ${IS_PROD ? 'Production' : 'Development'}]`
  );
});

// ── Graceful shutdown ────────────────────────────────────────────────────────
const gracefulShutdown = () => {
  console.log('\n🛑 Shutdown signal received. Closing server gracefully...');
  server.close(() => {
    console.log('✅ Server closed cleanly.');
    process.exit(0);
  });
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
