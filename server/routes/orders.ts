import express from 'express';
import {
  AuthenticatedRequest,
  authenticateToken,
  isGuestId,
  requireSignedIn,
} from '../middleware/auth.js';
import { isSupabaseConfigured, getSupabaseForUser, supabaseAdmin } from '../supabase.js';
import { releaseStock, reserveStock } from '../lib/stock.js';
import { consumePaidOrderIntent } from './payments.js';
import { computeDiscount, deliveryFeeFor, resolveCoupon } from './store.js';
import { cancelChefOrderInOdoo, syncChefOrderToOdoo } from './odoo.js';
import {
  attachRedemptionToOrder,
  maxRedeemablePoints,
  pointsBalance,
  refundPointsForOrder,
  releaseReservedPoints,
  reservePointsForCheckout,
} from '../lib/loyalty.js';
import { refundOrderPayment } from './payments.js';

const router = express.Router();
router.use(authenticateToken);

const memoryOrders = new Map<string, any[]>();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * The catalog id on a cart line.
 *
 * Two clients post here and they disagree on the field name: the Chef app sends
 * `productId`, the Delguur storefront sends `id`. Reading only `productId` meant
 * every Delguur order was rejected before it reached the catalog, which is why
 * none of them ever appeared in the database. Both spellings are accepted, so
 * storefront builds already in the wild start working without an app update.
 */
function cartItemId(item: unknown): string {
  const line = (item || {}) as { productId?: unknown; id?: unknown };
  return String(line.productId ?? line.id ?? '').trim();
}
const ODOO_AUTO_SYNC_ORDERS =
  process.env.ODOO_AUTO_SYNC_ORDERS === 'true' &&
  Boolean(
    process.env.ODOO_URL &&
    process.env.ODOO_DB &&
    process.env.ODOO_USERNAME &&
    process.env.ODOO_API_KEY
  );

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
    odooOrderRef: (r.odoo_order_ref as string) || '',
    odooSyncError: (r.odoo_sync_error as string) || '',
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
    // Every order the account has ever placed used to come back on every poll —
    // a list that only grows, fetched every fifteen seconds.
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const { data, error } = await db
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) {
      console.error('[Supabase Orders Fetch Error]', error.message);
      return res.status(502).json({ error: 'Failed to load orders' });
    }
    const orders = (data || []).map(rowToOrder);
    return res.json({
      orders,
      source: 'supabase',
      hasMore: orders.length === limit,
      nextOffset: offset + orders.length,
    });
  }

  const orders = memoryOrders.get(userId) || [];
  return res.json({ orders, source: 'memory' });
});

// ── POST /api/orders ────────────────────────────────────────────────────────
router.post('/', async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const {
    items,
    totalAmount,
    deliveryAddress,
    paymentMethod = 'qpay',
    invoiceId,
    redeemPoints,
    deliveryMode = 'delivery',
    couponCode,
  } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'EMPTY_ORDER' });
  }

  if (usesDb(req)) {
    const db = getSupabaseForUser(req.accessToken!);

    // The catalog prices the order — the client's totals are advisory only.
    // Anything not in the catalog can't be bought, and a tampered price simply
    // won't match the paid invoice below.
    // Nothing that is not a uuid may reach the uuid column — Postgres rejects
    // the whole query with a type error, which used to surface as a 502 saying
    // the server failed. Empty ids are not the only way to get there: the
    // offline fallback catalog ships placeholder ids like "p1", so a cart built
    // while the backend was unreachable lands here too. Both are bad requests.
    const requestedIds = items.map((i: any) => cartItemId(i));
    if (requestedIds.length === 0 || !requestedIds.every((id: string) => UUID_RE.test(id))) {
      return res.status(400).json({ error: 'STALE_CART' });
    }
    const ids = [...new Set(requestedIds)];
    let productsRes: any = await db
      .from('store_products')
      .select('id,name,emoji,unit,price_per_unit,sku,odoo_product_id,odoo_product_sku')
      .in('id', ids);
    if (productsRes.error && productsRes.error.message.includes('odoo_product')) {
      productsRes = await db
        .from('store_products')
        .select('id,name,emoji,unit,price_per_unit,sku')
        .in('id', ids);
    }
    const { data: products, error: perr } = productsRes;
    if (perr) {
      console.error('[Supabase Order Price Lookup Error]', perr.message);
      return res.status(502).json({ error: 'Failed to create order' });
    }
    const byId = new Map<string, any>((products || []).map((p: any) => [String(p.id), p]));

    const canonicalItems: any[] = [];
    for (const item of items) {
      const product = byId.get(cartItemId(item));
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
        sku: product.sku || null,
        odooProductId: product.odoo_product_id || null,
        odooSku: product.odoo_product_sku || product.sku || null,
        quantity,
        pricePerUnit,
        totalPrice: Math.round(pricePerUnit * quantity),
      });
    }
    // The shopper is charged items − coupon + delivery. Validating the payment
    // against the item subtotal alone rejected every order carrying either: the
    // invoice said 49,000 while this said 44,000, so a basket the customer had
    // already paid for came back as 402 PAYMENT_REQUIRED. Checkout's own helpers
    // are used here so the quoted price and the charged price cannot drift.
    const subtotal = canonicalItems.reduce((sum, i) => sum + i.totalPrice, 0);
    const coupon = await resolveCoupon(db, couponCode, subtotal);
    const discountAmount = computeDiscount(coupon, subtotal);
    const deliveryFee = deliveryFeeFor(String(deliveryMode), subtotal - discountAmount);
    const total = Math.max(0, subtotal - discountAmount + deliveryFee);

    // Stock comes out of the catalog before the payment intent is consumed, so
    // a basket that can no longer be filled leaves the paid invoice untouched
    // and refundable instead of being spent on an order that cannot ship.
    let short: { name: string; available: number } | null = null;
    try {
      short = await reserveStock(
        canonicalItems.map((item) => ({ id: item.id, quantity: item.quantity }))
      );
    } catch (err) {
      console.error('[Supabase Stock Reserve Error]', (err as Error).message);
      return res.status(502).json({ error: 'Failed to create order' });
    }
    if (short) {
      return res.status(409).json({
        error: 'OUT_OF_STOCK',
        product: short.name,
        available: short.available,
      });
    }

    // Zity points come off before the money does. They are taken from the
    // balance first — two baskets checking out at once must not spend the same
    // points — and handed back below if anything after this fails.
    const requestedPoints = Math.max(0, Math.floor(Number(redeemPoints) || 0));
    let redemption: { points: number; redemptionId: string | null } = {
      points: 0,
      redemptionId: null,
    };
    if (requestedPoints > 0) {
      const balance = await pointsBalance(userId);
      const allowed = maxRedeemablePoints(total, Math.min(balance, requestedPoints));
      if (allowed > 0) redemption = await reservePointsForCheckout(userId, allowed);
    }
    const chargeable = total - redemption.points;

    // An order is only "paid" when a verified invoice for exactly this amount
    // is consumed. Orders used to be inserted as paid with whatever total the
    // client claimed, with no payment behind them at all.
    const settled = await consumePaidOrderIntent(String(invoiceId || ''), userId, chargeable);
    if (!settled) {
      await releaseStock(canonicalItems);
      if (redemption.redemptionId) await releaseReservedPoints(redemption.redemptionId);
      return res.status(402).json({ error: 'PAYMENT_REQUIRED' });
    }

    const orderRef = `ZITY-${Math.floor(100000 + Math.random() * 900000)}`;
    const { data, error } = await db
      .from('orders')
      .insert({
        user_id: userId,
        order_ref: orderRef,
        external_order_id: orderRef,
        items_snapshot: canonicalItems,
        // What the customer actually paid: the points discount is part of the
        // price, not a separate ledger entry to reconcile later.
        total_amount: chargeable,
        points_redeemed: redemption.points,
        // Stored, not merely passed through: an Odoo re-sync days later still
        // has to put the same delivery line on the sale order, or Odoo's total
        // comes up short and reconciliation reports a mismatch that is not real.
        delivery_fee: deliveryFee,
        // Same reasoning as the fee: Odoo needs the discount on a re-sync, and
        // without it the sale order totals the undiscounted basket.
        discount_amount: discountAmount,
        delivery_address: deliveryAddress || '',
        payment_method:
          paymentMethod === 'socialpay' || paymentMethod === 'card' ? paymentMethod : 'qpay',
        status: 'paid',
        // The invoice that paid for this order. Without it a later cancellation
        // has no way back to the payment, and the refund cannot be issued.
        payment_invoice_id: String(invoiceId || ''),
      })
      .select()
      .single();
    if (error) {
      console.error('[Supabase Order Create Error]', error.message);
      // The stock is reserved against an order that does not exist — hand it
      // back rather than leaking it out of the catalog.
      await releaseStock(canonicalItems);
      if (redemption.redemptionId) await releaseReservedPoints(redemption.redemptionId);
      return res.status(502).json({ error: 'Failed to create order' });
    }
    if (redemption.redemptionId) await attachRedemptionToOrder(redemption.redemptionId, data.id);

    if (ODOO_AUTO_SYNC_ORDERS) {
      void syncChefOrderToOdoo({
        orderKey: data.order_ref || data.id,
        userId,
        userEmail: req.user?.email,
        payload: {
          deliveryAddress,
          paymentMethod,
          delivery: { fee: deliveryFee },
          discountAmount,
        },
      }).then((result) => {
        if (!result.success) console.warn(`[Odoo auto-sync] ${data.order_ref}: ${result.message}`);
      });
    }
    return res.status(201).json({ order: rowToOrder(data), source: 'supabase' });
  }

  // Guest / demo mode: per-instance memory, no real payment to verify.
  //
  // Only reachable when there is no database at all. With Supabase configured,
  // a signed-out caller is refused rather than handed an order that exists for
  // one process lifetime — the payment endpoint blocks them too, so anything
  // reaching here would be an order with no money and no home.
  if (isSupabaseConfigured) {
    return res.status(401).json({ error: 'AUTH_REQUIRED' });
  }

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

// ── POST /api/orders/:id/cancel ──────────────────────────────────────────────
router.post('/:id/cancel', requireSignedIn, async (req: AuthenticatedRequest, res) => {
  const orderId = String(req.params.id || '').trim();
  if (!orderId) return res.status(400).json({ ok: false, message: 'INVALID_ORDER_ID' });

  if (usesDb(req)) {
    const db = getSupabaseForUser(req.accessToken!);
    const orderQuery = db
      .from('orders')
      .select('id,order_ref,status,items_snapshot,total_amount,payment_invoice_id');
    const { data: order, error: fetchError } = await (
      UUID_RE.test(orderId)
        ? orderQuery.or(`id.eq.${orderId},order_ref.eq.${orderId}`)
        : orderQuery.eq('order_ref', orderId)
    ).maybeSingle();
    if (fetchError) {
      console.error('[Supabase Order Cancel Fetch Error]', fetchError.message);
      return res.status(502).json({ ok: false, message: 'Failed to cancel order' });
    }
    if (!order) return res.status(404).json({ ok: false, message: 'ORDER_NOT_FOUND' });

    const status = String(order.status || '');
    if (['shipping', 'delivered', 'delivering', 'completed'].includes(status)) {
      return res.status(409).json({ ok: false, message: 'ORDER_CANNOT_BE_CANCELLED' });
    }

    const { error } = await db.from('orders').update({ status: 'cancelled' }).eq('id', order.id);
    if (error) {
      console.error('[Supabase Order Cancel Error]', error.message);
      return res.status(502).json({ ok: false, message: 'Failed to cancel order' });
    }

    // What the cancelled order was holding goes back on the shelf, and any
    // points it was paid with go back on the balance.
    await releaseStock(order.items_snapshot);
    await refundPointsForOrder(order.id);

    // …and the customer's money goes back to the customer. Cancelling used to
    // raise a credit note in Odoo and stop there, which balanced the books
    // while leaving the payment untouched. This never throws: the order is
    // already cancelled, and a gateway outage must leave a recorded obligation
    // rather than a 502 the customer reads as "cancel failed".
    const refund = await refundOrderPayment({
      invoiceId: String((order as any).payment_invoice_id || ''),
      amount: Number((order as any).total_amount || 0) || undefined,
      reason: `Order ${order.order_ref} cancelled`,
    }).catch((err) => ({
      status: 'failed' as const,
      reason: err instanceof Error ? err.message : 'refund failed',
    }));
    if (refund.status === 'manual' || refund.status === 'failed') {
      console.warn(`[Order cancel] ${order.order_ref}: refund needs attention — ${refund.reason}`);
    }

    // A cancellation the customer makes here has to reach Odoo too, or the sale
    // order stays confirmed and its paid invoice stays on the books with no
    // credit note against it. Same fire-and-forget shape as the create path:
    // the cancellation in Chef already succeeded and must not be undone by an
    // Odoo outage — failures land in the Odoo sync log for the operator.
    if (ODOO_AUTO_SYNC_ORDERS) {
      void cancelChefOrderInOdoo({ orderKey: order.id, userId: req.user!.id }).catch((err) =>
        console.warn(
          `[Odoo cancel] ${order.order_ref}: ${err instanceof Error ? err.message : 'failed'}`
        )
      );
    }
    return res.json({ ok: true });
  }

  return res.status(503).json({ ok: false, message: 'Orders database unavailable' });
});

export default router;
