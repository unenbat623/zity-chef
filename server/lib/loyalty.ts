import { supabaseAdmin } from '../supabase.js';

/**
 * Zity points, awarded when an order is actually delivered.
 *
 * The client used to ask for the points the moment checkout succeeded, which
 * meant a cancelled order still earned them — and the app's own copy promised
 * points "for every delivered order". Doing it here, from the delivered
 * transition, makes the promise true and takes the award out of the browser's
 * hands entirely.
 *
 * The ledger's UNIQUE(order_id) is what keeps a replayed delivery from paying
 * twice; this only ever reads the amount from the order itself.
 */
export function pointsForAmount(amount: unknown): number | null {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.max(1, Math.round(value * 0.01));
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function awardPointsForOrder(orderKey: string): Promise<number> {
  if (!supabaseAdmin) return 0;

  const query = supabaseAdmin.from('orders').select('id,user_id,order_ref,total_amount,status');
  const { data: order, error } = await (
    UUID_RE.test(orderKey)
      ? query.or(`id.eq.${orderKey},order_ref.eq.${orderKey}`)
      : query.eq('order_ref', orderKey)
  ).maybeSingle();
  if (error) throw new Error(error.message);
  if (!order) return 0;

  const points = pointsForAmount(order.total_amount);
  if (points === null) return 0;

  const { error: insertError } = await supabaseAdmin.from('zity_points_ledger').insert({
    user_id: order.user_id,
    order_id: order.id,
    order_ref: order.order_ref,
    amount: Number(order.total_amount),
    points,
  });

  // 23505 is the unique violation on order_id: this order has already paid out.
  if (insertError) {
    if (insertError.code === '23505') return 0;
    throw new Error(insertError.message);
  }
  return points;
}

/**
 * One point is one tugrik off an order.
 *
 * A basket may not be settled entirely with points: an invoice for nothing is
 * not something QPay can raise, and a payment record is what ties an order to
 * its money. `MIN_PAYABLE` is what has to stay chargeable.
 */
export const POINT_VALUE_MNT = 1;
export const MIN_PAYABLE_MNT = 1000;

/** The most this basket may have taken off it, given a balance. */
export function maxRedeemablePoints(orderTotal: number, balance: number): number {
  const spendable = Math.max(0, Math.floor((orderTotal - MIN_PAYABLE_MNT) / POINT_VALUE_MNT));
  return Math.max(0, Math.min(Math.floor(balance), spendable));
}

/** Earned minus spent. */
export async function pointsBalance(userId: string): Promise<number> {
  if (!supabaseAdmin) return 0;
  const [earnedRes, spentRes] = await Promise.all([
    supabaseAdmin.from('zity_points_ledger').select('points').eq('user_id', userId),
    supabaseAdmin.from('zity_points_redemptions').select('points').eq('user_id', userId),
  ]);
  if (earnedRes.error) throw new Error(earnedRes.error.message);
  // A deployment that has not run the redemption migration has nothing spent.
  const earned = (earnedRes.data || []).reduce((sum, row: any) => sum + Number(row.points || 0), 0);
  const spent = (spentRes.data || []).reduce((sum, row: any) => sum + Number(row.points || 0), 0);
  return Math.max(0, earned - spent);
}

/**
 * Spends points against an order. Returns how many were actually taken — zero
 * when the balance could not cover it, so the caller charges the full amount
 * rather than an order silently costing the shop money.
 */
export async function reservePointsForCheckout(
  userId: string,
  points: number
): Promise<{ points: number; redemptionId: string | null }> {
  if (!supabaseAdmin || points <= 0) return { points: 0, redemptionId: null };
  const { data, error } = await supabaseAdmin.rpc('redeem_zity_points', {
    p_user: userId,
    p_order: null,
    p_points: Math.floor(points),
  });
  if (error) {
    // Missing function: the migration has not run. Charging full price is the
    // safe failure here.
    if (error.message.includes('redeem_zity_points')) {
      console.warn('[loyalty] redemption unavailable — run npm run db:push');
      return { points: 0, redemptionId: null };
    }
    throw new Error(error.message);
  }
  const row = Array.isArray(data) ? data[0] : data;
  return row?.ok
    ? { points: Math.floor(points), redemptionId: String(row.redemption_id) }
    : { points: 0, redemptionId: null };
}

/** Ties a reserved redemption to the order it paid for. */
export async function attachRedemptionToOrder(
  redemptionId: string,
  orderId: string
): Promise<void> {
  if (!supabaseAdmin) return;
  const { error } = await supabaseAdmin
    .from('zity_points_redemptions')
    .update({ order_id: orderId })
    .eq('id', redemptionId);
  if (error) console.error('[loyalty] could not link redemption:', error.message);
}

/** Gives reserved points back when the checkout they were held for fails. */
export async function releaseReservedPoints(redemptionId: string): Promise<void> {
  if (!supabaseAdmin) return;
  const { error } = await supabaseAdmin
    .from('zity_points_redemptions')
    .delete()
    .eq('id', redemptionId);
  if (error) console.error('[loyalty] could not release points:', error.message);
}

/** Returns the points a cancelled order had spent. */
export async function refundPointsForOrder(orderId: string): Promise<number> {
  if (!supabaseAdmin) return 0;
  const { data, error } = await supabaseAdmin
    .from('zity_points_redemptions')
    .delete()
    .eq('order_id', orderId)
    .select('points');
  if (error) {
    console.error('[loyalty] could not refund points:', error.message);
    return 0;
  }
  return (data || []).reduce((sum, row: any) => sum + Number(row.points || 0), 0);
}
