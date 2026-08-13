import express from 'express';
import { AuthenticatedRequest, authenticateToken, GUEST_ID } from '../middleware/auth.js';
import { isSupabaseConfigured, getSupabaseForUser } from '../supabase.js';

const router = express.Router();
router.use(authenticateToken);

const memoryOrders = new Map<string, any[]>();

function usesDb(req: AuthenticatedRequest): boolean {
  return Boolean(isSupabaseConfigured && req.accessToken && req.user?.id !== GUEST_ID);
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
  const { items, totalAmount, deliveryAddress, paymentMethod = 'qpay' } = req.body;

  const orderRecord = {
    id: `ZITY-${Math.floor(100000 + Math.random() * 900000)}`,
    items: items || [],
    totalAmount: totalAmount || 0,
    address: deliveryAddress || 'Улаанбаатар, Сүхбаатар дүүрэг',
    status: 'paid',
    paymentMethod,
    createdAt: new Date().toLocaleDateString('mn-MN'),
  };

  if (usesDb(req)) {
    const db = getSupabaseForUser(req.accessToken!);
    const { data, error } = await db
      .from('orders')
      .insert({
        user_id: userId,
        order_ref: orderRecord.id,
        items_snapshot: orderRecord.items,
        total_amount: orderRecord.totalAmount,
        delivery_address: orderRecord.address,
        payment_method: orderRecord.paymentMethod,
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

  const existing = memoryOrders.get(userId) || [];
  memoryOrders.set(userId, [orderRecord, ...existing]);
  return res.status(201).json({ order: orderRecord, source: 'memory' });
});

export default router;
