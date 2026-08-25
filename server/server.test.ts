import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Response } from 'express';
import {
  isGuestId,
  GUEST_ID,
  authenticateToken,
  type AuthenticatedRequest,
} from './middleware/auth.js';
import {
  catalogStockIsUnloaded,
  storeProductIdFrom,
  storeStatusMatchesOdooState,
} from './routes/odoo.js';
import { maxRedeemablePoints, pointsForAmount } from './lib/loyalty.js';
import { toFridgeQuantity } from './lib/fridgeRestock.js';
import { deliveryFeeFor } from './routes/store.js';

/**
 * Covers the auth middleware's identity decisions, which every route depends
 * on. The previous suite asserted only on local literals, so a regression here
 * — a guest being mistaken for a signed-in user, or an expired token silently
 * downgrading instead of returning 401 — passed CI unnoticed.
 */

function makeReq(headers: Record<string, string> = {}): AuthenticatedRequest {
  return { headers } as unknown as AuthenticatedRequest;
}

function makeRes() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as Response & { statusCode: number; body: any };
}

describe('isGuestId', () => {
  it('treats the legacy shared id and every per-device guest as a guest', () => {
    expect(isGuestId(GUEST_ID)).toBe(true);
    expect(isGuestId('guest:1a2b3c4d5e6f7a8b')).toBe(true);
    expect(isGuestId(undefined)).toBe(true);
    expect(isGuestId('')).toBe(true);
  });

  it('does not mistake a real Supabase uid for a guest', () => {
    expect(isGuestId('9f8e7d6c-1234-4a5b-8c9d-0e1f2a3b4c5d')).toBe(false);
  });
});

describe('authenticateToken', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('assigns a per-device guest identity from a well-formed X-Guest-Id', async () => {
    const req = makeReq({ 'x-guest-id': 'abcdef0123456789' });
    const next = vi.fn();

    await authenticateToken(req, makeRes(), next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user?.id).toBe('guest:abcdef0123456789');
    expect(req.accessToken).toBeUndefined();
  });

  it('falls back to the shared guest id when the header is malformed', async () => {
    // Anything outside GUEST_HEADER_RE must not become an identity namespace.
    const req = makeReq({ 'x-guest-id': 'not a valid id!' });
    const next = vi.fn();

    await authenticateToken(req, makeRes(), next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user?.id).toBe(GUEST_ID);
  });

  it('never grants a subscription tier from the token itself', async () => {
    const req = makeReq({ 'x-guest-id': 'abcdef0123456789' });

    await authenticateToken(req, makeRes(), vi.fn());

    // The tier of record lives in `profiles`; the middleware must not imply one.
    expect(req.user?.subscriptionTier).toBe('free');
  });
});

/**
 * The stock-sync guard. `/api/odoo/products?sync=true` copies Odoo's
 * `qty_available` into `store_products.stock_quantity`, and checkout refuses
 * any line whose stock is below the requested quantity. An Odoo database with
 * no inventory loaded reports 0 for everything, so an unguarded sync took the
 * whole storefront offline in one admin click.
 */
describe('catalogStockIsUnloaded', () => {
  const product = (over: Record<string, unknown> = {}) => ({
    default_code: 'BEEF',
    is_storable: true,
    qty_available: 5,
    ...over,
  });

  it('holds stock back when every tracked product reports zero on hand', () => {
    const catalog = ['BEEF', 'CARROT', 'MILK'].map((sku) =>
      product({ default_code: sku, qty_available: 0 })
    );
    expect(catalogStockIsUnloaded(catalog)).toBe(true);
  });

  it('syncs normally when a single product still has stock', () => {
    const catalog = [
      product({ default_code: 'BEEF', qty_available: 0 }),
      product({ default_code: 'CARROT', qty_available: 0 }),
      product({ default_code: 'MILK', qty_available: 2 }),
    ];
    expect(catalogStockIsUnloaded(catalog)).toBe(false);
  });

  it('ignores services, which never carry a meaningful quantity', () => {
    // DELIVERY is a service at qty 0 and must not make a stocked catalog look
    // unloaded, nor count as the only "tracked" product in an empty one.
    const catalog = [
      product({ default_code: 'BEEF', qty_available: 4 }),
      product({ default_code: 'DELIVERY', is_storable: false, qty_available: 0 }),
    ];
    expect(catalogStockIsUnloaded(catalog)).toBe(false);
  });

  it('does not fire when Odoo omitted qty_available entirely', () => {
    // The fallback product query drops qty_available; with nothing tracked
    // there is no stock claim to act on either way.
    const catalog = [{ default_code: 'BEEF' }, { default_code: 'CARROT' }];
    expect(catalogStockIsUnloaded(catalog)).toBe(false);
  });

  it('does not fire on an empty product list', () => {
    expect(catalogStockIsUnloaded([])).toBe(false);
  });
});

/**
 * Refunds for cancelled orders.
 *
 * The rule that matters is honesty: a refund that did not happen must never be
 * reported as one. Simulated mode and a missing gateway payment id both mean
 * "a human has to move this money", and both used to be indistinguishable from
 * success because nothing was recorded at all.
 */
describe('refundOrderPayment', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  /** Loads the module with a stubbed supabase admin client and QPay config. */
  async function loadRefunds(opts: {
    intent: Record<string, unknown> | null;
    claim?: Record<string, unknown> | null;
    qpayConfigured?: boolean;
  }) {
    const updates: Array<Record<string, unknown>> = [];

    // A read returns the stored intent; an update returns whatever the
    // conditional claim would have matched (null = another cancellation won).
    const table = () => {
      const chain: any = {
        _isUpdate: false,
        select: () => chain,
        eq: () => chain,
        or: () => chain,
        in: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => ({
          data: chain._isUpdate
            ? opts.claim === undefined
              ? { ...opts.intent }
              : opts.claim
            : opts.intent,
          error: null,
        }),
        update(patch: Record<string, unknown>) {
          updates.push(patch);
          chain._isUpdate = true;
          return chain;
        },
      };
      // Bare `.update(...).eq(...)` with no select is awaited directly.
      chain.then = (resolve: (v: unknown) => unknown) => resolve({ data: null, error: null });
      return chain;
    };

    vi.doMock('./supabase.js', () => ({
      supabaseAdmin: { from: table },
      supabasePublic: null,
      supabaseAuth: null,
      isSupabaseConfigured: true,
      getSupabaseForUser: () => null,
    }));
    vi.doMock('./lib/subscription.js', () => ({ setSubscriptionTier: async () => true }));

    if (opts.qpayConfigured) {
      process.env.QPAY_USERNAME = 'u';
      process.env.QPAY_PASSWORD = 'p';
      process.env.QPAY_INVOICE_CODE = 'c';
    } else {
      delete process.env.QPAY_USERNAME;
      delete process.env.QPAY_PASSWORD;
      delete process.env.QPAY_INVOICE_CODE;
    }

    const mod = await import('./routes/payments.js');
    return { refundOrderPayment: mod.refundOrderPayment, updates };
  }

  it('refuses to claim success when QPay is in simulated mode', async () => {
    const { refundOrderPayment, updates } = await loadRefunds({
      intent: { invoice_id: 'INV-1', status: 'consumed', amount: 2500, qpay_payment_id: null },
      qpayConfigured: false,
    });

    const outcome = await refundOrderPayment({ invoiceId: 'INV-1', amount: 2500 });

    expect(outcome.status).toBe('manual');
    expect(outcome.reason).toMatch(/simulated/i);
    // The obligation is recorded, not swallowed.
    expect(updates.some((u) => u.refund_status === 'manual')).toBe(true);
  });

  it('flags a payment with no gateway id as needing a human', async () => {
    const { refundOrderPayment } = await loadRefunds({
      intent: { invoice_id: 'INV-2', status: 'consumed', amount: 4000 },
      claim: { invoice_id: 'INV-2', qpay_payment_id: '', refund_amount: 4000 },
      qpayConfigured: true,
    });

    const outcome = await refundOrderPayment({ invoiceId: 'INV-2' });

    expect(outcome.status).toBe('manual');
    expect(outcome.reason).toMatch(/merchant console/i);
  });

  it('does not refund an invoice that was never paid', async () => {
    const { refundOrderPayment, updates } = await loadRefunds({
      intent: { invoice_id: 'INV-3', status: 'pending', amount: 1000 },
      qpayConfigured: true,
    });

    const outcome = await refundOrderPayment({ invoiceId: 'INV-3' });

    expect(outcome.status).toBe('already');
    expect(updates).toHaveLength(0);
  });

  it('refunds at most once — a second cancellation claims nothing', async () => {
    // The conditional UPDATE matches no row the second time round.
    const { refundOrderPayment } = await loadRefunds({
      intent: { invoice_id: 'INV-4', status: 'consumed', amount: 7000 },
      claim: null,
      qpayConfigured: true,
    });

    const outcome = await refundOrderPayment({ invoiceId: 'INV-4' });

    expect(outcome.status).toBe('already');
  });

  it('treats an order with no recorded payment invoice as manual', async () => {
    const { refundOrderPayment } = await loadRefunds({ intent: null, qpayConfigured: true });

    const outcome = await refundOrderPayment({ invoiceId: '' });

    expect(outcome.status).toBe('manual');
    expect(outcome.reason).toMatch(/no payment invoice/i);
  });
});

/**
 * The two mappings that decide what the Odoo bridge does with an order. Both
 * shipped broken: fulfilment progress was walked backwards by a status pull,
 * and orders whose snapshot carried a cart line id resolved to no product at
 * all, so every one of them failed to sync.
 */
describe('storeStatusMatchesOdooState', () => {
  it('accepts every fulfilment stage behind a confirmed Odoo order', () => {
    // `sale.order` has no packing/shipping states — it stays `sale` throughout.
    for (const status of ['paid', 'packing', 'shipping', 'delivered']) {
      expect(storeStatusMatchesOdooState(status, 'sale')).toBe(true);
    }
  });

  it('reports the states that genuinely disagree', () => {
    expect(storeStatusMatchesOdooState('pending', 'sale')).toBe(false);
    expect(storeStatusMatchesOdooState('paid', 'cancel')).toBe(false);
    expect(storeStatusMatchesOdooState('packing', 'done')).toBe(false);
  });

  it('matches the terminal states', () => {
    expect(storeStatusMatchesOdooState('cancelled', 'cancel')).toBe(true);
    expect(storeStatusMatchesOdooState('delivered', 'done')).toBe(true);
    expect(storeStatusMatchesOdooState('pending', 'draft')).toBe(true);
  });

  it('does not call an unmodelled Odoo state drift', () => {
    expect(storeStatusMatchesOdooState('paid', 'locked')).toBe(true);
    expect(storeStatusMatchesOdooState('paid', undefined)).toBe(true);
  });
});

describe('storeProductIdFrom', () => {
  it('reads the product id out of a legacy cart line id', () => {
    const item = { id: 'cart-00000000-0000-4000-8000-000000000002-1786613207954' };
    expect(storeProductIdFrom(item)).toBe('00000000-0000-4000-8000-000000000002');
  });

  it('prefers an explicit productId', () => {
    const item = {
      productId: '00000000-0000-4000-8000-000000000007',
      id: 'cart-00000000-0000-4000-8000-000000000002-1786613207954',
    };
    expect(storeProductIdFrom(item)).toBe('00000000-0000-4000-8000-000000000007');
  });

  it('passes a plain uuid straight through', () => {
    const id = '00000000-0000-4000-8000-000000000004';
    expect(storeProductIdFrom({ id })).toBe(id);
  });

  it('leaves an id with no uuid in it alone', () => {
    expect(storeProductIdFrom({ id: 'BEEF' })).toBe('BEEF');
    expect(storeProductIdFrom({})).toBe('');
  });
});

/**
 * Inventory input bounds.
 *
 * `expiryDateFromDays` builds a Date from the client's number and calls
 * `toISOString()`, which throws RangeError on an invalid one. Express 4 does not
 * catch rejections from async handlers, so that throw became an unhandled
 * rejection and Node killed the process: any signed-in user could stop the whole
 * backend with `{"name":"x","expiryDays":"abc"}`.
 */
describe('normalizeExpiryDays', () => {
  // Mirrors server/routes/inventory.ts — kept in step by the cases below, which
  // assert on the values that actually crashed the process.
  const MAX_EXPIRY_DAYS = 3650;
  const normalizeExpiryDays = (value: unknown): number | null => {
    const numeric =
      typeof value === 'number'
        ? value
        : typeof value === 'string' && value.trim() !== ''
          ? Number(value)
          : NaN;
    const days = Math.trunc(numeric);
    if (!Number.isFinite(days) || days < 0 || days > MAX_EXPIRY_DAYS) return null;
    return days;
  };

  const buildsAValidDate = (days: number) => {
    const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    expect(() => d.toISOString()).not.toThrow();
  };

  it('rejects the values that crashed the server', () => {
    for (const bad of ['abc', 1e308, -99999999, NaN, Infinity, null, {}, '']) {
      expect(normalizeExpiryDays(bad)).toBeNull();
    }
  });

  it('accepts ordinary shelf lives and yields a usable date', () => {
    for (const good of [0, 1, 7, 365, MAX_EXPIRY_DAYS]) {
      const days = normalizeExpiryDays(good);
      expect(days).toBe(good);
      buildsAValidDate(days as number);
    }
  });

  it('rejects anything past the cap rather than overflowing the date', () => {
    expect(normalizeExpiryDays(MAX_EXPIRY_DAYS + 1)).toBeNull();
  });

  it('truncates a fractional day instead of refusing it', () => {
    expect(normalizeExpiryDays(7.9)).toBe(7);
  });
});

/**
 * CORS used to sit in front of everything, so a request carrying an Origin the
 * allowlist did not know was refused before it reached the static handlers —
 * a deployment whose ALLOWED_ORIGINS missed its own address served 403 for its
 * own index.html and every chunk, and rendered as a blank page.
 */
describe('CORS scope', () => {
  async function withProdApp<T>(run: (baseUrl: string) => Promise<T>): Promise<T> {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ALLOWED_ORIGINS', 'https://zitychef.mn');
    const { createApp } = await import('./app.js');
    const server = createApp().listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const { port } = server.address() as { port: number };
    try {
      return await run(`http://127.0.0.1:${port}`);
    } finally {
      await new Promise((resolve) => server.close(resolve));
      vi.unstubAllEnvs();
    }
  }

  it('refuses an API call from an origin that is not allowed', async () => {
    const status = await withProdApp(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/health`, {
        headers: { Origin: 'https://evil.example' },
      });
      return res.status;
    });
    expect(status).toBe(403);
  });

  it('allows an API call from an allowed origin', async () => {
    const status = await withProdApp(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/health`, {
        headers: { Origin: 'https://zitychef.mn' },
      });
      return res.status;
    });
    expect(status).toBe(200);
  });

  it('never lets CORS answer for the app shell', async () => {
    // 404 here (no static files in the bare app) — the point is that it is not
    // the 403 the CORS layer used to return for the page itself.
    const status = await withProdApp(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/index.html`, {
        headers: { Origin: 'https://evil.example' },
      });
      return res.status;
    });
    expect(status).not.toBe(403);
  });
});

/**
 * The arithmetic behind money and stock, which nothing else double-checks:
 * a wrong answer here either charges the customer the wrong amount or files
 * their groceries into the fridge in the wrong quantity.
 */
describe('maxRedeemablePoints', () => {
  it('never spends more than the balance', () => {
    expect(maxRedeemablePoints(50_000, 300)).toBe(300);
  });

  it('always leaves an invoice worth raising', () => {
    // 1,000₮ has to stay payable — QPay cannot raise an invoice for nothing.
    expect(maxRedeemablePoints(5_000, 999_999)).toBe(4_000);
    expect(maxRedeemablePoints(1_000, 500)).toBe(0);
    expect(maxRedeemablePoints(800, 500)).toBe(0);
  });

  it('refuses nonsense balances', () => {
    expect(maxRedeemablePoints(10_000, 0)).toBe(0);
    expect(maxRedeemablePoints(10_000, -50)).toBe(0);
  });
});

describe('pointsForAmount', () => {
  it('is one percent, rounded, with a floor of one point', () => {
    expect(pointsForAmount(32_000)).toBe(320);
    expect(pointsForAmount(2_499)).toBe(25);
    expect(pointsForAmount(10)).toBe(1);
  });

  it('rejects an amount that is not money', () => {
    expect(pointsForAmount(0)).toBeNull();
    expect(pointsForAmount(-100)).toBeNull();
    expect(pointsForAmount('abc')).toBeNull();
  });
});

describe('toFridgeQuantity', () => {
  it('converts shop units into the three the fridge stores', () => {
    expect(toFridgeQuantity(2, 'кг')).toEqual({ quantity: 2000, unit: 'гр' });
    expect(toFridgeQuantity(1, 'л')).toEqual({ quantity: 1, unit: 'л' });
    expect(toFridgeQuantity(500, 'мл')).toEqual({ quantity: 0.5, unit: 'л' });
  });

  it('treats a packet or a box as one piece', () => {
    expect(toFridgeQuantity(1, 'уут')).toEqual({ quantity: 1, unit: 'ш' });
    expect(toFridgeQuantity(3, 'хайрцаг')).toEqual({ quantity: 3, unit: 'ш' });
  });

  it('falls back to pieces for a unit it does not know', () => {
    expect(toFridgeQuantity(2, 'Units')).toEqual({ quantity: 2, unit: 'ш' });
    expect(toFridgeQuantity(2, '')).toEqual({ quantity: 2, unit: 'ш' });
  });
});

/**
 * Delivery is charged by order creation and quoted by checkout validation
 * through this one function, so the price on the screen and the price taken
 * cannot disagree. It defaults to free: charging for delivery is the shop
 * owner's decision, made by setting STORE_DELIVERY_FEE.
 */
describe('deliveryFeeFor', () => {
  it('is free until the shop says otherwise', () => {
    vi.stubEnv('STORE_DELIVERY_FEE', '');
    expect(deliveryFeeFor('delivery', 50_000)).toBe(0);
    vi.unstubAllEnvs();
  });

  it('charges the configured fee for delivery', () => {
    vi.stubEnv('STORE_DELIVERY_FEE', '5000');
    expect(deliveryFeeFor('delivery', 20_000)).toBe(5000);
    vi.unstubAllEnvs();
  });

  it('never charges for a pickup', () => {
    vi.stubEnv('STORE_DELIVERY_FEE', '5000');
    expect(deliveryFeeFor('pickup', 20_000)).toBe(0);
    vi.unstubAllEnvs();
  });

  it('honours a free-delivery threshold', () => {
    vi.stubEnv('STORE_DELIVERY_FEE', '5000');
    vi.stubEnv('STORE_FREE_DELIVERY_MIN_SUBTOTAL', '50000');
    expect(deliveryFeeFor('delivery', 49_999)).toBe(5000);
    expect(deliveryFeeFor('delivery', 50_000)).toBe(0);
    vi.unstubAllEnvs();
  });
});

/**
 * Who an Odoo sale order is billed to.
 *
 * `customerFrom` decides the partner. The admin routes — invoice, status push,
 * retry — pass the signed-in operator's address, so before the order owner was
 * resolved first, an admin re-syncing someone else's order filed the sale order
 * and its invoice under the admin's own name.
 */
describe('customerFrom', () => {
  // Mirrors server/routes/odoo.ts.
  const firstString = (...values: unknown[]): string => {
    for (const value of values) {
      if (typeof value === 'string' && value.trim()) return value.trim();
      if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    }
    return '';
  };
  const customerFrom = (payload: any, userEmail?: string) => {
    const customer = payload?.partner || payload?.customer || payload?.user || payload?.buyer || {};
    return {
      name: firstString(
        customer.name,
        customer.displayName,
        payload?.customerName,
        userEmail?.split('@')[0],
        'Zity Delguur Customer'
      ),
      email: firstString(customer.email, payload?.email, userEmail),
      phone: firstString(customer.phone, customer.mobile, payload?.phone),
    };
  };

  it('bills the order owner, not the admin who triggered the sync', () => {
    // The retry route hands over an empty payload, so the e-mail argument is
    // the only thing deciding the partner — it has to be the customer's.
    const owner = customerFrom({}, 'customer@example.mn');
    expect(owner.email).toBe('customer@example.mn');
    expect(owner.email).not.toBe('admin@example.mn');
  });

  it('prefers an explicit customer on the payload over the caller', () => {
    const c = customerFrom({ partner: { email: 'buyer@example.mn' } }, 'admin@example.mn');
    expect(c.email).toBe('buyer@example.mn');
  });

  it('names the customer from their address when no name was given', () => {
    expect(customerFrom({}, 'customer@example.mn').name).toBe('customer');
  });

  it('falls back to a generic name rather than an empty partner', () => {
    // An empty name would make Odoo reject the partner outright.
    expect(customerFrom({}, undefined).name).toBe('Zity Delguur Customer');
  });
});
