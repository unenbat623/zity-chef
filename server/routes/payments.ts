import express from 'express';
import crypto from 'crypto';
import { authenticateToken, AuthenticatedRequest, isGuestId } from '../middleware/auth.js';
import { setSubscriptionTier, Tier } from '../lib/subscription.js';
import { supabaseAdmin } from '../supabase.js';

const router = express.Router();

const IS_PROD = process.env.NODE_ENV === 'production';

// ── QPay v2 configuration ─────────────────────────────────────────────────────
const QPAY_BASE = process.env.QPAY_BASE_URL || 'https://merchant.qpay.mn/v2';
const QPAY_USERNAME = process.env.QPAY_USERNAME || '';
const QPAY_PASSWORD = process.env.QPAY_PASSWORD || '';
const QPAY_INVOICE_CODE = process.env.QPAY_INVOICE_CODE || '';
const QPAY_CALLBACK_URL = process.env.QPAY_CALLBACK_URL || '';

export const isQpayConfigured = Boolean(QPAY_USERNAME && QPAY_PASSWORD && QPAY_INVOICE_CODE);

/**
 * Subscription prices live here, not in the request body — the client's
 * `amount` used to be trusted verbatim, so Pro could be bought for 1₮.
 * Must match the figures shown in SubscriptionModal.
 */
const PLAN_PRICES: Record<Exclude<Tier, 'free'>, number> = {
  pro: 9_900,
  family: 19_900,
};

// ── Access-token cache (QPay tokens expire) ───────────────────────────────────
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getQpayToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 30_000) return cachedToken.token;
  const basic = Buffer.from(`${QPAY_USERNAME}:${QPAY_PASSWORD}`).toString('base64');
  const res = await fetch(`${QPAY_BASE}/auth/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`QPay auth failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in?: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ? data.expires_in * 1000 : 3600_000),
  };
  return cachedToken.token;
}

/** Asks QPay itself whether an invoice has been paid. The callback body is
 *  never trusted — anyone can POST to the callback URL. */
async function queryQpayPaid(invoiceId: string): Promise<boolean> {
  const token = await getQpayToken();
  const r = await fetch(`${QPAY_BASE}/payment/check`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      object_type: 'INVOICE',
      object_id: invoiceId,
      offset: { page_number: 1, page_limit: 100 },
    }),
  });
  const data = (await r.json()) as any;
  if (!r.ok) throw new Error(`QPay check failed: ${r.status}`);
  return Number(data.paid_amount) > 0 || (Array.isArray(data.rows) && data.rows.length > 0);
}

// ── Simulated invoice store (when QPay isn't configured; dev/demo only) ───────
interface SimInvoice {
  createdAt: number;
  paid: boolean;
}
const simInvoices = new Map<string, SimInvoice>();

// ── Payment intents ───────────────────────────────────────────────────────────
// What each invoice buys, and for whom. Stored in Postgres so it survives
// restarts and serverless cold starts (an in-process Map used to lose the
// intent between invoice creation and the payment callback, silently dropping
// paid upgrades). The Map remains only as a dev fallback without Supabase.
type IntentStatus = 'pending' | 'paid' | 'consumed';
interface PaymentIntent {
  invoiceId: string;
  userId: string;
  kind: 'plan' | 'order';
  tier: Exclude<Tier, 'free'> | null;
  months: number;
  amount: number;
  status: IntentStatus;
}
const memoryIntents = new Map<string, PaymentIntent>();

function rowToIntent(r: Record<string, unknown>): PaymentIntent {
  return {
    invoiceId: String(r.invoice_id),
    userId: String(r.user_id),
    kind: r.kind === 'order' ? 'order' : 'plan',
    tier: r.tier === 'pro' || r.tier === 'family' ? r.tier : null,
    months: Number(r.months ?? 1),
    amount: Number(r.amount ?? 0),
    status: (r.status as IntentStatus) || 'pending',
  };
}

async function saveIntent(intent: PaymentIntent): Promise<void> {
  if (supabaseAdmin) {
    const { error } = await supabaseAdmin.from('payment_intents').insert({
      invoice_id: intent.invoiceId,
      user_id: intent.userId,
      kind: intent.kind,
      tier: intent.tier,
      months: intent.months,
      amount: intent.amount,
      status: 'pending',
    });
    if (!error) return;
    console.error('[payments] failed to persist intent:', error.message);
  }
  memoryIntents.set(intent.invoiceId, intent);
}

async function getIntent(invoiceId: string): Promise<PaymentIntent | null> {
  if (supabaseAdmin) {
    const { data } = await supabaseAdmin
      .from('payment_intents')
      .select('*')
      .eq('invoice_id', invoiceId)
      .maybeSingle();
    if (data) return rowToIntent(data);
  }
  return memoryIntents.get(invoiceId) ?? null;
}

/** Transitions pending → paid exactly once; the winner gets the intent back.
 *  The conditional update is what makes duplicate callbacks idempotent. */
async function markIntentPaid(invoiceId: string): Promise<PaymentIntent | null> {
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('payment_intents')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('invoice_id', invoiceId)
      .eq('status', 'pending')
      .select()
      .maybeSingle();
    if (error) console.error('[payments] markIntentPaid failed:', error.message);
    if (data) return rowToIntent(data);
    // Fall through: the intent may predate Supabase config and live in memory.
  }
  const mem = memoryIntents.get(invoiceId);
  if (mem && mem.status === 'pending') {
    mem.status = 'paid';
    return mem;
  }
  return null;
}

async function revertIntentToPending(invoiceId: string): Promise<void> {
  if (supabaseAdmin) {
    await supabaseAdmin
      .from('payment_intents')
      .update({ status: 'pending', paid_at: null })
      .eq('invoice_id', invoiceId)
      .eq('status', 'paid');
  }
  const mem = memoryIntents.get(invoiceId);
  if (mem && mem.status === 'paid') mem.status = 'pending';
}

/**
 * Order creation calls this to prove the invoice was actually paid, belongs to
 * the caller, and covers the server-computed total. Consuming it (paid →
 * consumed) makes one invoice good for exactly one order.
 */
export async function consumePaidOrderIntent(
  invoiceId: string,
  userId: string,
  expectedAmount: number
): Promise<boolean> {
  if (!invoiceId) return false;
  const intent = await getIntent(invoiceId);
  if (!intent || intent.kind !== 'order' || intent.userId !== userId) return false;
  if (intent.status !== 'paid') return false;
  if (Math.round(intent.amount) !== Math.round(expectedAmount)) return false;

  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('payment_intents')
      .update({ status: 'consumed' })
      .eq('invoice_id', invoiceId)
      .eq('status', 'paid')
      .select('invoice_id')
      .maybeSingle();
    if (error) console.error('[payments] consume intent failed:', error.message);
    if (data) return true;
  }
  const mem = memoryIntents.get(invoiceId);
  if (mem && mem.status === 'paid') {
    mem.status = 'consumed';
    return true;
  }
  return false;
}

/** Settles a verified payment: marks the intent paid (once) and, for plan
 *  purchases, grants the tier. Returns the granted tier, if any. */
async function settlePaidInvoice(invoiceId: string): Promise<Tier | null> {
  const intent = await markIntentPaid(invoiceId);
  if (!intent) return null;
  if (intent.kind === 'plan' && intent.tier) {
    const ok = await setSubscriptionTier(intent.userId, intent.tier, intent.months);
    if (!ok) {
      // Leave it retryable — the next check/callback attempts the grant again.
      await revertIntentToPending(invoiceId);
      console.error(`[payments] ${invoiceId}: tier grant failed, intent reverted`);
      return null;
    }
    console.log(`[payments] ${invoiceId}: granted ${intent.tier}`);
    return intent.tier;
  }
  return null;
}

function normalizePlan(value: unknown): Exclude<Tier, 'free'> | null {
  return value === 'pro' || value === 'family' ? value : null;
}

// A tiny inline QR-ish placeholder image (data URI) for the simulated flow.
const PLACEHOLDER_QR =
  'data:image/svg+xml;base64,' +
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><rect width="180" height="180" fill="#fff"/><g fill="#0f172a">${Array.from(
      { length: 100 }
    )
      .map((_, i) => {
        const x = (i % 10) * 18;
        const y = Math.floor(i / 10) * 18;
        return (i * 7) % 3 === 0 ? `<rect x="${x}" y="${y}" width="16" height="16"/>` : '';
      })
      .join('')}</g></svg>`
  ).toString('base64');

// ── POST /api/payments/qpay/create ────────────────────────────────────────────
router.post('/qpay/create', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const { amount, description = 'Zity Chef захиалга', orderRef, plan, months = 1 } = req.body;

  const tier = normalizePlan(plan);
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'UNAUTHENTICATED' });

  // A subscription purchase must be tied to a real, recoverable account.
  // `isGuestId` alone is not enough: an anonymous Supabase user carries a real
  // uuid, so they passed this check and could buy a plan attached to a session
  // they can never sign back into — the tier would be paid for and then lost.
  if (tier && (isGuestId(userId) || req.user?.isAnonymous)) {
    return res.status(401).json({ error: 'SIGN_IN_REQUIRED' });
  }

  // Simulated payments auto-approve — in production that would make every
  // purchase free, so without merchant credentials payments are off entirely.
  if (IS_PROD && !isQpayConfigured) {
    return res.status(503).json({ error: 'PAYMENTS_UNAVAILABLE' });
  }

  // The server prices subscriptions; only order invoices carry a client amount
  // (and the order endpoint re-verifies that against the catalog before
  // accepting the order).
  const monthCount = Math.min(Math.max(Math.trunc(Number(months) || 1), 1), 12);
  const chargeAmount = tier ? PLAN_PRICES[tier] * monthCount : Number(amount);
  if (!Number.isFinite(chargeAmount) || chargeAmount <= 0) {
    return res.status(400).json({ error: 'amount (number) is required' });
  }

  const intentFor = (invoiceId: string): PaymentIntent => ({
    invoiceId,
    userId,
    kind: tier ? 'plan' : 'order',
    tier,
    months: monthCount,
    amount: chargeAmount,
    status: 'pending',
  });

  // Simulated flow — no merchant credentials configured (dev/demo only).
  if (!isQpayConfigured) {
    const invoiceId = `SIM-${crypto.randomUUID()}`;
    simInvoices.set(invoiceId, { createdAt: Date.now(), paid: false });
    await saveIntent(intentFor(invoiceId));
    return res.json({
      simulated: true,
      invoiceId,
      amount: chargeAmount,
      qrImage: PLACEHOLDER_QR,
      qrText: `SIM|${invoiceId}|${chargeAmount}`,
      urls: [],
    });
  }

  // Real QPay v2 invoice.
  try {
    const token = await getQpayToken();
    const senderInvoiceNo = orderRef || `ZITY-${Date.now()}`;
    const body: Record<string, unknown> = {
      invoice_code: QPAY_INVOICE_CODE,
      sender_invoice_no: senderInvoiceNo,
      invoice_receiver_code: 'terminal',
      invoice_description: description,
      amount: chargeAmount,
    };
    if (QPAY_CALLBACK_URL) {
      body.callback_url = `${QPAY_CALLBACK_URL}?invoice=${encodeURIComponent(senderInvoiceNo)}`;
    }
    const r = await fetch(`${QPAY_BASE}/invoice`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await r.json()) as any;
    if (!r.ok) {
      console.error('[QPay create error]', data);
      return res.status(502).json({ error: 'QPay invoice creation failed', detail: data });
    }
    await saveIntent(intentFor(String(data.invoice_id)));
    return res.json({
      simulated: false,
      invoiceId: data.invoice_id,
      amount: chargeAmount,
      qrImage: data.qr_image ? `data:image/png;base64,${data.qr_image}` : null,
      qrText: data.qr_text,
      urls: data.urls || [],
    });
  } catch (err) {
    console.error('[QPay create exception]', err);
    return res.status(502).json({ error: 'QPay unavailable' });
  }
});

// ── POST /api/payments/qpay/check ─────────────────────────────────────────────
router.post('/qpay/check', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const { invoiceId } = req.body;
  if (!invoiceId) return res.status(400).json({ error: 'invoiceId is required' });
  const id = String(invoiceId);

  // Only the invoice's owner may poll it — checking used to be anonymous, so
  // anyone holding an invoice id could complete someone else's purchase flow.
  const intent = await getIntent(id);
  if (intent && intent.userId !== req.user?.id) {
    return res.status(403).json({ error: 'FORBIDDEN' });
  }

  // Simulated: auto-approve a couple of seconds after creation. Never valid in
  // production — see the guard in /qpay/create.
  if (!isQpayConfigured || id.startsWith('SIM-')) {
    if (IS_PROD) return res.status(503).json({ error: 'PAYMENTS_UNAVAILABLE' });
    const inv = simInvoices.get(id);
    if (!inv) return res.json({ paid: false, status: 'NOT_FOUND' });
    if (!inv.paid && Date.now() - inv.createdAt > 2500) inv.paid = true;
    const granted = inv.paid ? await settlePaidInvoice(id) : null;
    return res.json({ paid: inv.paid, status: inv.paid ? 'PAID' : 'PENDING', simulated: true, tier: granted });
  }

  try {
    const paid = await queryQpayPaid(id);
    const granted = paid ? await settlePaidInvoice(id) : null;
    return res.json({ paid, status: paid ? 'PAID' : 'PENDING', tier: granted });
  } catch (err) {
    console.error('[QPay check exception]', err);
    return res.status(502).json({ error: 'QPay unavailable' });
  }
});

// ── POST/GET /api/payments/qpay/callback ──────────────────────────────────────
// QPay calls this when an invoice is paid. The request itself proves nothing —
// the endpoint is public — so the payment is verified against QPay's own API
// before anything is granted. Idempotency comes from the pending→paid
// transition in settlePaidInvoice, so receiving it twice is safe.
router.all('/qpay/callback', async (req, res) => {
  const invoice = String(req.query.invoice || req.body?.invoice || req.body?.object_id || '');
  if (invoice && isQpayConfigured && !invoice.startsWith('SIM-')) {
    try {
      if (await queryQpayPaid(invoice)) {
        await settlePaidInvoice(invoice);
        console.log(`[QPay callback] invoice ${invoice} verified and settled`);
      }
    } catch (err) {
      // The poll from the client (/qpay/check) will settle it instead.
      console.error('[QPay callback] verification failed:', (err as Error).message);
    }
  }
  return res.json({ received: true });
});

// ── GET /api/payments/config ──────────────────────────────────────────────────
router.get('/config', (_req, res) => {
  res.json({ qpay: isQpayConfigured ? 'live' : 'simulated' });
});

export default router;
