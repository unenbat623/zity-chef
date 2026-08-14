import express from 'express';
import webpush from 'web-push';
import { AuthenticatedRequest, authenticateToken, isGuestId } from '../middleware/auth.js';
import { isSupabaseConfigured, getSupabaseForUser } from '../supabase.js';

const router = express.Router();

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@zitychef.mn';
export const isPushConfigured = Boolean(VAPID_PUBLIC && VAPID_PRIVATE);

if (isPushConfigured) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

// In-memory fallback subscription store (guest / no Supabase).
const memorySubs = new Map<string, any[]>();

function usesDb(req: AuthenticatedRequest): boolean {
  return Boolean(isSupabaseConfigured && req.accessToken && !isGuestId(req.user?.id));
}

// ── GET /api/push/vapid-public-key ────────────────────────────────────────────
router.get('/vapid-public-key', (_req, res) => {
  res.json({ publicKey: VAPID_PUBLIC, configured: isPushConfigured });
});

router.use(authenticateToken);

// ── POST /api/push/subscribe ──────────────────────────────────────────────────
router.post('/subscribe', async (req: AuthenticatedRequest, res) => {
  const sub = req.body?.subscription;
  if (!sub?.endpoint) return res.status(400).json({ error: 'subscription is required' });
  const uid = req.user!.id;

  if (usesDb(req)) {
    const db = getSupabaseForUser(req.accessToken!);
    const { error } = await db
      .from('push_subscriptions')
      .upsert({ user_id: uid, endpoint: sub.endpoint, subscription: sub }, { onConflict: 'endpoint' });
    if (error) {
      console.error('[Push Subscribe Error]', error.message);
      return res.status(502).json({ error: 'Failed to save subscription' });
    }
    return res.status(201).json({ ok: true, source: 'supabase' });
  }

  const list = memorySubs.get(uid) || [];
  if (!list.find((s) => s.endpoint === sub.endpoint)) list.push(sub);
  memorySubs.set(uid, list);
  return res.status(201).json({ ok: true, source: 'memory' });
});

// ── POST /api/push/send-test ──────────────────────────────────────────────────
// Sends a push to all of the current user's subscriptions (demo / self-test).
router.post('/send-test', async (req: AuthenticatedRequest, res) => {
  if (!isPushConfigured) return res.status(503).json({ error: 'Push not configured (VAPID keys unset)' });
  const uid = req.user!.id;
  const { title = '🍳 Zity Chef', body = 'Туршилтын мэдэгдэл амжилттай ирлээ!' } = req.body || {};

  let subs: any[] = [];
  if (usesDb(req)) {
    const db = getSupabaseForUser(req.accessToken!);
    const { data } = await db.from('push_subscriptions').select('subscription').eq('user_id', uid);
    subs = (data || []).map((r) => r.subscription);
  } else {
    subs = memorySubs.get(uid) || [];
  }

  const payload = JSON.stringify({ title, body, icon: '/icon-192.png' });
  const results = await Promise.allSettled(subs.map((s) => webpush.sendNotification(s, payload)));
  const sent = results.filter((r) => r.status === 'fulfilled').length;
  return res.json({ sent, total: subs.length });
});

export default router;
