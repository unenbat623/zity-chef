import express from 'express';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth.js';
import { supabaseAdmin, isSupabaseConfigured } from '../supabase.js';

const router = express.Router();
router.use(authenticateToken);

const memoryOrders = new Map<string, any[]>();

// ── GET /api/orders ─────────────────────────────────────────────────────────
router.get('/', async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id || 'guest-user-00000000-0000-0000-0000-000000000000';

  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin
        .from('orders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        return res.json({ orders: data, source: 'supabase' });
      }
    } catch (err) {
      console.error('[Supabase Orders Fetch Error]', err);
    }
  }

  const orders = memoryOrders.get(userId) || [];
  return res.json({ orders, source: 'memory' });
});

// ── POST /api/orders ────────────────────────────────────────────────────────
router.post('/', async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id || 'guest-user-00000000-0000-0000-0000-000000000000';
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

  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      await supabaseAdmin.from('orders').insert({
        user_id: userId,
        order_ref: orderRecord.id,
        items_snapshot: orderRecord.items,
        total_amount: orderRecord.totalAmount,
        delivery_address: orderRecord.address,
        payment_method: orderRecord.paymentMethod,
        status: 'paid',
      });
    } catch (err) {
      console.error('[Supabase Order Create Error]', err);
    }
  }

  const existing = memoryOrders.get(userId) || [];
  memoryOrders.set(userId, [orderRecord, ...existing]);
  return res.status(201).json({ order: orderRecord });
});

export default router;
