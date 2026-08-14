import express from 'express';
import { authenticateToken, AuthenticatedRequest, isGuestId } from '../middleware/auth.js';
import { setSubscriptionTier, Tier } from '../lib/subscription.js';

const router = express.Router();

// ── QPay v2 configuration ─────────────────────────────────────────────────────
const QPAY_BASE = process.env.QPAY_BASE_URL || 'https://merchant.qpay.mn/v2';
const QPAY_USERNAME = process.env.QPAY_USERNAME || '';
const QPAY_PASSWORD = process.env.QPAY_PASSWORD || '';
const QPAY_INVOICE_CODE = process.env.QPAY_INVOICE_CODE || '';
const QPAY_CALLBACK_URL = process.env.QPAY_CALLBACK_URL || '';

export const isQpayConfigured = Boolean(QPAY_USERNAME && QPAY_PASSWORD && QPAY_INVOICE_CODE);

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

// ── Simulated invoice store (when QPay isn't configured) ──────────────────────
interface SimInvoice {
  amount: number;
  createdAt: number;
  paid: boolean;
}
const simInvoices = new Map<string, SimInvoice>();

/**
 * What each invoice is buying, and for whom. Without this the payment flow had
 * no way to grant anything: the client simply called setSubscription() locally,
 * so the tier lived in localStorage and anyone could award themselves Pro.
 */
interface PlanIntent {
  userId: string;
  tier: Tier;
  months: number;
}
const invoiceIntents = new Map<string, PlanIntent>();

function normalizePlan(value: unknown): Tier | null {
  return value === 'pro' || value === 'family' ? value : null;
}

/** Grants the purchased tier once, when a payment is confirmed. */
async function grantPurchasedTier(invoiceId: string): Promise<Tier | null> {
  const intent = invoiceIntents.get(invoiceId);
  if (!intent) return null;
  const ok = await setSubscriptionTier(intent.userId, intent.tier, intent.months);
  if (ok) {
    invoiceIntents.delete(invoiceId);
    console.log(`[payments] ${invoiceId}: granted ${intent.tier} to ${intent.userId}`);
    return intent.tier;
  }
  return null;
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
  if (!amount || typeof amount !== 'number') {
    return res.status(400).json({ error: 'amount (number) is required' });
  }

  // A subscription purchase must be tied to a real account, otherwise there is
  // nobody to upgrade when the payment lands.
  const tier = normalizePlan(plan);
  const userId = req.user?.id;
  if (tier && (!userId || isGuestId(userId))) {
    return res.status(401).json({ error: 'SIGN_IN_REQUIRED' });
  }
  const rememberIntent = (invoiceId: string) => {
    if (tier && userId) {
      invoiceIntents.set(invoiceId, { userId, tier, months: Number(months) || 1 });
    }
  };

  // Simulated flow — no merchant credentials configured.
  if (!isQpayConfigured) {
    const invoiceId = `SIM-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    simInvoices.set(invoiceId, { amount, createdAt: Date.now(), paid: false });
    rememberIntent(invoiceId);
    return res.json({
      simulated: true,
      invoiceId,
      qrImage: PLACEHOLDER_QR,
      qrText: `SIM|${invoiceId}|${amount}`,
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
      amount,
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
    rememberIntent(String(data.invoice_id));
    return res.json({
      simulated: false,
      invoiceId: data.invoice_id,
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
router.post('/qpay/check', async (req, res) => {
  const { invoiceId } = req.body;
  if (!invoiceId) return res.status(400).json({ error: 'invoiceId is required' });

  // Simulated: auto-approve a couple of seconds after creation.
  if (!isQpayConfigured || String(invoiceId).startsWith('SIM-')) {
    const inv = simInvoices.get(invoiceId);
    if (!inv) return res.json({ paid: false, status: 'NOT_FOUND' });
    if (!inv.paid && Date.now() - inv.createdAt > 2500) inv.paid = true;
    const granted = inv.paid ? await grantPurchasedTier(invoiceId) : null;
    return res.json({ paid: inv.paid, status: inv.paid ? 'PAID' : 'PENDING', simulated: true, tier: granted });
  }

  try {
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
    if (!r.ok) {
      console.error('[QPay check error]', data);
      return res.status(502).json({ error: 'QPay check failed' });
    }
    const paid = Number(data.paid_amount) > 0 || (Array.isArray(data.rows) && data.rows.length > 0);
    const granted = paid ? await grantPurchasedTier(String(invoiceId)) : null;
    return res.json({ paid, status: paid ? 'PAID' : 'PENDING', paidAmount: data.paid_amount, tier: granted });
  } catch (err) {
    console.error('[QPay check exception]', err);
    return res.status(502).json({ error: 'QPay unavailable' });
  }
});

// ── POST/GET /api/payments/qpay/callback ──────────────────────────────────────
// QPay calls this when an invoice is paid. Idempotent — safe to receive twice.
const processedCallbacks = new Set<string>();
router.all('/qpay/callback', async (req, res) => {
  const invoice = String(req.query.invoice || req.body?.invoice || req.body?.object_id || '');
  if (invoice && !processedCallbacks.has(invoice)) {
    processedCallbacks.add(invoice);
    await grantPurchasedTier(invoice);
    console.log(`[QPay callback] invoice ${invoice} processed`);
  }
  return res.json({ received: true });
});

// ── GET /api/payments/config ──────────────────────────────────────────────────
router.get('/config', (_req, res) => {
  res.json({ qpay: isQpayConfigured ? 'live' : 'simulated' });
});

export default router;
