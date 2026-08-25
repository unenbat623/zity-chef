import { getAccessToken, refreshAccessToken } from './supabase';

/**
 * Where the API lives, from the client's point of view.
 *
 * Exported (and parameterised) so the rule can be tested: a production build
 * must call its own origin. `.env` carries the *server's* NODE_ENV, which Vite
 * reads when it loads VITE_* variables, and a build stamped as development left
 * `isProd` false here — so the deployed app called `<host>:3002`, which serves
 * nothing. vite.config.ts pins the flag now; this is the behaviour it decides.
 */
export function resolveApiBase(options: {
  configured?: string;
  isProd: boolean;
  protocol?: string;
  hostname?: string;
}): string {
  if (options.configured) return options.configured;
  if (options.isProd) return '';
  if (!options.protocol || !options.hostname) return 'http://localhost:3002';
  return `${options.protocol}//${options.hostname}:3002`;
}

export const API_BASE = resolveApiBase({
  configured: import.meta.env.VITE_API_URL,
  isProd: import.meta.env.PROD,
  protocol: typeof window === 'undefined' ? undefined : window.location.protocol,
  hostname: typeof window === 'undefined' ? undefined : window.location.hostname,
});

const GUEST_ID_KEY = 'zity_guest_id';

/**
 * Stable per-device id for visitors without a Supabase session. Sent as
 * X-Guest-Id so the backend keeps each device's guest data separate instead of
 * pooling every logged-out visitor into one shared bucket.
 */
/**
 * 128 bits from the platform CSPRNG. `crypto.randomUUID` is gated on secure
 * contexts, but `getRandomValues` is not — so this still holds over plain HTTP,
 * which is exactly where the id would otherwise fall back to a guessable value.
 */
function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function getGuestId(): string {
  if (typeof window === 'undefined') return '';
  try {
    const existing = localStorage.getItem(GUEST_ID_KEY);
    if (existing) return existing;
    if (typeof crypto === 'undefined') return '';

    const generated = 'randomUUID' in crypto ? crypto.randomUUID() : randomHex(16);
    localStorage.setItem(GUEST_ID_KEY, generated);
    return generated;
  } catch {
    // Private mode / storage disabled — fall back to the shared guest bucket.
    return '';
  }
}

/**
 * fetch() wrapper that attaches the current Supabase access token as a Bearer
 * header so the backend can identify the user and enforce per-user isolation.
 * Falls back to an unauthenticated request in demo mode (no token available).
 */
export async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const doFetch = async (): Promise<Response> => {
    const token = await getAccessToken();
    const headers = new Headers(init.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);

    // Sent unconditionally. The server only reads it when it falls back to a
    // guest identity, which also happens when Supabase is unreachable during
    // token verification — sending it only in the token-less branch would drop
    // those users into one shared bucket where they could read each other's data.
    const guestId = getGuestId();
    if (guestId) headers.set('X-Guest-Id', guestId);
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
    return fetch(url, { ...init, headers });
  };

  let res = await doFetch();

  // The server answers 401 when our token failed verification (usually
  // expiry). Refresh the session once and retry — without this, an expired
  // token surfaced as an empty fridge with no way back short of a reload.
  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) res = await doFetch();
  }

  return res;
}
