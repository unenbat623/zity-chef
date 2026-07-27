import { Ingredient, Language } from '../types';
import { formatQuantity } from '../lib/utils';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3002';

// ── Retry with exponential backoff ──────────────────────────────────────────
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 3,
  baseDelayMs = 300
): Promise<Response> {
  let lastError: Error = new Error('Unknown error');
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.status === 429) {
        // Rate limited — wait longer
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      return response;
    } catch (err) {
      lastError = err as Error;
      if (attempt < retries - 1) {
        await new Promise((r) => setTimeout(r, baseDelayMs * Math.pow(2, attempt)));
      }
    }
  }
  throw lastError;
}

// ── In-flight deduplication (client-side) ───────────────────────────────────
const pendingRequests = new Map<string, Promise<string>>();

// ── AI Chat via server proxy (no client-side API key) ───────────────────────
export async function getSisterAdvice(
  message: string,
  inventory: Ingredient[],
  lang: Language = 'mn'
): Promise<string> {
  const inventoryContext = inventory
    .map((i) => `${i.name}: ${formatQuantity(i.quantity, i.unit)}`)
    .join(', ');

  const requestKey = `${lang}|${message.slice(0, 50)}|${inventoryContext.slice(0, 100)}`;

  // Deduplicate in-flight requests from client side too
  if (pendingRequests.has(requestKey)) {
    return pendingRequests.get(requestKey)!;
  }

  const promise = fetchWithRetry(`${API_BASE}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, inventoryContext, lang }),
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.text as string;
    })
    .catch(() =>
      lang === 'mn'
        ? 'Уучлаарай, сервертэй холбогдож чадсангүй. Дахин оролдоод үзээрэй. ✨'
        : 'Sorry, could not reach the server. Please try again. ✨'
    )
    .finally(() => pendingRequests.delete(requestKey));

  pendingRequests.set(requestKey, promise);
  return promise;
}

// ── Receipt OCR via server proxy ─────────────────────────────────────────────
export async function parseReceiptImage(
  base64Image: string,
  mimeType = 'image/jpeg'
): Promise<Partial<Ingredient>[]> {
  try {
    const res = await fetchWithRetry(`${API_BASE}/api/ai/ocr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Image, mimeType }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.items || [];
  } catch {
    // Demo fallback for offline / server down
    return [
      {
        name: 'Шинэ Сүү 1L',
        category: '🥛 Сүү, өндөг',
        quantity: 1,
        unit: 'л',
        expiryDays: 4,
        pricePerUnit: 3900,
      },
      {
        name: 'Үхрийн Гуяны Мах',
        category: '🥩 Мах',
        quantity: 800,
        unit: 'гр',
        expiryDays: 3,
        pricePerUnit: 24000,
      },
    ];
  }
}

// ── Health check ─────────────────────────────────────────────────────────────
export async function getServerHealth() {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    return res.ok ? res.json() : null;
  } catch {
    return null;
  }
}
