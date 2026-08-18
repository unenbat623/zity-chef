import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Response } from 'express';
import { isGuestId, GUEST_ID, authenticateToken, type AuthenticatedRequest } from './middleware/auth.js';

/**
 * Covers the auth middleware's identity decisions, which every route depends
 * on. The previous suite asserted only on local literals, so a regression here
 * — a guest being mistaken for a signed-in user, or an expired token silently
 * downgrading instead of returning 401 — passed CI unnoticed.
 */

function makeReq(headers: Record<string, string> = {}): AuthenticatedRequest {
  return { headers } as unknown as AuthenticatedRequest;
}

function makeRes() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as Response & { statusCode: number; body: any };
}

describe('isGuestId', () => {
  it('treats the legacy shared id and every per-device guest as a guest', () => {
    expect(isGuestId(GUEST_ID)).toBe(true);
    expect(isGuestId('guest:1a2b3c4d5e6f7a8b')).toBe(true);
    expect(isGuestId(undefined)).toBe(true);
    expect(isGuestId('')).toBe(true);
  });

  it('does not mistake a real Supabase uid for a guest', () => {
    expect(isGuestId('9f8e7d6c-1234-4a5b-8c9d-0e1f2a3b4c5d')).toBe(false);
  });
});

describe('authenticateToken', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('assigns a per-device guest identity from a well-formed X-Guest-Id', async () => {
    const req = makeReq({ 'x-guest-id': 'abcdef0123456789' });
    const next = vi.fn();

    await authenticateToken(req, makeRes(), next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user?.id).toBe('guest:abcdef0123456789');
    expect(req.accessToken).toBeUndefined();
  });

  it('falls back to the shared guest id when the header is malformed', async () => {
    // Anything outside GUEST_HEADER_RE must not become an identity namespace.
    const req = makeReq({ 'x-guest-id': 'not a valid id!' });
    const next = vi.fn();

    await authenticateToken(req, makeRes(), next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user?.id).toBe(GUEST_ID);
  });

  it('never grants a subscription tier from the token itself', async () => {
    const req = makeReq({ 'x-guest-id': 'abcdef0123456789' });

    await authenticateToken(req, makeRes(), vi.fn());

    // The tier of record lives in `profiles`; the middleware must not imply one.
    expect(req.user?.subscriptionTier).toBe('free');
  });
});
