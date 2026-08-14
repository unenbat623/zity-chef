import express from 'express';
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { aiResponseCache, ocrResultCache } from '../cache.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { consumeAiQuota, peekAiQuota } from '../lib/subscription.js';
import { getRecipeCatalog, renderCatalog } from '../lib/recipeCatalog.js';

const router = express.Router();

// ── Provider config ───────────────────────────────────────────────────────────
// AI_PROVIDER: 'gemini' | 'ollama' | 'auto' (default). `auto` prefers Gemini when
// a key is set, otherwise falls back to a local (free) Ollama server.
// Tolerate the usual copy-paste damage: surrounding quotes and stray whitespace.
const GEMINI_KEY = (process.env.GEMINI_API_KEY || '').trim().replace(/^["']|["']$/g, '');

/**
 * The SDK sends the key in the `x-goog-api-key` header, and HTTP headers are
 * ByteStrings — a single non-Latin-1 character makes every request throw before
 * it leaves the process. That looks exactly like an outage in the chat UI, so
 * detect it up front and report it as the configuration error it is. A Cyrillic
 * "Т"/"А"/"С" pasted with a Mongolian keyboard layout is the usual culprit.
 */
function describeKeyProblem(key: string): string | null {
  if (!key) return 'GEMINI_API_KEY is empty';
  const bad = [...key].findIndex((ch) => ch.charCodeAt(0) > 255);
  if (bad !== -1) {
    const ch = key[bad];
    return `GEMINI_API_KEY contains a non-Latin character ${JSON.stringify(ch)} (U+${ch
      .charCodeAt(0)
      .toString(16)
      .toUpperCase()
      .padStart(4, '0')}) at position ${bad} — it cannot be sent as an HTTP header. Re-paste the key with a Latin keyboard layout.`;
  }
  return null;
}

const GEMINI_KEY_PROBLEM = describeKeyProblem(GEMINI_KEY);

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:1b';
const PROVIDER =
  process.env.AI_PROVIDER || (GEMINI_KEY ? 'gemini' : 'ollama');

// Primary model first; the `-latest` alias is a safety net for the day the
// pinned id is retired or is temporarily out of capacity.
//
// Cost note: gemini-3-flash-preview is a reasoning model. Measured on this
// app's own prompt it spent 1894 thinking tokens against a 249-token answer —
// thinking is billed as output, so ~88% of every bill bought reasoning that a
// cooking chat does not need. A Flash-Lite tier plus a low thinking level cuts
// the per-request cost by roughly an order of magnitude at the same usefulness.
const GEMINI_MODEL = process.env.AI_MODEL || 'gemini-3.1-flash-lite';
const GEMINI_FALLBACK_MODELS = [GEMINI_MODEL, 'gemini-flash-lite-latest', 'gemini-flash-latest'];

/** 'low' | 'medium' | 'high' — or 'off' to drop the thinking budget entirely. */
const THINKING_LEVEL = process.env.AI_THINKING_LEVEL || 'low';
/** Hard ceiling on the answer, so one odd prompt cannot run up a large bill. */
const MAX_OUTPUT_TOKENS = Number(process.env.AI_MAX_OUTPUT_TOKENS || 700);
/** How long an answer stays reusable. Longer = more free capacity. */
const AI_CACHE_TTL_MS = Number(process.env.AI_CACHE_TTL_MINUTES || 60) * 60 * 1000;

function generationConfig(system: string) {
  const config: Record<string, unknown> = {
    systemInstruction: system,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
  };
  if (THINKING_LEVEL !== 'off') {
    config.thinkingConfig = { thinkingLevel: THINKING_LEVEL };
  }
  return config;
}

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
          config: generationConfig(system),
        });
        const u = r.usageMetadata;
        if (u) {
          console.log(
            `[ai] ${model} in=${u.promptTokenCount ?? 0} out=${u.candidatesTokenCount ?? 0} think=${
              u.thoughtsTokenCount ?? 0
            }`
          );
        }
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

  // A malformed key can never succeed, so skip the doomed call and its retries
  // and surface the real reason instead of a generic "temporarily unreachable".
  if (GEMINI_KEY_PROBLEM) {
    console.error('[ai] Misconfigured Gemini key:', GEMINI_KEY_PROBLEM);
    try {
      return await ollamaChat(system, message);
    } catch {
      throw new Error(`AI_MISCONFIGURED: ${GEMINI_KEY_PROBLEM}`);
    }
  }

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
  // "Try again shortly" is a lie when the key itself is wrong — say so instead.
  const misconfigured = /AI_MISCONFIGURED|ByteString/i.test(message);

  if (lang === 'mn') {
    if (misconfigured) return 'AI тохиргоо буруу байна. Админ GEMINI_API_KEY-г шалгах шаардлагатай. ⚙️';
    return quota
      ? 'AI-н хүсэлтийн хязгаар түр дүүрлээ. 1 минутын дараа дахин оролдоно уу. 🙏'
      : 'AI туслах түр холбогдохгүй байна. Хэсэг хүлээгээд дахин оролдоно уу. 🙏';
  }
  if (misconfigured) return 'The AI is misconfigured — an admin needs to check GEMINI_API_KEY. ⚙️';
  return quota
    ? 'The AI request limit is temporarily full. Please try again in a minute. 🙏'
    : 'The AI assistant is temporarily unreachable. Please try again shortly. 🙏';
}

/**
 * The assistant's brief. Two things it previously lacked: the expiry state of
 * the fridge (the app's whole premise is cooking food before it spoils) and the
 * list of recipe ids it is allowed to open, which it used to invent.
 */
function buildSystemPrompt(inventoryContext: string, catalog: string, lang: string): string {
  const mn = lang === 'mn';
  const fridge = inventoryContext.trim() || (mn ? '(хоосон)' : '(empty)');

  const rules = mn
    ? `ДҮРЭМ:
1. Мэргэжлийн, найрсаг тогооч шиг, товч бөгөөд тодорхой хариул. 120 үгээс хэтрүүлэхгүй.
2. Хамгийн түрүүнд удахгүй муудах орцыг ашиглахыг санал болго — энэ бол таны гол үүрэг.
3. Хөргөгчид байхгүй орц хэрэгтэй бол түүнийг тодорхой хэлж, дэлгүүрээс авахыг сануул.
4. Хоолыг бүтэн жороор хийхийг санал болгож байвал хариултын ТӨГСГӨЛД яг ийм тэмдэглэгээ бич:
   [ACTION: OPEN_COOKING_MODE, RECIPE_ID: 'id']
   RECIPE_ID нь заавал доорх жагсаалтын id байх ёстой. Жагсаалтад байхгүй бол тэмдэглэгээг бүү бич.
5. Хэрэглэгч 3 сонголт хүсвэл 3 санал болго, эс бөгөөс 1-2 хангалттай.
6. Орцын хэмжээг метр системээр (гр, мл, кг) бич.`
    : `RULES:
1. Answer as a warm, professional chef. Be concrete and stay under 120 words.
2. Prioritise ingredients that are about to spoil — that is your main job.
3. If a dish needs something the fridge lacks, say so and suggest buying it.
4. When you recommend cooking a full recipe, end the reply with exactly:
   [ACTION: OPEN_COOKING_MODE, RECIPE_ID: 'id']
   RECIPE_ID must come from the list below. If nothing fits, omit the marker.
5. Give three options only when asked; otherwise one or two is enough.
6. Use metric units (g, ml, kg).`;

  return [
    mn
      ? 'Та бол "Zity Chef" аппын ухаалаг тогооч туслах "Zity Тогооч".'
      : 'You are "Zity Chef", the smart cooking assistant inside the Zity Chef app.',
    '',
    mn ? `ХЭРЭГЛЭГЧИЙН ХӨРГӨГЧ:\n${fridge}` : `THE USER'S FRIDGE:\n${fridge}`,
    '',
    catalog ? (mn ? `АППАД БАЙГАА ЖОРУУД (id | нэр | орц):\n${catalog}` : `RECIPES AVAILABLE IN THE APP (id | name | ingredients):\n${catalog}`) : '',
    '',
    rules,
  ]
    .filter(Boolean)
    .join('\n');
}

// ── In-flight request deduplication (per instance) ───────────────────────────
const inflight = new Map<string, Promise<string>>();

function makeContextKey(message: string, inventoryContext: string, lang: string): string {
  const normalized = `${lang}|${inventoryContext.toLowerCase().trim()}|${message.toLowerCase().trim()}`;
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}

// ── GET /api/ai/quota (how many requests the caller has left today) ───────────
router.get('/quota', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const quota = await peekAiQuota(req);
  res.json(quota);
});

// ── GET /api/ai/provider (which backend is active) ────────────────────────────
// `?check=1` additionally makes one tiny live call, so a broken key / exhausted
// quota can be diagnosed without guessing from the chat UI.
router.get('/provider', async (req, res) => {
  const info = {
    provider: PROVIDER,
    model: PROVIDER === 'gemini' ? GEMINI_MODEL : OLLAMA_MODEL,
    keyConfigured: PROVIDER !== 'gemini' || Boolean(GEMINI_KEY),
    keyProblem: PROVIDER === 'gemini' ? GEMINI_KEY_PROBLEM ?? undefined : undefined,
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
router.post('/chat', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const { message, inventoryContext = '', lang = 'mn' } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message is required' });
  }

  const cacheKey = makeContextKey(message, inventoryContext, lang);

  // A cache hit costs nothing, so it must not spend the caller's allowance.
  const cached = await aiResponseCache.get(cacheKey);
  if (cached) {
    return res.json({ text: cached, fromCache: true });
  }

  // Every uncached answer is a real bill — claim it against the daily quota
  // before calling the provider, not after.
  const quota = await consumeAiQuota(req);
  if (!quota.allowed) {
    // Two different situations, and telling the user to upgrade is wrong advice
    // for the second one — Pro would not help if the whole app is out for today.
    const text = quota.budgetExhausted
      ? lang === 'mn'
        ? 'AI туслах өнөөдрийн ачааллаа дуусгалаа. Маргааш шинэ хязгаартайгаар үргэлжлүүлнэ. 🌙'
        : 'The AI assistant has reached its capacity for today. It resets tomorrow. 🌙'
      : lang === 'mn'
        ? `Өнөөдрийн ${quota.limit} удаагийн AI хязгаар дууслаа. Маргааш дахин ашиглах эсвэл Pro багц идэвхжүүлээрэй. ✨`
        : `You have used all ${quota.limit} AI requests for today. Try again tomorrow or upgrade to Pro. ✨`;

    return res.status(429).json({
      error: quota.budgetExhausted ? 'AI_BUDGET_EXHAUSTED' : 'AI_QUOTA_EXCEEDED',
      text,
      quota: { used: quota.used, limit: quota.limit, remaining: quota.remaining, tier: quota.tier },
    });
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

  const catalog = renderCatalog(await getRecipeCatalog());
  const systemInstruction = buildSystemPrompt(inventoryContext, catalog, lang);

  const call = chatComplete(systemInstruction, message);
  inflight.set(cacheKey, call);

  try {
    const text = await call;
    // Only real answers are cached — a canned failure message must never be
    // replayed for 10 minutes after the provider has already recovered.
    // A long TTL is the cheapest capacity there is: a cache hit costs nothing
    // and never touches the daily budget. Fridge contents change slowly, so an
    // hour-old answer to the same question against the same fridge is still good.
    await aiResponseCache.set(cacheKey, text, AI_CACHE_TTL_MS);
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
    { name: 'Шинэ сүү', category: '🥛 Сүү, өндөг', quantity: 1, unit: 'л', expiryDays: 4, pricePerUnit: 3900 },
    { name: 'Сонгино', category: '🥦 Ногоо', quantity: 3, unit: 'ш', expiryDays: 14, pricePerUnit: 1800 },
  ];

  // OCR needs a vision model — only Gemini is wired for it. Without a key, return
  // the demo list so the scanner still works end-to-end.
  if (PROVIDER !== 'gemini') {
    return res.json({ items: fallback, fromCache: false, fallback: true });
  }

  try {
    const prompt = `
      Зураг/баримтаас хүнсний материалуудыг ялгаж таниул. JSON массив буцаа:
      [{"name":"Монгол нэр","category":"🥦 Ногоо|🥩 Мах|🥛 Сүү, өндөг|🧂 Амтлагч|🍎 Жимс",
        "quantity":500,"unit":"гр|л|ш","expiryDays":7,"pricePerUnit":3000}]
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
