import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Ratelimit } from '@upstash/ratelimit';
import { aiResponseCache, ocrResultCache, redisClient, cacheBackend } from './cache.js';
import { isSupabaseConfigured, supabasePublic } from './supabase.js';
import inventoryRouter from './routes/inventory.js';
import ordersRouter from './routes/orders.js';
import aiRouter from './routes/ai.js';
import communityRouter from './routes/community.js';
import paymentsRouter from './routes/payments.js';
import storeRouter from './routes/store.js';
import pushRouter from './routes/push.js';
import recipesRouter from './routes/recipes.js';
import chefRouter from './routes/chef.js';
import loyaltyRouter from './routes/loyalty.js';
import odooRouter from './routes/odoo.js';

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
  return rateLimit({
    windowMs: 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message,
  });
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

  // Behind a load balancer / CDN (Render, Vercel, Cloudflare) req.ip is the
  // proxy's address unless the X-Forwarded-For chain is trusted. Without this,
  // every visitor shares one rate-limit bucket — and express-rate-limit v8
  // refuses the configuration outright.
  app.set('trust proxy', 1);

  // ── Security ────────────────────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          // No 'unsafe-inline': the theme bootstrap and the service-worker
          // registration were moved out of index.html, so nothing inline is
          // left to allow — which is what makes this CSP worth having.
          scriptSrc: ["'self'"],
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
    : [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
        'http://localhost:3003',
      ];

  // Scoped to the API on purpose. Applied globally, a request carrying an
  // Origin header this list does not know was rejected before it ever reached
  // the static handlers — so a deployment whose ALLOWED_ORIGINS did not happen
  // to include its own address served 403 for its own index.html, stylesheet
  // and every chunk, and the app rendered as a blank page. Serving the app
  // shell is not a cross-origin concern; calling the API is.
  app.use(
    '/api',
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || !IS_PROD) {
          callback(null, true);
        } else {
          callback(new Error('Blocked by CORS policy'));
        }
      },
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Guest-Id'],
    })
  );

  // JSON responses (the catalog, a recipe, a feed page) compress to a fraction
  // of their size, which is the difference between a snappy and a sluggish app
  // on a Mongolian mobile connection. A CDN in front would do this too, but the
  // single-service deployments (Render, Docker, Fly) have nothing in front.
  app.use(compression());

  // Only the OCR endpoint receives bytes — it takes a base64 image. Everything
  // else exchanges small JSON: community posts carry an image *URL*, because the
  // client uploads to Supabase Storage directly. A 10mb ceiling on every route
  // was free memory pressure for any unauthenticated caller, so the large limit
  // is mounted on the one path that needs it. body-parser skips a request whose
  // body is already parsed, so the general parser below leaves OCR alone.
  app.use('/api/ai/ocr', express.json({ limit: '10mb' }));
  app.use(express.json({ limit: '256kb' }));

  // ── Rate limiting (Redis-backed when configured, else per-instance) ──────
  app.use('/api/', makeLimiter(250, 'general'));
  app.use(
    '/api/ai/',
    makeLimiter(30, 'ai', {
      error: 'Хэт олон AI хүсэлт илгээгдлээ. 1 минут хүлээгээд дахин оролдоно уу.',
      errorEn: 'Too many AI requests. Please wait 1 minute before retrying.',
    })
  );
  // Creating an invoice calls QPay and mints a real payment object, so it gets
  // the tightest bucket of all — a loop here is abuse of QPay, not just of us.
  app.use(
    '/api/payments/qpay/create',
    makeLimiter(20, 'payments-create', {
      error: 'Хэт олон төлбөрийн хүсэлт. 1 минут хүлээгээд дахин оролдоно уу.',
      errorEn: 'Too many payment requests. Please wait 1 minute before retrying.',
    })
  );
  // The rest of /api/payments, including the public QPay callback. The callback
  // takes no auth and makes an outbound QPay call per hit, so leaving it on the
  // general 250 bucket made it an amplifier. This still sits far above the rate
  // QPay itself calls at, and a dropped callback is recoverable — the client's
  // /qpay/check poll settles the invoice either way.
  app.use(
    '/api/payments/',
    makeLimiter(90, 'payments', {
      error: 'Хэт олон төлбөрийн хүсэлт. 1 минут хүлээгээд дахин оролдоно уу.',
      errorEn: 'Too many payment requests. Please wait 1 minute before retrying.',
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
  app.use('/api/recipes', recipesRouter);
  app.use('/api/chef', chefRouter);
  app.use('/api/loyalty', loyaltyRouter);
  app.use('/api/odoo', odooRouter);

  // ── Health & metrics ────────────────────────────────────────────────────
  // Public, so it stays a plain liveness signal in production. The cache and
  // spend figures are operational detail and are only attached in development —
  // an unauthenticated endpoint should not report what the app costs to run.
  app.get('/api/health', (_req, res) => {
    if (IS_PROD) {
      return res.json({ status: 'ok', timestamp: new Date().toISOString() });
    }

    const aiStats = aiResponseCache.stats();
    const ocrStats = ocrResultCache.stats();
    const totalSavedCalls = aiStats.totalCacheHits + ocrStats.totalCacheHits;
    const estimatedSavedUSD = ((totalSavedCalls * 300 * 0.5) / 1_000_000).toFixed(4);

    res.json({
      status: 'ok',
      environment: 'development',
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

  // Readiness probe — verifies the DB is reachable (for orchestrators / LBs).
  app.get('/api/ready', async (_req, res) => {
    if (!isSupabaseConfigured || !supabasePublic) {
      return res.json({ ready: true, db: 'not-configured' });
    }
    try {
      const { error } = await supabasePublic.from('store_products').select('id').limit(1);
      return res.status(error ? 503 : 200).json({ ready: !error, db: error ? 'error' : 'ok' });
    } catch {
      return res.status(503).json({ ready: false, db: 'error' });
    }
  });

  // 404 for unknown API routes (must come after all /api routers).
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  // Central error handler — consistent JSON, never leaks stack traces in prod.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    // A blocked origin is the caller's problem, not a server fault; it used to
    // surface as a 500 and get logged as an unhandled error.
    if (err instanceof Error && err.message === 'Blocked by CORS policy') {
      return res.status(403).json({ error: 'CORS_ORIGIN_NOT_ALLOWED' });
    }
    // Errors that already carry a 4xx are the caller's, not ours. body-parser
    // throws `entity.too.large` with status 413 and malformed JSON with 400;
    // flattening both to 500 told the client the server had broken when it had
    // in fact rejected their request on purpose — and buried each one in the
    // logs as an unhandled fault.
    const status =
      (err as { status?: number; statusCode?: number } | null)?.status ??
      (err as { statusCode?: number } | null)?.statusCode;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      const code = (err as { type?: string } | null)?.type;
      return res.status(status).json({
        error:
          code === 'entity.too.large'
            ? 'PAYLOAD_TOO_LARGE'
            : code === 'entity.parse.failed'
              ? 'INVALID_JSON'
              : 'BAD_REQUEST',
      });
    }

    console.error('[Unhandled error]', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({ error: IS_PROD ? 'Internal server error' : message });
  });

  return app;
}
