import express from 'express';
import { isSupabaseConfigured, supabasePublic } from '../supabase.js';
import { AuthenticatedRequest, authenticateToken, requireSignedIn } from '../middleware/auth.js';

const router = express.Router();

interface Product {
  id: string;
  name: string;
  nameEn: string | null;
  emoji: string;
  category: string | null;
  unit: string;
  pricePerUnit: number;
  imageUrl: string | null;
  expiryDays: number;
}

const DEFAULT_IN_STOCK_QUANTITY = 999_999;

/**
 * `store_products.id` is a uuid column, so a non-uuid id makes Postgres reject
 * the whole query ("invalid input syntax for type uuid"). That surfaced as a
 * 502 blaming the server for what is a bad request — and the app's own offline
 * fallback catalog uses placeholder ids like "p1", so a customer who browsed
 * while the backend was unreachable hit it just by pressing checkout.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * What delivery costs this basket.
 *
 * The rule lived here and was only ever consulted by the checkout validation
 * nothing called, so the fee was computed and thrown away: customers were never
 * charged for delivery and Odoo never saw a delivery line. Order creation uses
 * the same function now, so the amount charged and the amount quoted cannot
 * drift apart.
 *
 * The default is **free**: charging for delivery is a decision for whoever runs
 * the shop, and it is made by setting STORE_DELIVERY_FEE, not by a default
 * buried in the code that silently adds 5,000₮ to every basket.
 */
export function deliveryFeeFor(mode: string, subtotal: number): number {
  if (mode === 'pickup') return 0;
  const fee = Number(process.env.STORE_DELIVERY_FEE ?? 0);
  const freeFrom = Number(process.env.STORE_FREE_DELIVERY_MIN_SUBTOTAL ?? 0);
  if (freeFrom > 0 && subtotal >= freeFrom) return 0;
  return Number.isFinite(fee) && fee > 0 ? Math.round(fee) : 0;
}

/** The delivery terms the storefront shows before anyone reaches checkout. */
export function deliveryTerms() {
  const fee = Number(process.env.STORE_DELIVERY_FEE ?? 0);
  const freeFrom = Number(process.env.STORE_FREE_DELIVERY_MIN_SUBTOTAL ?? 0);
  return {
    fee: Number.isFinite(fee) && fee > 0 ? Math.round(fee) : 0,
    freeFrom: Number.isFinite(freeFrom) && freeFrom > 0 ? Math.round(freeFrom) : 0,
  };
}

export function normalizeCoupon(code: unknown): string | null {
  if (typeof code !== 'string') return null;
  const normalized = code.trim().toUpperCase();
  return normalized || null;
}

function validQuantity(value: unknown): number | null {
  const quantity = Number(value);
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 999) return null;
  return quantity;
}

/**
 * Looks up a coupon and confirms it applies to this subtotal.
 *
 * Shared with the order route: checkout quotes a price and the order route has
 * to arrive at the same number, or the customer is charged one amount and the
 * order is refused for being a different one.
 */
export async function resolveCoupon(client: any, code: unknown, subtotal: number) {
  const normalized = normalizeCoupon(code);
  if (!normalized || !client) return null;
  const now = new Date().toISOString();
  const { data, error } = await client
    .from('store_coupons')
    .select(
      'code,discount_type,discount_value,min_subtotal,max_discount_amount,active,starts_at,ends_at'
    )
    .eq('code', normalized)
    .eq('active', true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .maybeSingle();
  if (error || !data) return null;
  if (subtotal < Number(data.min_subtotal || 0)) return null;
  return data;
}

export function computeDiscount(coupon: any, subtotal: number): number {
  if (!coupon) return 0;
  const type = String(coupon.discount_type || '').toLowerCase();
  const value = Number(coupon.discount_value || 0);
  if (!Number.isFinite(value) || value <= 0) return 0;

  const raw = type === 'percent' ? subtotal * (value / 100) : value;
  const max = Number(coupon.max_discount_amount || 0);
  const capped = max > 0 ? Math.min(raw, max) : raw;
  return Math.max(0, Math.min(subtotal, Math.round(capped)));
}

/**
 * The store catalog, served from the database.
 *
 * A hardcoded eight-product copy used to stand in on any error — including an
 * empty table — so a misconfigured deployment sold a catalog nobody could
 * fulfil. A failure is now reported as one.
 */
// ── GET /api/store/products (public catalog) ──────────────────────────────────
router.get('/products', async (_req, res) => {
  if (!isSupabaseConfigured || !supabasePublic) {
    return res.status(503).json({ error: 'CATALOG_UNAVAILABLE' });
  }

  const { data, error } = await supabasePublic
    .from('store_products')
    .select('*')
    .eq('in_stock', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[Store catalog error]', error.message);
    return res.status(503).json({ error: 'CATALOG_UNAVAILABLE' });
  }

  const products: Product[] = (data || []).map((p) => ({
    id: p.id,
    name: p.name,
    nameEn: p.name_en,
    emoji: p.emoji,
    category: p.category,
    unit: p.unit,
    pricePerUnit: Number(p.price_per_unit),
    imageUrl: p.image_url,
    expiryDays: Number(p.expiry_days) || 7,
  }));
  // The storefront needs the delivery terms to show a total before checkout;
  // the server still recomputes the fee when the order is placed.
  return res.json({ products, source: 'supabase', delivery: deliveryTerms() });
});

// ── POST /api/store/checkout/validate ────────────────────────────────────────
router.post(
  '/checkout/validate',
  authenticateToken,
  requireSignedIn,
  async (req: AuthenticatedRequest, res) => {
    if (!isSupabaseConfigured || !supabasePublic) {
      return res.status(503).json({ ok: false, message: 'Catalog unavailable' });
    }

    const { items, deliveryMode, couponCode } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ ok: false, message: 'Сагс хоосон байна.' });
    }
    if (deliveryMode !== 'delivery' && deliveryMode !== 'pickup') {
      return res.status(400).json({ ok: false, message: 'Хүргэлтийн төрөл буруу байна.' });
    }

    const requested = items.map((item: any) => ({
      id: String(item?.id || item?.productId || '').trim(),
      sku: item?.sku ? String(item.sku).trim() : '',
      quantity: validQuantity(item?.quantity),
    }));
    if (requested.some((item) => !item.id || item.quantity === null)) {
      return res.status(400).json({ ok: false, message: 'Сагсны барааны мэдээлэл буруу байна.' });
    }
    if (requested.some((item) => !UUID_RE.test(item.id))) {
      // Caught here rather than by Postgres, so the caller gets a 400 that says
      // what is wrong instead of a 502 that says the server failed.
      return res.status(400).json({
        ok: false,
        code: 'STALE_CART',
        message: 'Сагсанд хуучирсан бараа байна. Сагсаа шинэчилнэ үү.',
      });
    }

    const ids = [...new Set(requested.map((item) => item.id))];
    let productsRes: any = await supabasePublic
      .from('store_products')
      .select('id,name,price_per_unit,in_stock,stock_quantity')
      .in('id', ids);

    if (productsRes.error && productsRes.error.message.includes('stock_quantity')) {
      productsRes = await supabasePublic
        .from('store_products')
        .select('id,name,price_per_unit,in_stock')
        .in('id', ids);
    }

    if (productsRes.error) {
      console.error('[Store checkout validation error]', productsRes.error.message);
      return res.status(502).json({ ok: false, message: 'Барааны мэдээлэл шалгаж чадсангүй.' });
    }

    const byId = new Map(
      (productsRes.data || []).map((product: any) => [String(product.id), product])
    );
    const canonicalItems: any[] = [];

    for (const item of requested) {
      const product: any = byId.get(item.id);
      if (!product || product.in_stock !== true) {
        return res.status(400).json({ ok: false, message: 'Сагсанд байхгүй бараа байна.' });
      }
      const stock =
        product.stock_quantity === undefined || product.stock_quantity === null
          ? DEFAULT_IN_STOCK_QUANTITY
          : Math.max(0, Math.floor(Number(product.stock_quantity) || 0));
      const quantity = item.quantity!;
      if (stock < quantity) {
        return res
          .status(400)
          .json({ ok: false, message: `${product.name || 'Бараа'} нөөц хүрэлцэхгүй байна.` });
      }
      const unitPrice = Math.round(Number(product.price_per_unit || 0));
      canonicalItems.push({
        id: item.id,
        quantity,
        unitPrice,
        stock,
        available: true,
      });
    }

    const subtotal = canonicalItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const code = normalizeCoupon(couponCode);
    let coupon: any = null;
    if (code) {
      const now = new Date().toISOString();
      const { data, error } = await supabasePublic
        .from('store_coupons')
        .select(
          'code,discount_type,discount_value,min_subtotal,max_discount_amount,active,starts_at,ends_at'
        )
        .eq('code', code)
        .eq('active', true)
        .or(`starts_at.is.null,starts_at.lte.${now}`)
        .or(`ends_at.is.null,ends_at.gte.${now}`)
        .maybeSingle();
      if (error || !data) {
        return res.status(400).json({ ok: false, message: 'Coupon invalid' });
      }
      const minSubtotal = Number(data.min_subtotal || 0);
      if (subtotal < minSubtotal) {
        return res.status(400).json({ ok: false, message: 'Coupon invalid' });
      }
      coupon = data;
    }

    const discountAmount = computeDiscount(coupon, subtotal);
    const deliveryFee = deliveryFeeFor(deliveryMode, subtotal - discountAmount);
    const totalAmount = Math.max(0, subtotal - discountAmount + deliveryFee);

    return res.json({
      ok: true,
      items: canonicalItems,
      subtotal,
      discountAmount,
      deliveryFee,
      totalAmount,
      couponCode: code,
    });
  }
);

export default router;
