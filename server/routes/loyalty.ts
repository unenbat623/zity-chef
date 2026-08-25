import express from 'express';
import { AuthenticatedRequest, authenticateToken, requireSignedIn } from '../middleware/auth.js';
import { isSupabaseConfigured, supabaseAdmin } from '../supabase.js';
import { pointsBalance } from '../lib/loyalty.js';

const router = express.Router();
router.use(authenticateToken, requireSignedIn);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const memoryLedger = new Map<string, Map<string, number>>();

function pointsForAmount(amount: unknown): number | null {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.max(1, Math.round(value * 0.01));
}

async function dbBalance(userId: string): Promise<number> {
  // Earned minus redeemed: reading only the earning ledger reported points the
  // customer had already spent.
  return pointsBalance(userId);
}

router.get('/points', async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      return res.json({ balance: await dbBalance(userId) });
    } catch {
      return res.status(502).json({ error: 'Failed to load points' });
    }
  }

  const entries = memoryLedger.get(userId);
  const balance = entries
    ? Array.from(entries.values()).reduce((sum, points) => sum + points, 0)
    : 0;
  return res.json({ balance });
});

/**
 * What the points were earned on.
 *
 * The balance alone told a customer a number with no story behind it; the
 * ledger has carried the detail from the start with nothing reading it.
 */
router.get('/history', async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  if (!isSupabaseConfigured || !supabaseAdmin) return res.json({ entries: [] });

  const { data, error } = await supabaseAdmin
    .from('zity_points_ledger')
    .select('id,order_ref,amount,points,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) {
    console.error('[loyalty] history failed:', error.message);
    return res.status(502).json({ error: 'Failed to load points history' });
  }

  return res.json({
    entries: (data || []).map((row: any) => ({
      id: String(row.id),
      orderRef: String(row.order_ref || ''),
      amount: Number(row.amount || 0),
      points: Number(row.points || 0),
      earnedAt: row.created_at,
    })),
  });
});

router.post('/points', async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { orderId, chefOrderRef, amount } = req.body || {};
  const orderKey = String(orderId || chefOrderRef || '').trim();
  if (!orderKey || pointsForAmount(amount) === null) {
    return res.status(400).json({ error: 'INVALID_POINTS_REQUEST' });
  }

  if (isSupabaseConfigured && supabaseAdmin) {
    const orderQuery = supabaseAdmin
      .from('orders')
      .select('id,order_ref,total_amount,status,user_id')
      .eq('user_id', userId);
    const { data: order, error: orderError } = await (
      UUID_RE.test(orderKey)
        ? orderQuery.or(`id.eq.${orderKey},order_ref.eq.${orderKey}`)
        : orderQuery.eq('order_ref', orderKey)
    ).maybeSingle();

    if (orderError) {
      console.error('[loyalty] order lookup failed:', orderError.message);
      return res.status(502).json({ error: 'Failed to award points' });
    }
    if (!order) return res.status(404).json({ error: 'ORDER_NOT_FOUND' });

    const points = pointsForAmount(order.total_amount);
    if (points === null) return res.status(400).json({ error: 'INVALID_ORDER_AMOUNT' });

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('zity_points_ledger')
      .select('points')
      .eq('user_id', userId)
      .eq('order_id', order.id)
      .maybeSingle();
    if (existingError) {
      console.error('[loyalty] existing lookup failed:', existingError.message);
      return res.status(502).json({ error: 'Failed to award points' });
    }

    if (!existing) {
      const { error: insertError } = await supabaseAdmin.from('zity_points_ledger').insert({
        user_id: userId,
        order_id: order.id,
        order_ref: chefOrderRef || order.order_ref,
        amount: Number(order.total_amount),
        points,
      });
      if (insertError && insertError.code !== '23505') {
        console.error('[loyalty] insert failed:', insertError.message);
        return res.status(502).json({ error: 'Failed to award points' });
      }
    }

    return res.json({ awarded: existing ? 0 : points, balance: await dbBalance(userId) });
  }

  const points = pointsForAmount(amount)!;
  const entries = memoryLedger.get(userId) || new Map<string, number>();
  const alreadyAwarded = entries.has(orderKey);
  if (!alreadyAwarded) entries.set(orderKey, points);
  memoryLedger.set(userId, entries);
  const balance = Array.from(entries.values()).reduce((sum, value) => sum + value, 0);
  return res.json({ awarded: alreadyAwarded ? 0 : points, balance });
});

export default router;
