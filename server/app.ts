import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { aiResponseCache, ocrResultCache } from './cache.js';
import inventoryRouter from './routes/inventory.js';
import ordersRouter from './routes/orders.js';
import aiRouter from './routes/ai.js';

const IS_PROD = process.env.NODE_ENV === 'production';

/**
 * Builds the Express app shared by BOTH deployment targets:
 *   - server/index.ts  → long-running Node process (Render / Docker / Fly)
 *   - api/index.ts     → Vercel serverless function
 *
 * Having one source of truth guarantees the two backends can never drift
 * (previously the Vercel entry was missing inventory/orders entirely).
 */
export function createApp(): Express {
  const app = express();

  // ── Security ────────────────────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
          connectSrc: ["'self'", 'https:', 'wss:'],
        },
      },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003'];

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || !IS_PROD) {
          callback(null, true);
        } else {
          callback(new Error('Blocked by CORS policy'));
        }
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: '10mb' }));

  // ── Rate limiting (per-instance; move to Redis-backed store in Phase 1) ──
  const generalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 250,
    standardHeaders: true,
    legacyHeaders: false,
  });
  const aiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Хэт олон AI хүсэлт илгээгдлээ. 1 минут хүлээгээд дахин оролдоно уу.',
      errorEn: 'Too many AI requests. Please wait 1 minute before retrying.',
    },
  });

  app.use('/api/', generalLimiter);
  app.use('/api/ai/', aiLimiter);

  // ── Routes ──────────────────────────────────────────────────────────────
  app.use('/api/inventory', inventoryRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/ai', aiRouter);

  // ── Health & metrics ────────────────────────────────────────────────────
  app.get('/api/health', (_req, res) => {
    const aiStats = aiResponseCache.stats();
    const ocrStats = ocrResultCache.stats();
    const totalSavedCalls = aiStats.totalCacheHits + ocrStats.totalCacheHits;
    const estimatedSavedUSD = ((totalSavedCalls * 300 * 0.5) / 1_000_000).toFixed(4);

    res.json({
      status: 'ok',
      environment: IS_PROD ? 'production' : 'development',
      uptime: Math.floor(process.uptime()),
      cache: {
        ai: aiStats,
        ocr: ocrStats,
        totalCacheHits: totalSavedCalls,
        estimatedGeminiSavingsUSD: estimatedSavedUSD,
      },
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}
