import express from 'express';
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { aiResponseCache, ocrResultCache } from '../cache.js';

const router = express.Router();

// ── Gemini AI Client (server-side key isolation) ──────────────────────────────
const apiKey = process.env.GEMINI_API_KEY || 'demo-placeholder-key';
const ai = new GoogleGenAI({ apiKey });
const MODEL = 'gemini-3-flash-preview';

// ── In-flight request deduplication (per instance) ───────────────────────────
const inflight = new Map<string, Promise<string>>();

function makeContextKey(message: string, inventoryContext: string, lang: string): string {
  const normalized = `${lang}|${inventoryContext.toLowerCase().trim()}|${message.toLowerCase().trim()}`;
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}

// ── AI Chat ───────────────────────────────────────────────────────────────────
router.post('/chat', async (req, res) => {
  const { message, inventoryContext = '', lang = 'mn' } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message is required' });
  }

  const cacheKey = makeContextKey(message, inventoryContext, lang);

  const cached = aiResponseCache.get(cacheKey);
  if (cached) {
    return res.json({ text: cached, fromCache: true });
  }

  if (inflight.has(cacheKey)) {
    try {
      const text = await inflight.get(cacheKey)!;
      return res.json({ text, fromCache: true });
    } catch {
      return res.status(500).json({ error: 'AI request processing failed' });
    }
  }

  const systemInstruction = `
    Та бол "Zity Chef" апп-ын ухаалаг тогооч туслах "Zity Тогооч" юм.
    Хэрэглэгчийн хөргөгчинд байгаа материалууд: ${inventoryContext}
    Хэрэглэгчийн хэл: ${lang === 'mn' ? 'Монгол' : 'English'}

    ДҮРЭМ:
    1. Хэрэглэгчтэй мэргэжлийн бөгөөд найрсаг тогооч шиг харилцана.
    2. Хэрэглэгч хоол сонговол хариултын төгсгөлд [ACTION: OPEN_COOKING_MODE, RECIPE_ID: 'id'] бич.
    3. Хоолны жорыг санал болгохдоо 3 хоол санал болго.
    4. Хариултаа товч, ойлгомжтой байлга.
  `;

  const geminiCall = ai.models
    .generateContent({
      model: MODEL,
      contents: message,
      config: { systemInstruction },
    })
    .then((r) => r.text || '')
    .catch(() =>
      lang === 'mn'
        ? 'Сайн байна уу! Өнөөдөр ямар хоол хийж идэх вэ? Zity Тогооч нь туслахад бэлэн байна. ✨'
        : 'Hello! What would you like to cook today? Zity Chef is ready to help. ✨'
    );

  inflight.set(cacheKey, geminiCall);

  try {
    const text = await geminiCall;
    aiResponseCache.set(cacheKey, text, 10 * 60 * 1000);
    return res.json({ text, fromCache: false });
  } finally {
    inflight.delete(cacheKey);
  }
});

// ── Receipt OCR ─────────────────────────────────────────────────────────────
router.post('/ocr', async (req, res) => {
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
      model: MODEL,
      contents: [{ inlineData: { mimeType, data: base64Image } }, { text: prompt }],
    });

    const raw = (response.text || '[]').replace(/```json|```/g, '').trim();
    const items = JSON.parse(raw);
    ocrResultCache.set(imageHash, JSON.stringify(items), 60 * 60 * 1000);
    return res.json({ items, fromCache: false });
  } catch {
    const fallback = [
      { name: 'Шинэ Сүү', category: '🥛 Сүү, өндөг', quantity: 1, unit: 'л', expiryDays: 4, pricePerUnit: 3900 },
      { name: 'Сонгино', category: '🥦 Ногоо', quantity: 3, unit: 'ш', expiryDays: 14, pricePerUnit: 1800 },
    ];
    return res.json({ items: fallback, fromCache: false, fallback: true });
  }
});

export default router;
