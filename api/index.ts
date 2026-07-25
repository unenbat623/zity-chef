import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';

// ── Lightweight in-memory cache for serverless ─────────────────────────────
const cache = new Map<string, { val: string; exp: number }>();
function cacheGet(k: string) {
  const e = cache.get(k);
  if (!e) return null;
  if (Date.now() > e.exp) { cache.delete(k); return null; }
  return e.val;
}
function cacheSet(k: string, v: string, ttlMs: number) {
  cache.set(k, { val: v, exp: Date.now() + ttlMs });
}

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*', credentials: false }));
app.use(express.json({ limit: '10mb' }));

// ── Gemini AI Client ───────────────────────────────────────────────────────
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// ── Health Check ──────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', environment: 'vercel-serverless', timestamp: new Date().toISOString() });
});

// ── AI Chat ───────────────────────────────────────────────────────────────
app.post('/api/ai/chat', async (req, res) => {
  const { message, inventoryContext = '', lang = 'mn' } = req.body;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message is required' });
  }

  const key = crypto
    .createHash('sha256')
    .update(`${lang}|${inventoryContext}|${message}`)
    .digest('hex')
    .slice(0, 16);

  const cached = cacheGet(key);
  if (cached) return res.json({ text: cached, fromCache: true });

  const systemInstruction = `
    Та бол "Zity Chef" апп-ын ухаалаг туслах "Найрсаг Эгч" юм.
    Хэрэглэгчийн хөргөгчинд байгаа материалууд: ${inventoryContext}
    Хэрэглэгчийн хэл: ${lang === 'mn' ? 'Монгол' : 'English'}
    ДҮРЭМ:
    1. Хэрэглэгчтэй "${lang === 'mn' ? 'Дүү минь' : 'dear'}" гэж дотноор харилцана.
    2. Хэрэглэгч хоол сонговол [ACTION: OPEN_COOKING_MODE, RECIPE_ID: 'id'] бич.
    3. Хоолны жорыг санал болгохдоо 3 хоол санал болго.
    4. Хариултаа товч, найрсаг байлга.
  `;

  try {
    const r = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: message,
      config: { systemInstruction },
    });
    const text = r.text || '';
    cacheSet(key, text, 10 * 60 * 1000);
    return res.json({ text, fromCache: false });
  } catch {
    const fallback =
      lang === 'mn'
        ? 'Сайн байна уу дүү минь! Өнөөдөр ямар хоол хийж идэх вэ? ✨'
        : 'Hello dear! What would you like to cook today? ✨';
    return res.json({ text: fallback, fromCache: false });
  }
});

// ── Receipt OCR ───────────────────────────────────────────────────────────
app.post('/api/ai/ocr', async (req, res) => {
  const { base64Image, mimeType = 'image/jpeg' } = req.body;
  if (!base64Image) return res.status(400).json({ error: 'base64Image is required' });

  const imageHash = crypto.createHash('md5').update(base64Image.slice(0, 1000)).digest('hex');
  const cached = cacheGet(imageHash);
  if (cached) return res.json({ items: JSON.parse(cached), fromCache: true });

  try {
    const prompt = `
      Зураг/баримтаас хүнсний материалуудыг задла. JSON массив буцаа:
      [{"name":"Монгол нэр","category":"🥦 Ногоо|🥩 Мах|🥛 Сүү, өндөг|🧂 Амтлагч|🍎 Жимс",
        "quantity":500,"unit":"гр|l|ш","expiryDays":7,"pricePerUnit":3000}]
      Зөвхөн JSON массив буцаа. Markdown оруулахгүй.
    `;
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ inlineData: { mimeType, data: base64Image } }, { text: prompt }],
    });
    const raw = (response.text || '[]').replace(/```json|```/g, '').trim();
    const items = JSON.parse(raw);
    cacheSet(imageHash, JSON.stringify(items), 60 * 60 * 1000);
    return res.json({ items, fromCache: false });
  } catch {
    return res.json({
      items: [
        { name: 'Шинэ Сүү', category: '🥛 Сүү, өндөг', quantity: 1, unit: 'л', expiryDays: 4, pricePerUnit: 3900 },
        { name: 'Сонгино', category: '🥦 Ногоо', quantity: 3, unit: 'ш', expiryDays: 14, pricePerUnit: 1800 },
      ],
      fromCache: false,
      fallback: true,
    });
  }
});

// ── Vercel serverless export ──────────────────────────────────────────────
export default app;
