import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Ratelimit } from '@upstash/ratelimit';
import { aiResponseCache, ocrResultCache, redisClient, cacheBackend } from './cache.js';
import inventoryRouter from './routes/inventory.js';
import ordersRouter from './routes/orders.js';
import aiRouter from './routes/ai.js';
import communityRouter from './routes/community.js';
import paymentsRouter from './routes/payments.js';
import storeRouter from './routes/store.js';
import pushRouter from './routes/push.js';

const IS_PROD = process.env.NODE_ENV === 'production';

/**
 * Builds a rate-limit middleware. Uses Upstash Redis (shared across instances)
 * when configured, otherwise falls back to per-instance in-memory limiting.
 */
function makeLimiter(max: number, prefix: string, message?: object) {
  if (redisClient) {
    const rl = new Ratelimit({
      redis: redisClient,
      limiter: Ratelimit.slidingWindow(max, '60 s'),
      prefix: `ratelimit:${prefix}`,
      analytics: false,
    });
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const id = req.ip || req.headers['x-forwarded-for']?.toString() || 'anon';
        const { success } = await rl.limit(id);
        if (!success) return res.status(429).json(message || { error: 'Too many requests' });
        return next();
      } catch {
        // If Redis is unreachable, fail open rather than blocking all traffic.
        return next();
      }
    };
  }
  return rateLimit({ windowMs: 60 * 1000, max, standardHeaders: true, legacyHeaders: false, message });
}

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

  // ── Rate limiting (Redis-backed when configured, else per-instance) ──────
  app.use('/api/', makeLimiter(250, 'general'));
  app.use(
    '/api/ai/',
    makeLimiter(30, 'ai', {
      error: 'Хэт олон AI хүсэлт илгээгдлээ. 1 минут хүлээгээд дахин оролдоно уу.',
      errorEn: 'Too many AI requests. Please wait 1 minute before retrying.',
    })
  );

  // ── Routes ──────────────────────────────────────────────────────────────
  app.use('/api/inventory', inventoryRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/community', communityRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/store', storeRouter);
  app.use('/api/push', pushRouter);

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
        backend: cacheBackend,
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
