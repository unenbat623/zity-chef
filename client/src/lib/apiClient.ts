import { getAccessToken } from './supabase';

function getDefaultApiBase(): string {
  if (typeof window === 'undefined') return 'http://localhost:3002';
  return `${window.location.protocol}//${window.location.hostname}:3002`;
}

export const API_BASE = import.meta.env.VITE_API_URL || getDefaultApiBase();

/**
 * fetch() wrapper that attaches the current Supabase access token as a Bearer
 * header so the backend can identify the user and enforce per-user isolation.
 * Falls back to an unauthenticated request in demo mode (no token available).
 */
export async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  return fetch(url, { ...init, headers });
}
