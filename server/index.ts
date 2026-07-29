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
if (IS_PROD && !process.env.GEMINI_API_KEY) {
  console.warn('⚠️ WARNING: GEMINI_API_KEY is not set in production environment variables.');
}
if (IS_PROD && !process.env.SUPABASE_URL) {
  console.warn(
    '⚠️ WARNING: SUPABASE_URL is not set — inventory/orders will use the in-memory ' +
      'fallback store (data is lost on restart and NOT isolated across instances).'
  );
}

const app = createApp();

// ── Production static asset serving (SPA) ────────────────────────────────────
if (IS_PROD) {
  const distPath = path.resolve(__dirname, '../dist');
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
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
