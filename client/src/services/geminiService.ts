import { Ingredient, Language } from '../types';
import { formatQuantity } from '../lib/utils';
import { authedFetch } from '../lib/apiClient';

// ── Retry with exponential backoff ──────────────────────────────────────────
async function fetchWithRetry(
  path: string,
  options: RequestInit,
  retries = 3,
  baseDelayMs = 300
): Promise<Response> {
  let lastError: Error = new Error('Unknown error');
  let lastResponse: Response | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await authedFetch(path, options);
      // Rate limited / provider temporarily down — back off and retry, but keep
      // the response so its localized error body survives the last attempt.
      if (response.status === 429 || response.status === 503) {
        lastResponse = response;
        if (attempt < retries - 1) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        return response;
      }
      return response;
    } catch (err) {
      lastError = err as Error;
      if (attempt < retries - 1) {
        await new Promise((r) => setTimeout(r, baseDelayMs * Math.pow(2, attempt)));
      }
    }
  }

  if (lastResponse) return lastResponse;
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

  const promise = fetchWithRetry('/api/ai/chat', {
    method: 'POST',
    body: JSON.stringify({ message, inventoryContext, lang }),
  })
    .then(async (res) => {
      const data = await res.json().catch(() => null as { text?: string; error?: string; errorEn?: string } | null);

      if (!res.ok) {
        // The API answers degraded states with an honest, localized message
        // (quota full / provider down) — show that instead of a generic error.
        if (data?.text) return data.text;
        if (data?.error) return (lang === 'mn' ? data.error : data.errorEn || data.error) as string;
        throw new Error(`HTTP ${res.status}`);
      }

      if (!data?.text) throw new Error('Empty AI response');
      return data.text;
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
    const res = await fetchWithRetry('/api/ai/ocr', {
      method: 'POST',
      body: JSON.stringify({ base64Image, mimeType }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.items || [];
  } catch {
    // Demo fallback for offline / server down
    return [
      {
        name: 'Шинэ сүү',
        category: '🥛 Сүү, өндөг',
        quantity: 1,
        unit: 'л',
        expiryDays: 4,
        pricePerUnit: 3900,
      },
      {
        name: 'Үхрийн гуяны мах',
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
    const res = await authedFetch('/api/health');
    return res.ok ? res.json() : null;
  } catch {
    return null;
  }
}
