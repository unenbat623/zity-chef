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

/**
 * Asks QPay itself whether an invoice has been paid. The callback body is
 * never trusted — anyone can POST to the callback URL.
 *
 * Returns the settling payment's id alongside the verdict. Refunds are issued
 * against a payment id, not an invoice id, and this response is the only place
 * QPay hands it to us: discarding it (as this used to) left a paid order with
 * no way to ever return the money automatically.
 */
async function queryQpayPaid(
  invoiceId: string
): Promise<{ paid: boolean; paymentId: string; paidAmount: number }> {
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

  const rows: any[] = Array.isArray(data.rows) ? data.rows : [];
  const paidAmount = Number(data.paid_amount) || 0;
  // A part-paid invoice can carry several rows; the refund targets the one that
  // actually settled it, so prefer a PAID row over whatever happens to be first.
  const settling =
    rows.find((row) => String(row?.payment_status || '').toUpperCase() === 'PAID') || rows[0];

  return {
    paid: paidAmount > 0 || rows.length > 0,
    paymentId: String(settling?.payment_id || ''),
    paidAmount: paidAmount || Number(settling?.payment_amount) || 0,
  };
}

/**
 * Whether QPay has collected the whole invoice.
 *
 * "Any payment at all" used to count as settled, so a part payment bought a
 * full order or a subscription. The intent knows what the invoice was for, so
 * the amount is checked against it; an invoice we have no intent for keeps the
 * old behaviour, since there is nothing to compare against.
 */
async function isFullySettled(
  invoiceId: string,
  check: { paid: boolean; paidAmount: number }
): Promise<boolean> {
  if (!check.paid) return false;
  const intent = await getIntent(invoiceId);
  const expected = intent ? Math.round(intent.amount) : 0;
  if (expected <= 0) return true;
  if (Math.round(check.paidAmount) >= expected) return true;
  console.warn(
    `[QPay] invoice ${invoiceId} underpaid: ${Math.round(check.paidAmount)} of ${expected}`
  );
  return false;
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
 *  purchases, grants the tier. Returns the granted tier, if any.
 *
 *  `qpayPaymentId` is stored on the way through — it is the only handle a
 *  later refund has on the money, and it is unavailable anywhere else. */
async function settlePaidInvoice(invoiceId: string, qpayPaymentId = ''): Promise<Tier | null> {
  const intent = await markIntentPaid(invoiceId);
  if (!intent) return null;
  if (qpayPaymentId && supabaseAdmin) {
    const { error } = await supabaseAdmin
      .from('payment_intents')
      .update({ qpay_payment_id: qpayPaymentId })
      .eq('invoice_id', invoiceId);
    if (error) {
      // Not fatal to the purchase, but it costs the automatic refund later.
      console.error(`[payments] ${invoiceId}: could not store QPay payment id:`, error.message);
    }
  }
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

  // Every purchase must be tied to a real, recoverable account.
  // `isGuestId` alone is not enough: an anonymous Supabase user carries a real
  // uuid, so they passed this check and could buy a plan attached to a session
  // they can never sign back into — the tier would be paid for and then lost.
  //
  // The same was true of grocery orders, and worse: a guest could pay for a
  // basket and then have the order filed into per-instance memory, with no
  // payment verification, no delivery, no Odoo, and nothing left after a
  // restart. Real money, no order. Both kinds of invoice now need an account.
  if (isGuestId(userId) || req.user?.isAnonymous) {
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
    // QPay requires `sender_invoice_no` to be unique for the merchant. A
    // millisecond timestamp is not: two checkouts in the same tick collide and
    // QPay rejects the second one. A random suffix removes that entirely.
    const senderInvoiceNo =
      String(orderRef || '').trim() || `ZITY-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
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
      // Logged in full, but not returned: QPay's error body carries merchant
      // and terminal details that have no business reaching a browser.
      console.error('[QPay create error]', data);
      return res.status(502).json({
        error: 'QPay invoice creation failed',
        ...(IS_PROD ? {} : { detail: data }),
      });
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
    return res.json({
      paid: inv.paid,
      status: inv.paid ? 'PAID' : 'PENDING',
      simulated: true,
      tier: granted,
    });
  }

  try {
    const check = await queryQpayPaid(id);
    const settled = await isFullySettled(id, check);
    const granted = settled ? await settlePaidInvoice(id, check.paymentId) : null;
    return res.json({
      paid: settled,
      // A part payment is neither paid nor still pending — say so, rather than
      // letting the client wait for a completion that has already happened.
      status: settled ? 'PAID' : check.paid ? 'PARTIAL' : 'PENDING',
      tier: granted,
    });
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
      const check = await queryQpayPaid(invoice);
      if (await isFullySettled(invoice, check)) {
        await settlePaidInvoice(invoice, check.paymentId);
        console.log(`[QPay callback] invoice ${invoice} verified and settled`);
      }
    } catch (err) {
      // The poll from the client (/qpay/check) will settle it instead.
      console.error('[QPay callback] verification failed:', (err as Error).message);
    }
  }
  return res.json({ received: true });
});

// ── Refunds ───────────────────────────────────────────────────────────────────

/**
 * What happened to a refund attempt.
 *
 * `manual` is the important one: it means the money has NOT moved and a person
 * has to move it. The cancellation still succeeds — refusing to cancel because
 * a gateway cannot be reached would be worse — but the obligation is recorded
 * rather than swallowed. Nothing here ever reports success it did not get from
 * the gateway.
 */
export type RefundOutcome = {
  status: 'refunded' | 'manual' | 'failed' | 'already';
  reason: string;
  refundRef?: string;
};

/**
 * QPay v2 refunds a payment with `DELETE /payment/refund/{payment_id}`.
 *
 * This path has not been exercised against the live merchant API — there are no
 * credentials yet, and a refund cannot be rehearsed without a real payment to
 * reverse. The first production cancellation is the real test; if QPay answers
 * with something other than success the refund is recorded as `failed` and is
 * retryable from `POST /api/payments/refunds/:invoiceId/retry`, so nothing is
 * lost either way.
 */
async function qpayRefund(paymentId: string, note: string): Promise<string> {
  const token = await getQpayToken();
  const r = await fetch(`${QPAY_BASE}/payment/refund/${encodeURIComponent(paymentId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_url: QPAY_CALLBACK_URL || undefined,
      note: note.slice(0, 100),
    }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`QPay refund ${r.status}: ${text.slice(0, 200)}`);
  try {
    const data = JSON.parse(text || '{}');
    return String(data.refund_id || data.payment_id || paymentId);
  } catch {
    return paymentId;
  }
}

/**
 * Returns the money for a cancelled order, at most once.
 *
 * Idempotency is the conditional UPDATE that claims the refund: only a row
 * whose `refund_status` is still null (or a previous `failed`, which is
 * retryable) transitions to `pending`, so two cancellations racing — the
 * customer's and an admin's — cannot refund twice.
 *
 * Callers must not let this throw a cancellation: the order is already
 * cancelled by the time we get here, and an unreachable gateway must leave a
 * recorded obligation, not an exception.
 */
export async function refundOrderPayment(params: {
  invoiceId: string;
  amount?: number;
  reason?: string;
}): Promise<RefundOutcome> {
  const invoiceId = String(params.invoiceId || '').trim();
  const reason = params.reason || 'Order cancelled';
  if (!invoiceId) return { status: 'manual', reason: 'No payment invoice recorded on the order' };
  if (!supabaseAdmin) return { status: 'manual', reason: 'Supabase admin is not configured' };

  const intent = await getIntent(invoiceId);
  if (!intent) return { status: 'manual', reason: `No payment intent for invoice ${invoiceId}` };
  if (intent.status === 'pending') {
    // Never paid, so there is nothing to send back.
    return { status: 'already', reason: 'Invoice was never paid' };
  }

  // Claim the refund. `.is('refund_status', null)` and a retry of a previous
  // failure are the only two states allowed to proceed.
  const claim = await supabaseAdmin
    .from('payment_intents')
    .update({
      refund_status: 'pending',
      refund_amount: Math.round(Number(params.amount ?? intent.amount)),
      refund_reason: reason.slice(0, 200),
      refund_attempted_at: new Date().toISOString(),
      refund_error: null,
    })
    .eq('invoice_id', invoiceId)
    .or('refund_status.is.null,refund_status.eq.failed')
    .select('invoice_id,qpay_payment_id,refund_amount')
    .maybeSingle();

  if (claim.error) {
    console.error(`[refund] ${invoiceId}: claim failed:`, claim.error.message);
    return { status: 'failed', reason: claim.error.message };
  }
  if (!claim.data) {
    // Someone else already refunded it, or it is awaiting a human.
    return { status: 'already', reason: 'Refund already recorded for this payment' };
  }

  const paymentId = String((claim.data as any).qpay_payment_id || '');
  const amount = Number((claim.data as any).refund_amount || 0);

  const settle = async (patch: Record<string, unknown>) => {
    await supabaseAdmin!.from('payment_intents').update(patch).eq('invoice_id', invoiceId);
  };

  // Simulated mode collected no money, so there is none to send back — but say
  // so explicitly rather than reporting a refund that never happened.
  if (!isQpayConfigured) {
    const why = 'QPay is in simulated mode — no money was collected to refund';
    await settle({ refund_status: 'manual', refund_error: why });
    return { status: 'manual', reason: why };
  }
  if (!paymentId) {
    const why =
      'No QPay payment id recorded for this invoice — refund it from the QPay merchant console';
    await settle({ refund_status: 'manual', refund_error: why });
    return { status: 'manual', reason: why };
  }

  try {
    const refundRef = await qpayRefund(paymentId, reason);
    await settle({
      refund_status: 'refunded',
      refund_ref: refundRef,
      refunded_at: new Date().toISOString(),
      refund_error: null,
    });
    console.log(`[refund] ${invoiceId}: ${amount}₮ returned (ref ${refundRef})`);
    return { status: 'refunded', reason: `Refunded ${amount}`, refundRef };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'QPay refund failed';
    // Left as `failed`, which the claim above lets a retry pick up again.
    await settle({ refund_status: 'failed', refund_error: message.slice(0, 500) });
    console.error(`[refund] ${invoiceId}: ${message}`);
    return { status: 'failed', reason: message };
  }
}

// ── GET /api/payments/refunds/outstanding ─────────────────────────────────────
// Every refund that did not complete on its own. A `manual` row is money the
// business still owes a customer, so it needs somewhere to be seen.
router.get('/refunds/outstanding', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const admins = (process.env.CHEF_ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (!admins.includes((req.user?.email || '').toLowerCase())) {
    return res.status(403).json({ ok: false, message: 'CHEF_ADMIN_REQUIRED' });
  }
  if (!supabaseAdmin) {
    return res.status(503).json({ ok: false, message: 'Supabase admin is not configured' });
  }

  const { data, error } = await supabaseAdmin
    .from('payment_intents')
    .select(
      'invoice_id,user_id,amount,refund_status,refund_amount,refund_error,refund_reason,refund_attempted_at,qpay_payment_id'
    )
    .in('refund_status', ['pending', 'manual', 'failed'])
    .order('refund_attempted_at', { ascending: false })
    .limit(200);
  if (error) {
    console.error('[refund] outstanding lookup failed:', error.message);
    return res.status(502).json({ ok: false, message: 'Failed to load refunds' });
  }

  return res.json({
    ok: true,
    refunds: (data || []).map((row: any) => ({
      invoiceId: row.invoice_id,
      userId: row.user_id,
      amount: Number(row.refund_amount ?? row.amount ?? 0),
      status: row.refund_status,
      reason: row.refund_reason || '',
      error: row.refund_error || '',
      attemptedAt: row.refund_attempted_at,
      hasGatewayPaymentId: Boolean(row.qpay_payment_id),
    })),
  });
});

// ── POST /api/payments/refunds/:invoiceId/retry ───────────────────────────────
// Retries a `failed` refund. A `manual` one stays manual by design — retrying
// it would just fail the same way, and the point is that a human acts on it.
router.post(
  '/refunds/:invoiceId/retry',
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    const admins = (process.env.CHEF_ADMIN_EMAILS || '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
    if (!admins.includes((req.user?.email || '').toLowerCase())) {
      return res.status(403).json({ ok: false, message: 'CHEF_ADMIN_REQUIRED' });
    }
    const outcome = await refundOrderPayment({
      invoiceId: String(req.params.invoiceId || ''),
      reason: 'Manual retry',
    });
    return res.status(outcome.status === 'failed' ? 502 : 200).json({ ok: true, ...outcome });
  }
);

// ── GET /api/payments/config ──────────────────────────────────────────────────
router.get('/config', (_req, res) => {
  res.json({ qpay: isQpayConfigured ? 'live' : 'simulated' });
});

export default router;
