import express from 'express';
import { AuthenticatedRequest, authenticateToken, isGuestId } from '../middleware/auth.js';
import { isSupabaseConfigured, getSupabaseForUser } from '../supabase.js';
import { consumePaidOrderIntent } from './payments.js';

const router = express.Router();
router.use(authenticateToken);

const memoryOrders = new Map<string, any[]>();

function usesDb(req: AuthenticatedRequest): boolean {
  return Boolean(isSupabaseConfigured && req.accessToken && !isGuestId(req.user?.id));
}

function rowToOrder(r: Record<string, unknown>) {
  return {
    id: (r.order_ref as string) || String(r.id),
    items: (r.items_snapshot as unknown[]) || [],
    totalAmount: Number(r.total_amount ?? 0),
    address: (r.delivery_address as string) || '',
    status: (r.status as string) || 'paid',
    paymentMethod: (r.payment_method as string) || 'qpay',
    createdAt: r.created_at
      ? new Date(String(r.created_at)).toLocaleDateString('mn-MN')
      : new Date().toLocaleDateString('mn-MN'),
  };
}

// ── GET /api/orders ─────────────────────────────────────────────────────────
router.get('/', async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;

  if (usesDb(req)) {
    const db = getSupabaseForUser(req.accessToken!);
    const { data, error } = await db
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[Supabase Orders Fetch Error]', error.message);
      return res.status(502).json({ error: 'Failed to load orders' });
    }
    return res.json({ orders: (data || []).map(rowToOrder), source: 'supabase' });
  }

  const orders = memoryOrders.get(userId) || [];
  return res.json({ orders, source: 'memory' });
});

// ── POST /api/orders ────────────────────────────────────────────────────────
router.post('/', async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { items, totalAmount, deliveryAddress, paymentMethod = 'qpay', invoiceId } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'EMPTY_ORDER' });
  }

  if (usesDb(req)) {
    const db = getSupabaseForUser(req.accessToken!);

    // The catalog prices the order — the client's totals are advisory only.
    // Anything not in the catalog can't be bought, and a tampered price simply
    // won't match the paid invoice below.
    // Empty ids (a stale cart from before productId existed) must not reach
    // the uuid column — they'd be a Postgres type error instead of a 400.
    const ids = [...new Set(items.map((i: any) => String(i?.productId ?? '')).filter(Boolean))];
    if (ids.length === 0) return res.status(400).json({ error: 'INVALID_ITEMS' });
    const { data: products, error: perr } = await db
      .from('store_products')
      .select('id,name,emoji,unit,price_per_unit')
      .in('id', ids);
    if (perr) {
      console.error('[Supabase Order Price Lookup Error]', perr.message);
      return res.status(502).json({ error: 'Failed to create order' });
    }
    const byId = new Map((products || []).map((p) => [String(p.id), p]));

    const canonicalItems: any[] = [];
    for (const item of items) {
      const product = byId.get(String((item as any)?.productId ?? ''));
      const quantity = Number((item as any)?.quantity);
      if (!product || !Number.isFinite(quantity) || quantity <= 0 || quantity > 999) {
        return res.status(400).json({ error: 'INVALID_ITEMS' });
      }
      const pricePerUnit = Number(product.price_per_unit) || 0;
      canonicalItems.push({
        id: String(product.id),
        name: product.name,
        emoji: product.emoji,
        unit: product.unit,
        quantity,
        pricePerUnit,
        totalPrice: Math.round(pricePerUnit * quantity),
      });
    }
    const total = canonicalItems.reduce((sum, i) => sum + i.totalPrice, 0);

    // An order is only "paid" when a verified invoice for exactly this amount
    // is consumed. Orders used to be inserted as paid with whatever total the
    // client claimed, with no payment behind them at all.
    const settled = await consumePaidOrderIntent(String(invoiceId || ''), userId, total);
    if (!settled) {
      return res.status(402).json({ error: 'PAYMENT_REQUIRED' });
    }

    const orderRef = `ZITY-${Math.floor(100000 + Math.random() * 900000)}`;
    const { data, error } = await db
      .from('orders')
      .insert({
        user_id: userId,
        order_ref: orderRef,
        items_snapshot: canonicalItems,
        total_amount: total,
        delivery_address: deliveryAddress || '',
        payment_method: paymentMethod === 'socialpay' || paymentMethod === 'card' ? paymentMethod : 'qpay',
        status: 'paid',
      })
      .select()
      .single();
    if (error) {
      console.error('[Supabase Order Create Error]', error.message);
      return res.status(502).json({ error: 'Failed to create order' });
    }
    return res.status(201).json({ order: rowToOrder(data), source: 'supabase' });
  }

  // Guest / demo mode: per-instance memory, no real payment to verify.
  const orderRecord = {
    id: `ZITY-${Math.floor(100000 + Math.random() * 900000)}`,
    items: items || [],
    totalAmount: Number(totalAmount) || 0,
    address: deliveryAddress || 'Улаанбаатар, Сүхбаатар дүүрэг',
    status: 'paid',
    paymentMethod,
    createdAt: new Date().toLocaleDateString('mn-MN'),
  };
  const existing = memoryOrders.get(userId) || [];
  memoryOrders.set(userId, [orderRecord, ...existing]);
  return res.status(201).json({ order: orderRecord, source: 'memory' });
});

export default router;
