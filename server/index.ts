import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { aiResponseCache, ocrResultCache } from './cache.js';
import inventoryRouter from './routes/inventory.js';
import ordersRouter from './routes/orders.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3002;
const IS_PROD = process.env.NODE_ENV === 'production';

// ── Environment security validation ─────────────────────────────────────────
if (IS_PROD && !process.env.GEMINI_API_KEY) {
  console.warn('⚠️ WARNING: GEMINI_API_KEY is not set in production environment variables.');
}

// ── Security Middleware ──────────────────────────────────────────────────────
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
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003'];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or same-origin)
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

// ── Rate Limiting (DDoS & Brute-force protection) ───────────────────────────
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

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 250,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', generalLimiter);
app.use('/api/ai/', aiLimiter);

// API Routes
app.use('/api/inventory', inventoryRouter);
app.use('/api/orders', ordersRouter);

// ── Gemini AI Client (Server-side key isolation) ──────────────────────────────
const apiKey = process.env.GEMINI_API_KEY || 'demo-placeholder-key';
const ai = new GoogleGenAI({ apiKey });

// ── In-flight Request Deduplication ──────────────────────────────────────────
const inflight = new Map<string, Promise<string>>();

function makeContextKey(message: string, inventoryContext: string, lang: string): string {
  const normalized = `${lang}|${inventoryContext.toLowerCase().trim()}|${message.toLowerCase().trim()}`;
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}

// ── AI Chat Endpoint ─────────────────────────────────────────────────────────
app.post('/api/ai/chat', async (req, res) => {
  const { message, inventoryContext = '', lang = 'mn' } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message is required' });
  }

  const cacheKey = makeContextKey(message, inventoryContext, lang);

  // 1️⃣ Cache hit → 0 cost, 0ms response
  const cached = aiResponseCache.get(cacheKey);
  if (cached) {
    return res.json({ text: cached, fromCache: true });
  }

  // 2️⃣ In-flight deduplication
  if (inflight.has(cacheKey)) {
    try {
      const text = await inflight.get(cacheKey)!;
      return res.json({ text, fromCache: true });
    } catch {
      return res.status(500).json({ error: 'AI request processing failed' });
    }
  }

  // 3️⃣ Call Gemini API
  const systemInstruction = `
    Та бол "Zity Chef" апп-ын ухаалаг туслах "Найрсаг Эгч" юм.
    Хэрэглэгчийн хөргөгчинд байгаа материалууд: ${inventoryContext}
    Хэрэглэгчийн хэл: ${lang === 'mn' ? 'Монгол' : 'English'}

    ДҮРЭМ:
    1. Хэрэглэгчтэй "${lang === 'mn' ? 'Дүү минь' : 'dear'}" гэж дотноор харилцана.
    2. Хэрэглэгч хоол сонговол хариултын төгсгөлд [ACTION: OPEN_COOKING_MODE, RECIPE_ID: 'id'] бич.
    3. Хоолны жорыг санал болгохдоо 3 хоол санал болго.
    4. Хариултаа товч, найрсаг байлга.
  `;

  const geminiCall = ai.models
    .generateContent({
      model: 'gemini-3-flash-preview',
      contents: message,
      config: { systemInstruction },
    })
    .then((r) => r.text || '')
    .catch(() => {
      return lang === 'mn'
        ? 'Сайн байна уу дүү минь! Өнөөдөр ямар хоол хийж идэх вэ? Эгч нь туслахад бэлэн байна. ✨'
        : 'Hello dear! What would you like to cook today? I am ready to help. ✨';
    });

  inflight.set(cacheKey, geminiCall);

  try {
    const text = await geminiCall;
    aiResponseCache.set(cacheKey, text, 10 * 60 * 1000);
    return res.json({ text, fromCache: false });
  } finally {
    inflight.delete(cacheKey);
  }
});

// ── Receipt OCR Endpoint ──────────────────────────────────────────────────────
app.post('/api/ai/ocr', async (req, res) => {
  const { base64Image, mimeType = 'image/jpeg' } = req.body;

  if (!base64Image || typeof base64Image !== 'string') {
    return res.status(400).json({ error: 'base64Image is required' });
  }

  const imageHash = crypto.createHash('md5').update(base64Image.slice(0, 1000)).digest('hex');
  const cached = ocrResultCache.get(imageHash);
  if (cached) {
    return res.json({ items: JSON.parse(cached), fromCache: true });
  }

  try {
    const prompt = `
      Зураг/баримтаас хүнсний материалуудыг задла. JSON массив буцаа:
      [{"name":"Монгол нэр","category":"🥦 Ногоо|🥩 Мах|🥛 Сүү, өндөг|🧂 Амтлагч|🍎 Жимс",
        "quantity":500,"unit":"гр|l|ш","expiryDays":7,"pricePerUnit":3000}]
      Зөвхөн JSON массив буцаа. Markdown оруулахгүй.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        { inlineData: { mimeType, data: base64Image } },
        { text: prompt },
      ],
    });

    const raw = (response.text || '[]').replace(/```json|```/g, '').trim();
    const items = JSON.parse(raw);
    ocrResultCache.set(imageHash, JSON.stringify(items), 60 * 60 * 1000);
    return res.json({ items, fromCache: false });
  } catch (err) {
    const fallback = [
      { name: 'Шинэ Сүү', category: '🥛 Сүү, өндөг', quantity: 1, unit: 'л', expiryDays: 4, pricePerUnit: 3900 },
      { name: 'Сонгино', category: '🥦 Ногоо', quantity: 3, unit: 'ш', expiryDays: 14, pricePerUnit: 1800 },
    ];
    return res.json({ items: fallback, fromCache: false, fallback: true });
  }
});

// ── Production Static Asset Serving ─────────────────────────────────────────
if (IS_PROD) {
  const distPath = path.resolve(__dirname, '../dist');
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.resolve(distPath, 'index.html'));
  });
}

// ── Health Check & Metrics ────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  const aiStats = aiResponseCache.stats();
  const ocrStats = ocrResultCache.stats();
  const totalSavedCalls = aiStats.totalCacheHits + ocrStats.totalCacheHits;
  const estimatedSavedUSD = (totalSavedCalls * 300 * 0.5 / 1_000_000).toFixed(4);

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

// ── Start Server ─────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`🚀 Zity Chef Production Server active on port ${PORT} [ENV: ${IS_PROD ? 'Production' : 'Development'}]`);
});

// ── Graceful Shutdown Handlers ───────────────────────────────────────────────
const gracefulShutdown = () => {
  console.log('\n🛑 Shutdown signal received. Closing server gracefully...');
  server.close(() => {
    console.log('✅ Server closed cleanly.');
    process.exit(0);
  });
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
