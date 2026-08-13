import express from 'express';
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { aiResponseCache, ocrResultCache } from '../cache.js';

const router = express.Router();

// ── Provider config ───────────────────────────────────────────────────────────
// AI_PROVIDER: 'gemini' | 'ollama' | 'auto' (default). `auto` prefers Gemini when
// a key is set, otherwise falls back to a local (free) Ollama server.
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:1b';
const PROVIDER =
  process.env.AI_PROVIDER || (GEMINI_KEY ? 'gemini' : 'ollama');

// Primary model first; the `-latest` alias is a safety net for the day the
// preview id is retired or is temporarily out of capacity.
const GEMINI_MODEL = 'gemini-3-flash-preview';
const GEMINI_FALLBACK_MODELS = [GEMINI_MODEL, 'gemini-flash-latest'];

let geminiClient: GoogleGenAI | null = null;
function gemini() {
  if (!geminiClient) geminiClient = new GoogleGenAI({ apiKey: GEMINI_KEY || 'demo-placeholder-key' });
  return geminiClient;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function errorInfo(err: unknown): { status: number; message: string } {
  const e = err as { status?: number; code?: number; message?: string };
  const message = e?.message || String(err);
  let status = Number(e?.status ?? e?.code ?? 0);
  if (!status) {
    const m = message.match(/\b(429|4\d\d|5\d\d)\b/);
    if (m) status = Number(m[1]);
  }
  return { status, message };
}

/** Transient = worth retrying: rate limit, overload, gateway/5xx blips. */
function isTransient(err: unknown): boolean {
  const { status, message } = errorInfo(err);
  if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) return true;
  return /RESOURCE_EXHAUSTED|UNAVAILABLE|overloaded|ETIMEDOUT|ECONNRESET|fetch failed/i.test(message);
}

// ── Chat completion across providers ──────────────────────────────────────────
async function ollamaChat(system: string, message: string): Promise<string> {
  const r = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: message },
      ],
      stream: false,
    }),
  });
  if (!r.ok) throw new Error(`Ollama HTTP ${r.status}`);
  const data = (await r.json()) as { message?: { content?: string } };
  const text = (data.message?.content || '').trim();
  if (!text) throw new Error('Ollama returned an empty response');
  return text;
}

/** Gemini call with per-model retry/backoff, then a fallback model. */
async function geminiChat(system: string, message: string): Promise<string> {
  let lastError: unknown = new Error('Gemini call was never attempted');

  for (const model of GEMINI_FALLBACK_MODELS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await gemini().models.generateContent({
          model,
          contents: message,
          config: { systemInstruction: system },
        });
        const text = (r.text || '').trim();
        if (text) return text;
        // Empty body (e.g. the model spent its budget on thinking, or the answer
        // was filtered) — not retryable on this model, move to the next one.
        lastError = new Error(
          `${model} returned no text (finishReason=${r.candidates?.[0]?.finishReason ?? 'unknown'})`
        );
        break;
      } catch (err) {
        lastError = err;
        const { status, message: msg } = errorInfo(err);
        console.warn(`[ai] ${model} attempt ${attempt + 1} failed (status=${status || '?'}): ${msg}`);
        if (!isTransient(err)) break; // bad key / bad model id → next model
        if (attempt < 2) await sleep(500 * 2 ** attempt);
      }
    }
  }

  throw lastError;
}

async function chatComplete(system: string, message: string): Promise<string> {
  if (PROVIDER !== 'gemini') return ollamaChat(system, message);

  try {
    return await geminiChat(system, message);
  } catch (err) {
    console.error('[ai] Gemini unavailable:', errorInfo(err).message);
    // Last resort: a local Ollama server, if one happens to be running.
    try {
      return await ollamaChat(system, message);
    } catch {
      throw err; // report the original (Gemini) cause
    }
  }
}

/** Honest, localized message shown when every provider failed. */
function unavailableMessage(err: unknown, lang: string): string {
  const { status, message } = errorInfo(err);
  const quota = status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(message);
  if (lang === 'mn') {
    return quota
      ? 'AI-н хүсэлтийн хязгаар түр дүүрлээ. 1 минутын дараа дахин оролдоно уу. 🙏'
      : 'AI туслах түр холбогдохгүй байна. Хэсэг хүлээгээд дахин оролдоно уу. 🙏';
  }
  return quota
    ? 'The AI request limit is temporarily full. Please try again in a minute. 🙏'
    : 'The AI assistant is temporarily unreachable. Please try again shortly. 🙏';
}

// ── In-flight request deduplication (per instance) ───────────────────────────
const inflight = new Map<string, Promise<string>>();

function makeContextKey(message: string, inventoryContext: string, lang: string): string {
  const normalized = `${lang}|${inventoryContext.toLowerCase().trim()}|${message.toLowerCase().trim()}`;
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}

// ── GET /api/ai/provider (which backend is active) ────────────────────────────
// `?check=1` additionally makes one tiny live call, so a broken key / exhausted
// quota can be diagnosed without guessing from the chat UI.
router.get('/provider', async (req, res) => {
  const info = {
    provider: PROVIDER,
    model: PROVIDER === 'gemini' ? GEMINI_MODEL : OLLAMA_MODEL,
    keyConfigured: PROVIDER !== 'gemini' || Boolean(GEMINI_KEY),
  };

  if (req.query.check !== '1') return res.json(info);

  try {
    const sample = await chatComplete('Reply with the single word OK.', 'ping');
    return res.json({ ...info, live: true, sample: sample.slice(0, 60) });
  } catch (err) {
    const { status, message } = errorInfo(err);
    return res.status(503).json({ ...info, live: false, status: status || undefined, reason: message });
  }
});

// ── AI Chat ───────────────────────────────────────────────────────────────────
router.post('/chat', async (req, res) => {
  const { message, inventoryContext = '', lang = 'mn' } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message is required' });
  }

  const cacheKey = makeContextKey(message, inventoryContext, lang);

  const cached = await aiResponseCache.get(cacheKey);
  if (cached) {
    return res.json({ text: cached, fromCache: true });
  }

  if (inflight.has(cacheKey)) {
    try {
      const text = await inflight.get(cacheKey)!;
      return res.json({ text, fromCache: true });
    } catch (err) {
      return res
        .status(503)
        .json({ error: 'AI_UNAVAILABLE', text: unavailableMessage(err, lang), degraded: true });
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

  const call = chatComplete(systemInstruction, message);
  inflight.set(cacheKey, call);

  try {
    const text = await call;
    // Only real answers are cached — a canned failure message must never be
    // replayed for 10 minutes after the provider has already recovered.
    await aiResponseCache.set(cacheKey, text, 10 * 60 * 1000);
    return res.json({ text, fromCache: false });
  } catch (err) {
    console.error('[ai] /chat failed:', errorInfo(err).message);
    return res
      .status(503)
      .json({ error: 'AI_UNAVAILABLE', text: unavailableMessage(err, lang), degraded: true });
  } finally {
    inflight.delete(cacheKey);
  }
});

// ── Receipt OCR (vision — Gemini only; falls back to a demo list otherwise) ───
router.post('/ocr', async (req, res) => {
  const { base64Image, mimeType = 'image/jpeg' } = req.body;

  if (!base64Image || typeof base64Image !== 'string') {
    return res.status(400).json({ error: 'base64Image is required' });
  }

  const imageHash = crypto.createHash('md5').update(base64Image.slice(0, 1000)).digest('hex');
  const cached = await ocrResultCache.get(imageHash);
  if (cached) {
    return res.json({ items: JSON.parse(cached), fromCache: true });
  }

  const fallback = [
    { name: 'Шинэ Сүү', category: '🥛 Сүү, өндөг', quantity: 1, unit: 'л', expiryDays: 4, pricePerUnit: 3900 },
    { name: 'Сонгино', category: '🥦 Ногоо', quantity: 3, unit: 'ш', expiryDays: 14, pricePerUnit: 1800 },
  ];

  // OCR needs a vision model — only Gemini is wired for it. Without a key, return
  // the demo list so the scanner still works end-to-end.
  if (PROVIDER !== 'gemini') {
    return res.json({ items: fallback, fromCache: false, fallback: true });
  }

  try {
    const prompt = `
      Зураг/баримтаас хүнсний материалуудыг задла. JSON массив буцаа:
      [{"name":"Монгол нэр","category":"🥦 Ногоо|🥩 Мах|🥛 Сүү, өндөг|🧂 Амтлагч|🍎 Жимс",
        "quantity":500,"unit":"гр|l|ш","expiryDays":7,"pricePerUnit":3000}]
      Зөвхөн JSON массив буцаа. Markdown оруулахгүй.
    `;

    const response = await gemini().models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ inlineData: { mimeType, data: base64Image } }, { text: prompt }],
    });

    const raw = (response.text || '[]').replace(/```json|```/g, '').trim();
    const items = JSON.parse(raw);
    await ocrResultCache.set(imageHash, JSON.stringify(items), 60 * 60 * 1000);
    return res.json({ items, fromCache: false });
  } catch (err) {
    console.error('[ai] /ocr failed, returning demo items:', errorInfo(err).message);
    return res.json({ items: fallback, fromCache: false, fallback: true });
  }
});

export default router;
