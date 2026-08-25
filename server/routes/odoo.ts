import express from 'express';
import { AuthenticatedRequest, authenticateToken, requireSignedIn } from '../middleware/auth.js';
import { refundOrderPayment } from './payments.js';
import { stockFridgeFromOrder } from '../lib/fridgeRestock.js';
import { releaseStock } from '../lib/stock.js';
import { awardPointsForOrder, refundPointsForOrder } from '../lib/loyalty.js';
import {
  getSupabaseForUser,
  isSupabaseConfigured,
  supabaseAdmin,
  supabasePublic,
} from '../supabase.js';

const router = express.Router();

const ODOO_URL = (process.env.ODOO_URL || '').replace(/\/+$/, '');
const ODOO_DB = process.env.ODOO_DB || '';
const ODOO_USERNAME = process.env.ODOO_USERNAME || '';
const ODOO_API_KEY = process.env.ODOO_API_KEY || '';
const ODOO_TIMEOUT_MS = Number(process.env.ODOO_TIMEOUT_MS || 15_000);
const ODOO_DELIVERY_PRODUCT_ID = Number(process.env.ODOO_DELIVERY_PRODUCT_ID || 0);
const ODOO_DELIVERY_PRODUCT_SKU = process.env.ODOO_DELIVERY_PRODUCT_SKU || '';
/** Service product that carries a Zity points discount as a negative line. */
const ODOO_POINTS_PRODUCT_SKU = process.env.ODOO_POINTS_PRODUCT_SKU || 'POINTSDISCOUNT';
/** Coupons book against their own product so the ledger can tell the two kinds
 *  of discount apart — points are a liability being settled, a coupon is not. */
const ODOO_COUPON_PRODUCT_SKU = process.env.ODOO_COUPON_PRODUCT_SKU || 'COUPONDISCOUNT';
const ODOO_PRICELIST_ID = Number(process.env.ODOO_PRICELIST_ID || 0);
const ODOO_SALES_TEAM_ID = Number(process.env.ODOO_SALES_TEAM_ID || 0);
const ODOO_SALESPERSON_ID = Number(process.env.ODOO_SALESPERSON_ID || 0);
const ODOO_COMPANY_ID = Number(process.env.ODOO_COMPANY_ID || 0);
const ODOO_PAYMENT_JOURNAL_ID = Number(process.env.ODOO_PAYMENT_JOURNAL_ID || 0);
/** Chef takes payment before an order exists, so it invoices on sync by default. */
const ODOO_AUTO_INVOICE_ORDERS = process.env.ODOO_AUTO_INVOICE_ORDERS !== 'false';
/** Reconciliation writes an Odoo cancellation back into Chef. */
const ODOO_APPLY_CANCELLATIONS = process.env.ODOO_APPLY_CANCELLATIONS !== 'false';
/** Marking an order delivered in Chef ships its Odoo delivery order too. */
const ODOO_VALIDATE_DELIVERY = process.env.ODOO_VALIDATE_DELIVERY !== 'false';
const ODOO_CREDIT_NOTE_JOURNAL_ID = Number(process.env.ODOO_CREDIT_NOTE_JOURNAL_ID || 0);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** Same shape, unanchored — for ids that carry a uuid inside a longer string. */
const EMBEDDED_UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;
const isOdooConfigured = Boolean(ODOO_URL && ODOO_DB && ODOO_USERNAME && ODOO_API_KEY);

let authCache: { uid: number; expiresAt: number } | null = null;

/** Order states that are supposed to exist in Odoo. */
const SYNCABLE_ORDER_STATUSES = ['paid', 'packing', 'shipping', 'delivered'] as const;

/** The Odoo hostname, without scheme or path — safe to show to an admin UI. */
function odooHost(): string {
  try {
    return new URL(ODOO_URL).host;
  } catch {
    return '';
  }
}

type JsonRpcResult<T> = { result?: T; error?: { message?: string; data?: { message?: string } } };

interface StoreOrderRow {
  id: string;
  user_id: string;
  order_ref: string;
  items_snapshot: any[];
  total_amount: number | string;
  delivery_address: string;
  payment_method: string;
  status: string;
  created_at?: string;
  external_order_id?: string | null;
  odoo_order_ref?: string | null;
  odoo_order_id?: number | null;
  odoo_invoice_id?: number | null;
  odoo_invoice_ref?: string | null;
  odoo_invoice_status?: string | null;
  odoo_sync_error?: string | null;
  odoo_synced_at?: string | null;
  /** The payment invoice this order was bought with; the handle a refund needs. */
  payment_invoice_id?: string | null;
  /** Delivery charged on the order; mirrored as a DELIVERY line in Odoo. */
  delivery_fee?: number | string | null;
  /** Coupon discount already deducted from total_amount. */
  discount_amount?: number | string | null;
  /** Zity points spent on this order; one point is one tugrik off. */
  points_redeemed?: number | null;
}

interface SyncOrderOptions {
  orderKey: string;
  userId?: string;
  userEmail?: string;
  payload?: any;
}

interface NormalizedItem {
  storeProductId: string;
  sku: string;
  odooProductId: number | null;
  odooSku: string;
  name: string;
  quantity: number;
  /** Unit price the customer actually paid, 0 when the snapshot has none. */
  pricePerUnit: number;
}

interface OdooOrderRef {
  id: number;
  name: string;
  state?: string;
  amount_total?: number;
  invoice_status?: string;
  invoice_ids?: number[];
}

function cleanOdooMessage(error: unknown): string {
  if (!(error instanceof Error)) return 'Odoo sync failed';
  if (error.name === 'AbortError') return 'Odoo request timed out';
  if (error.message.includes('authentication')) return 'Odoo authentication failed';
  if (error.message.includes('not configured')) return 'Odoo is not configured';
  if (error.message.includes('product not found')) return error.message;
  if (error.message.includes('Order not found')) return error.message;
  return 'Odoo sync failed';
}

function publicLogStatus(status: string): 'success' | 'warning' | 'error' {
  return status === 'success' || status === 'warning' ? status : 'error';
}

function detailMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Odoo request failed';
}

function isChefAdmin(req: AuthenticatedRequest): boolean {
  const admins = (process.env.CHEF_ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes((req.user?.email || '').toLowerCase());
}

async function logOdooSync(params: {
  orderId?: string | null;
  orderRef?: string | null;
  externalOrderId?: string | null;
  action: string;
  status: 'success' | 'warning' | 'error' | 'failed' | 'info';
  message: string;
  details?: Record<string, unknown>;
  request?: Record<string, unknown>;
  response?: Record<string, unknown>;
}) {
  if (!supabaseAdmin) return;
  const { error } = await supabaseAdmin.from('odoo_sync_logs').insert({
    order_id: params.orderId || null,
    order_ref: params.orderRef || null,
    external_order_id: params.externalOrderId || params.orderRef || null,
    operation: params.action,
    action: params.action,
    status: params.status,
    message: params.message,
    details: params.details || {},
    request_payload: params.request || {},
    response_payload: params.response || {},
  });
  if (error) console.error('[Odoo sync log error]', error.message);
}

async function jsonRpc<T>(service: string, method: string, args: unknown[]): Promise<T> {
  if (!isOdooConfigured) throw new Error('Odoo is not configured');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ODOO_TIMEOUT_MS);
  try {
    const res = await fetch(`${ODOO_URL}/jsonrpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: { service, method, args },
        id: Date.now(),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as JsonRpcResult<T>;
    if (!res.ok) throw new Error(`Odoo HTTP ${res.status}`);
    if (data.error) throw new Error(data.error.data?.message || data.error.message || 'Odoo error');
    return data.result as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function authenticateOdoo(): Promise<number> {
  if (authCache && Date.now() < authCache.expiresAt) return authCache.uid;
  const uid = await jsonRpc<number | false>('common', 'authenticate', [
    ODOO_DB,
    ODOO_USERNAME,
    ODOO_API_KEY,
    {},
  ]);
  if (!uid) throw new Error('Odoo authentication failed');
  authCache = { uid, expiresAt: Date.now() + 10 * 60_000 };
  return uid;
}

async function executeKw<T>(
  model: string,
  method: string,
  args: unknown[] = [],
  kwargs: Record<string, unknown> = {}
): Promise<T> {
  const uid = await authenticateOdoo();
  return jsonRpc<T>('object', 'execute_kw', [
    ODOO_DB,
    uid,
    ODOO_API_KEY,
    model,
    method,
    args,
    kwargs,
  ]);
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

function orderKeyFrom(payload: any): string {
  return firstString(
    payload?.externalOrderId,
    payload?.idempotencyKey,
    payload?.orderId,
    payload?.orderRef,
    payload?.chefOrderRef,
    payload?.id
  );
}

function customerFrom(payload: any, userEmail?: string) {
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
}

function deliveryAddressFrom(payload: any, order: StoreOrderRow): string {
  const delivery = payload?.delivery || {};
  return firstString(
    delivery.address,
    payload?.deliveryAddress,
    payload?.address,
    payload?.partner?.street,
    order.delivery_address
  );
}

/**
 * The delivery charged on an order.
 *
 * The request payload is preferred because a caller may be re-sending an order
 * whose fee is known only to it, but the stored `delivery_fee` is what makes a
 * later re-sync produce the same sale order: a retry days after the fact has no
 * payload, and without the column the delivery line silently vanished and Odoo
 * came up short by exactly that amount.
 */
/** The coupon discount on an order, preferring the request over the stored row. */
function discountAmountFrom(payload: any, order?: StoreOrderRow | null): number {
  const value = Number(
    payload?.discountAmount ?? payload?.discount_amount ?? order?.discount_amount ?? 0
  );
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

function deliveryFeeFrom(payload: any, order?: StoreOrderRow | null): number {
  const delivery = payload?.delivery || {};
  const fee = Number(
    delivery.fee ?? payload?.deliveryFee ?? payload?.delivery_fee ?? order?.delivery_fee ?? 0
  );
  return Number.isFinite(fee) && fee > 0 ? Math.round(fee) : 0;
}

/**
 * The catalog id behind an order line.
 *
 * Current orders snapshot the canonical product id, but orders placed before
 * that stored the cart line id — `cart-<product uuid>-<timestamp>` — which
 * matches no catalog row, so every one of their lines lost its SKU and the
 * whole order failed to sync with "Odoo product not found". The embedded uuid
 * is the product id, so read it out rather than writing those orders off.
 */
export function storeProductIdFrom(item: any): string {
  const raw = firstString(item?.productId, item?.id);
  if (UUID_RE.test(raw)) return raw;
  const embedded = raw.match(EMBEDDED_UUID_RE);
  return embedded ? embedded[0] : raw;
}

function normalizeOrderItems(
  order: StoreOrderRow,
  productsById: Map<string, any>
): NormalizedItem[] {
  return (Array.isArray(order.items_snapshot) ? order.items_snapshot : [])
    .map((item: any) => {
      const storeProductId = storeProductIdFrom(item);
      const product = productsById.get(storeProductId);
      const quantity = Number(item?.quantity);
      return {
        storeProductId,
        sku: firstString(item?.sku, product?.sku),
        odooProductId: Number.isInteger(
          Number(item?.odooProductId ?? item?.odoo_product_id ?? product?.odoo_product_id)
        )
          ? Number(item?.odooProductId ?? item?.odoo_product_id ?? product?.odoo_product_id)
          : null,
        odooSku: firstString(item?.odooSku, product?.odoo_product_sku, item?.sku, product?.sku),
        name: firstString(item?.name, product?.name, storeProductId),
        quantity,
        pricePerUnit: Math.max(
          0,
          Number(item?.pricePerUnit ?? item?.price_per_unit ?? item?.priceUnit ?? 0) || 0
        ),
      };
    })
    .filter((item) => item.storeProductId && item.quantity > 0);
}

async function loadOwnOrder(
  req: AuthenticatedRequest,
  orderKey: string
): Promise<StoreOrderRow | null> {
  if (!isSupabaseConfigured || !req.accessToken) return null;

  const db = getSupabaseForUser(req.accessToken);
  const query = db
    .from('orders')
    .select(
      'id,user_id,order_ref,external_order_id,items_snapshot,total_amount,delivery_address,payment_method,status,odoo_order_ref,odoo_order_id,odoo_invoice_id,odoo_invoice_ref,odoo_invoice_status,odoo_sync_error,odoo_synced_at,payment_invoice_id,points_redeemed'
    );
  const { data, error } = await (
    UUID_RE.test(orderKey)
      ? query.or(`id.eq.${orderKey},order_ref.eq.${orderKey},external_order_id.eq.${orderKey}`)
      : query.or(`order_ref.eq.${orderKey},external_order_id.eq.${orderKey}`)
  ).maybeSingle();
  if (error) throw new Error(`Order lookup failed: ${error.message}`);
  return data as StoreOrderRow | null;
}

async function loadOrderForSync(options: SyncOrderOptions): Promise<StoreOrderRow | null> {
  if (!isSupabaseConfigured || !supabaseAdmin) return null;

  const query = supabaseAdmin
    .from('orders')
    .select(
      'id,user_id,order_ref,external_order_id,items_snapshot,total_amount,delivery_address,payment_method,status,created_at,odoo_order_ref,odoo_order_id,odoo_invoice_id,odoo_invoice_ref,odoo_invoice_status,odoo_sync_error,odoo_synced_at,payment_invoice_id,points_redeemed'
    );
  const scoped = options.userId ? query.eq('user_id', options.userId) : query;
  const { data, error } = await (
    UUID_RE.test(options.orderKey)
      ? scoped.or(
          `id.eq.${options.orderKey},order_ref.eq.${options.orderKey},external_order_id.eq.${options.orderKey}`
        )
      : scoped.or(`order_ref.eq.${options.orderKey},external_order_id.eq.${options.orderKey}`)
  ).maybeSingle();
  if (error) throw new Error(`Order lookup failed: ${error.message}`);
  return data as StoreOrderRow | null;
}

function orderFromPayload(options: SyncOrderOptions): StoreOrderRow | null {
  const payload = options.payload || {};
  const orderRef = firstString(
    options.orderKey,
    payload.externalOrderId,
    payload.idempotencyKey,
    payload.orderRef
  );
  const lines = Array.isArray(payload.lines)
    ? payload.lines
    : Array.isArray(payload.items)
      ? payload.items
      : [];
  if (!orderRef || lines.length === 0) return null;

  const items = lines.map((line: any) => ({
    id: firstString(line.productId, line.id, line.sku),
    productId: firstString(line.productId, line.id),
    sku: firstString(line.sku),
    odooProductId: line.odooId ?? line.odooProductId ?? null,
    odooSku: firstString(line.odooSku, line.sku),
    name: firstString(line.name, line.sku, 'Бараа'),
    quantity: Number(line.quantity || 0),
    pricePerUnit: Number(line.priceUnit || line.price || 0),
  }));

  return {
    id: orderRef,
    user_id: options.userId || '',
    order_ref: orderRef,
    items_snapshot: items,
    total_amount: Number(payload.amountTotal ?? payload.totalAmount ?? 0),
    delivery_address: firstString(
      payload.deliveryAddress,
      payload.address,
      payload.partner?.street
    ),
    payment_method: firstString(payload.paymentMethod, 'qpay'),
    status: 'paid',
    external_order_id: orderRef,
    odoo_order_ref: null,
    odoo_order_id: null,
    odoo_invoice_id: null,
    odoo_invoice_ref: null,
    odoo_invoice_status: null,
    odoo_sync_error: null,
    odoo_synced_at: null,
  };
}

async function markOrderSynced(
  orderId: string,
  odooOrderRef: string,
  odooOrderId: number | null = null,
  syncError: string | null = null
) {
  if (supabaseAdmin && UUID_RE.test(orderId)) {
    await supabaseAdmin
      .from('orders')
      .update({
        odoo_order_ref: odooOrderRef,
        ...(odooOrderId ? { odoo_order_id: odooOrderId } : {}),
        odoo_synced_at: new Date().toISOString(),
        odoo_sync_error: syncError,
        odoo_last_sync_attempt_at: new Date().toISOString(),
      })
      .eq('id', orderId);
  }
}

async function markOrderInvoice(
  orderId: string,
  invoiceRef: string,
  invoiceId?: number | null,
  status = 'open'
) {
  if (!supabaseAdmin || !UUID_RE.test(orderId)) return;
  await supabaseAdmin
    .from('orders')
    .update({
      odoo_invoice_ref: invoiceRef,
      odoo_invoice_status: status,
      ...(invoiceId ? { odoo_invoice_id: invoiceId } : {}),
    })
    .eq('id', orderId);
}

async function addPersistentLog(
  action: string,
  status: 'success' | 'warning' | 'error',
  message: string,
  details: Record<string, unknown> = {},
  order?: Pick<StoreOrderRow, 'id' | 'order_ref'> | null
) {
  if (!supabaseAdmin) return;
  await supabaseAdmin.from('odoo_sync_logs').insert({
    order_id: order?.id && UUID_RE.test(order.id) ? order.id : null,
    order_ref: order?.order_ref || null,
    action,
    status,
    message: message.slice(0, 1000),
    details,
  });
}

async function markOrderSyncError(orderId: string, message: string) {
  if (supabaseAdmin && UUID_RE.test(orderId)) {
    const { data } = await supabaseAdmin
      .from('orders')
      .select('odoo_sync_attempts')
      .eq('id', orderId)
      .maybeSingle();
    const attempts = Number((data as any)?.odoo_sync_attempts || 0) + 1;
    await supabaseAdmin
      .from('orders')
      .update({
        odoo_sync_error: message.slice(0, 500),
        odoo_sync_attempts: attempts,
        odoo_last_sync_attempt_at: new Date().toISOString(),
      })
      .eq('id', orderId);
  }
}

async function loadStoreProducts(ids: string[]) {
  if (!supabasePublic || ids.length === 0) return new Map<string, any>();

  let result: any = await supabasePublic
    .from('store_products')
    .select('id,name,sku,odoo_product_id,odoo_product_sku')
    .in('id', ids);
  if (result.error && result.error.message.includes('odoo_product')) {
    result = await supabasePublic.from('store_products').select('id,name,sku').in('id', ids);
  }
  if (result.error) throw new Error(`Product mapping lookup failed: ${result.error.message}`);

  return new Map<string, any>(
    (result.data || []).map((product: any) => [String(product.id), product])
  );
}

async function findOrCreatePartner(
  payload: any,
  userEmail: string | undefined,
  order: StoreOrderRow
): Promise<number> {
  const customer = customerFrom(payload, userEmail);
  const address = deliveryAddressFrom(payload, order);
  // `res.partner.mobile` was dropped in Odoo 19 — everything is `phone` now.
  // Naming it made both the lookup and the create fail with "Invalid field
  // 'mobile'" for any customer who has a phone number.
  const domain =
    customer.email && customer.phone
      ? ['|', ['email', '=', customer.email], ['phone', '=', customer.phone]]
      : customer.email
        ? [['email', '=', customer.email]]
        : customer.phone
          ? [['phone', '=', customer.phone]]
          : [['name', '=', customer.name]];

  const partners = await executeKw<Array<{ id: number }>>('res.partner', 'search_read', [domain], {
    fields: ['id'],
    limit: 1,
  });
  if (partners[0]?.id) return partners[0].id;

  return executeKw<number>('res.partner', 'create', [
    {
      name: customer.name,
      email: customer.email || false,
      phone: customer.phone || false,
      street: address || false,
      customer_rank: 1,
    },
  ]);
}

async function loadOdooProducts(items: NormalizedItem[]) {
  const skus = [...new Set(items.map((item) => item.odooSku || item.sku).filter(Boolean))];
  const ids = [
    ...new Set(items.map((item) => item.odooProductId).filter((id): id is number => Boolean(id))),
  ];

  if (!skus.length && !ids.length) return new Map<string, any>();

  const domain =
    skus.length && ids.length
      ? ['|', ['default_code', 'in', skus], ['id', 'in', ids]]
      : skus.length
        ? [['default_code', 'in', skus]]
        : [['id', 'in', ids]];

  const products = await executeKw<any[]>('product.product', 'search_read', [domain], {
    fields: ['id', 'default_code', 'display_name', 'list_price'],
    limit: Math.max(1, skus.length + ids.length),
  });

  const byKey = new Map<string, any>();
  for (const product of products || []) {
    byKey.set(String(product.id), product);
    if (product.default_code) byKey.set(String(product.default_code), product);
  }
  return byKey;
}

function odooProductForItem(products: Map<string, any>, item: NormalizedItem) {
  if (item.odooProductId && products.get(String(item.odooProductId))) {
    return products.get(String(item.odooProductId));
  }
  return products.get(item.odooSku) || products.get(item.sku) || null;
}

async function existingOdooOrder(clientRef: string): Promise<OdooOrderRef | null> {
  const orders = await executeKw<OdooOrderRef[]>(
    'sale.order',
    'search_read',
    [[['client_order_ref', '=', clientRef]]],
    {
      fields: ['id', 'name', 'state', 'amount_total', 'invoice_status', 'invoice_ids'],
      limit: 1,
    }
  );
  return orders[0] || null;
}

async function findOdooOrder(order: StoreOrderRow): Promise<OdooOrderRef | null> {
  if (order.odoo_order_id) {
    const rows = await executeKw<OdooOrderRef[]>('sale.order', 'read', [[order.odoo_order_id]], {
      fields: ['id', 'name', 'state', 'amount_total', 'invoice_status', 'invoice_ids'],
    });
    if (rows[0]) return rows[0];
  }

  if (order.odoo_order_ref) {
    const rows = await executeKw<OdooOrderRef[]>(
      'sale.order',
      'search_read',
      [[['name', '=', order.odoo_order_ref]]],
      { fields: ['id', 'name', 'state', 'amount_total', 'invoice_status', 'invoice_ids'], limit: 1 }
    );
    if (rows[0]) return rows[0];
  }

  return existingOdooOrder(order.order_ref);
}

async function deliveryProduct() {
  if (ODOO_DELIVERY_PRODUCT_ID > 0) return { id: ODOO_DELIVERY_PRODUCT_ID };
  if (!ODOO_DELIVERY_PRODUCT_SKU) return null;
  const products = await executeKw<Array<{ id: number }>>(
    'product.product',
    'search_read',
    [[['default_code', '=', ODOO_DELIVERY_PRODUCT_SKU]]],
    { fields: ['id'], limit: 1 }
  );
  return products[0] || null;
}

/** The service product a points discount is booked against. */
async function discountProductBySku(sku: string) {
  if (!sku) return null;
  const products = await executeKw<Array<{ id: number }>>(
    'product.product',
    'search_read',
    [[['default_code', '=', sku]]],
    { fields: ['id'], limit: 1 }
  );
  return products[0] || null;
}

const pointsDiscountProduct = () => discountProductBySku(ODOO_POINTS_PRODUCT_SKU);
const couponDiscountProduct = () => discountProductBySku(ODOO_COUPON_PRODUCT_SKU);

async function createOdooSaleOrder(
  userEmail: string | undefined,
  payload: any,
  order: StoreOrderRow,
  items: NormalizedItem[]
): Promise<{ id: number; name: string; amountTotal: number; duplicate: boolean }> {
  const clientRef = order.order_ref;
  const alreadyExists = await existingOdooOrder(clientRef);
  if (alreadyExists) {
    return {
      id: alreadyExists.id,
      name: alreadyExists.name,
      amountTotal: Number(alreadyExists.amount_total || 0),
      duplicate: true,
    };
  }

  const [partnerId, products] = await Promise.all([
    findOrCreatePartner(payload, userEmail, order),
    loadOdooProducts(items),
  ]);

  const orderLines = [];
  for (const item of items) {
    const product = odooProductForItem(products, item);
    if (!product) {
      throw new Error(`Odoo product not found for ${item.odooSku || item.sku || item.name}`);
    }
    orderLines.push([
      0,
      0,
      {
        product_id: product.id,
        product_uom_qty: item.quantity,
        // Invoice what the customer was charged, not today's Odoo list price:
        // the snapshot froze the price at checkout, and a catalog edit between
        // then and the sync would otherwise bill a different amount. Mongolian
        // VAT is configured tax-inclusive, so this is the gross unit price on
        // both sides. Priceless legacy lines fall back to Odoo's own pricing.
        ...(item.pricePerUnit > 0 ? { price_unit: item.pricePerUnit } : {}),
      },
    ]);
  }

  // Points paid part of this order, so Odoo has to see the discount or its
  // invoice would ask the customer for money they already settled with points.
  const pointsRedeemed = Math.max(0, Math.round(Number(order.points_redeemed || 0)));
  if (pointsRedeemed > 0) {
    const discount = await pointsDiscountProduct();
    if (discount) {
      orderLines.push([
        0,
        0,
        { product_id: discount.id, product_uom_qty: 1, price_unit: -pointsRedeemed },
      ]);
    } else {
      await addPersistentLog(
        'Odoo sale.order sync',
        'warning',
        `${order.order_ref}: ${pointsRedeemed} points discount could not be booked — no "${ODOO_POINTS_PRODUCT_SKU}" product in Odoo`,
        { pointsRedeemed },
        order
      );
    }
  }

  // A coupon reduced what the customer paid, so the sale order has to show it.
  // Without this line Odoo totalled the undiscounted basket: a 10% coupon on
  // 44,000₮ had Odoo claiming 49,000₮ against 44,600₮ collected, overstating
  // revenue and invoicing the customer for money they were already let off.
  const couponDiscount = discountAmountFrom(payload, order);
  if (couponDiscount > 0) {
    const discount = await couponDiscountProduct();
    if (discount) {
      orderLines.push([
        0,
        0,
        { product_id: discount.id, product_uom_qty: 1, price_unit: -couponDiscount },
      ]);
    } else {
      await addPersistentLog(
        'Odoo sale.order sync',
        'warning',
        `${order.order_ref}: ${couponDiscount}₮ coupon discount could not be booked — no "${ODOO_COUPON_PRODUCT_SKU}" product in Odoo`,
        { couponDiscount },
        order
      );
    }
  }

  const deliveryFee = deliveryFeeFrom(payload, order);
  const delivery = deliveryFee > 0 ? await deliveryProduct() : null;
  if (deliveryFee > 0 && delivery) {
    orderLines.push([
      0,
      0,
      {
        product_id: delivery.id,
        product_uom_qty: 1,
        price_unit: deliveryFee,
      },
    ]);
  }

  const address = deliveryAddressFrom(payload, order);
  const noteParts = [
    `Zity order: ${order.order_ref}`,
    address ? `Delivery address: ${address}` : '',
    `Payment: ${order.payment_method || 'qpay'}`,
    `Chef total: ${Math.round(Number(order.total_amount || 0))}`,
    firstString(payload?.couponCode, payload?.coupon_code)
      ? `Coupon: ${firstString(payload?.couponCode, payload?.coupon_code)}`
      : '',
    firstString(payload?.note, payload?.notes),
  ].filter(Boolean);

  const orderId = await executeKw<number>('sale.order', 'create', [
    {
      partner_id: partnerId,
      client_order_ref: clientRef,
      origin: `Zity Delguur ${clientRef}`,
      note: noteParts.join('\n'),
      order_line: orderLines,
      ...(ODOO_PRICELIST_ID > 0 ? { pricelist_id: ODOO_PRICELIST_ID } : {}),
      ...(ODOO_SALES_TEAM_ID > 0 ? { team_id: ODOO_SALES_TEAM_ID } : {}),
      ...(ODOO_SALESPERSON_ID > 0 ? { user_id: ODOO_SALESPERSON_ID } : {}),
      ...(ODOO_COMPANY_ID > 0 ? { company_id: ODOO_COMPANY_ID } : {}),
    },
  ]);

  const [created] = await executeKw<Array<{ name: string; amount_total?: number }>>(
    'sale.order',
    'read',
    [[orderId]],
    { fields: ['name', 'amount_total'] }
  );
  return {
    id: orderId,
    name: created?.name || String(orderId),
    amountTotal: Number(created?.amount_total || 0),
    duplicate: false,
  };
}

/** True when the order was settled through a payment provider, not on delivery. */
function orderWasPrepaid(order: StoreOrderRow): boolean {
  return ['qpay', 'card', 'socialpay'].includes(String(order.payment_method || '').toLowerCase());
}

/**
 * Invoices a synced order, and registers the payment when it was prepaid.
 *
 * Chef only creates an order once a payment intent for the exact amount has
 * been verified, so by the time it reaches Odoo the money is already in.
 * Nothing in the app called `/api/odoo/invoices` — only the smoke test did —
 * which left real orders sitting in Odoo as confirmed sale orders with no
 * invoice, no payment and no revenue recognised. Set
 * ODOO_AUTO_INVOICE_ORDERS=false for businesses that invoice on delivery
 * instead.
 *
 * Never throws: an invoicing problem must not undo a sale order that synced
 * fine. Failures land in the Odoo sync log for the operator to retry.
 */
async function autoInvoiceOrder(order: StoreOrderRow): Promise<void> {
  if (!ODOO_AUTO_INVOICE_ORDERS) return;
  if (order.odoo_invoice_id || order.odoo_invoice_ref) return;

  try {
    const invoice = await createInvoiceForOrder(order, orderWasPrepaid(order));
    await markOrderInvoice(order.id, invoice.invoiceRef, invoice.id, invoice.status);
    await addPersistentLog(
      'Odoo invoice create',
      invoice.duplicate ? 'warning' : 'success',
      `${order.order_ref} → ${invoice.invoiceRef}${invoice.duplicate ? ' (existing)' : ''} (auto)`,
      { duplicate: invoice.duplicate, invoiceId: invoice.id, invoiceStatus: invoice.status },
      order
    );
  } catch (err) {
    console.error('[Odoo auto invoice error]', detailMessage(err));
    await addPersistentLog('Odoo invoice create', 'error', detailMessage(err), {}, order);
  }
}

export async function syncChefOrderToOdoo(options: SyncOrderOptions) {
  let order: StoreOrderRow | null = null;
  try {
    order = (await loadOrderForSync(options)) || orderFromPayload(options);
    if (!order) return { success: false, status: 404, message: 'Order not found' };
    if (order.odoo_order_ref) {
      // An order already in Odoo may still be missing its invoice — the first
      // attempt can fail on its own. A retry is the natural place to repair it.
      await autoInvoiceOrder(order);
      return {
        success: true,
        status: 200,
        odooOrderRef: order.odoo_order_ref,
        odooOrderId: order.odoo_order_id || undefined,
        idempotent: true,
        duplicate: true,
      };
    }
    if (!['paid', 'packing', 'shipping', 'delivered'].includes(order.status || '')) {
      return { success: false, status: 409, message: 'Only paid orders can be synced to Odoo' };
    }

    const productIds = (Array.isArray(order.items_snapshot) ? order.items_snapshot : [])
      .map((item: any) => storeProductIdFrom(item))
      .filter((id: string) => UUID_RE.test(id));
    const storeProducts = await loadStoreProducts([...new Set(productIds)]);
    const items = normalizeOrderItems(order, storeProducts);
    if (!items.length) return { success: false, status: 400, message: 'Order items are required' };

    const odooOrder = await createOdooSaleOrder(
      options.userEmail,
      options.payload || {},
      order,
      items
    );
    await markOrderSynced(order.id, odooOrder.name, odooOrder.id);

    // Totals are compared at sync time, not just by the nightly reconciliation:
    // a sale order worth a different amount than the customer paid is an
    // accounting problem from the moment it is created.
    const chefTotal = Math.round(Number(order.total_amount || 0));
    const odooTotal = Math.round(odooOrder.amountTotal || 0);
    const amountsAgree = !chefTotal || !odooTotal || chefTotal === odooTotal;
    await addPersistentLog(
      'Odoo sale.order sync',
      odooOrder.duplicate || !amountsAgree ? 'warning' : 'success',
      `${order.order_ref} → ${odooOrder.name}${odooOrder.duplicate ? ' (duplicate guarded)' : ''}` +
        (amountsAgree ? '' : ` — amount mismatch: Chef ${chefTotal}, Odoo ${odooTotal}`),
      {
        odooOrderId: odooOrder.id,
        duplicate: odooOrder.duplicate,
        chefTotal,
        odooTotal,
      },
      order
    );

    await autoInvoiceOrder({
      ...order,
      odoo_order_ref: odooOrder.name,
      odoo_order_id: odooOrder.id,
    });

    return {
      success: true,
      status: 200,
      odooOrderRef: odooOrder.name,
      odooOrderId: odooOrder.id,
      duplicate: odooOrder.duplicate,
    };
  } catch (err) {
    console.error('[Odoo order sync error]', detailMessage(err));
    if (order?.id) await markOrderSyncError(order.id, detailMessage(err));
    await addPersistentLog('Odoo sale.order sync', 'error', detailMessage(err), {}, order);
    return { success: false, status: 502, message: cleanOdooMessage(err) };
  }
}

/**
 * Whether a Chef order status is consistent with the Odoo sale order's state.
 *
 * The two are not one-to-one: `sale.order` has no fulfilment stages, so an
 * order being packed or shipped stays `sale` in Odoo. Comparing against a
 * single mapped status reported every in-progress order as a mismatch and
 * buried the drift that reconciliation exists to surface.
 */
export function storeStatusMatchesOdooState(
  status: string | undefined,
  state: string | undefined
): boolean {
  const local = (status || '').toLowerCase();
  switch ((state || '').toLowerCase()) {
    case 'draft':
    case 'sent':
      return local === 'pending';
    case 'sale':
      return ['paid', 'packing', 'shipping', 'delivered'].includes(local);
    case 'done':
      return local === 'delivered';
    case 'cancel':
    case 'cancelled':
      return local === 'cancelled';
    default:
      // An Odoo state we do not model is not evidence of drift.
      return true;
  }
}

function mapOdooStateToStore(state: string | undefined): string | null {
  switch ((state || '').toLowerCase()) {
    case 'draft':
    case 'sent':
      return 'pending';
    case 'sale':
      return 'paid';
    case 'done':
      return 'delivered';
    case 'cancel':
    case 'cancelled':
      return 'cancelled';
    default:
      return null;
  }
}

async function invoiceFromIds(invoiceIds: number[] | undefined) {
  if (!invoiceIds?.length) return null;
  // `read` takes no `limit` — Odoo rejects the whole call ("read() got an
  // unexpected keyword argument 'limit'"), so the ids are sliced instead.
  const invoices = await executeKw<
    Array<{
      id: number;
      name?: string;
      payment_reference?: string;
      payment_state?: string;
      state?: string;
    }>
  >('account.move', 'read', [invoiceIds.slice(0, 1)], {
    fields: ['id', 'name', 'payment_reference', 'payment_state', 'state'],
  });
  const invoice = invoices[0];
  if (!invoice) return null;
  return {
    id: invoice.id,
    invoiceRef: invoice.name || invoice.payment_reference || String(invoice.id),
    status: invoice.payment_state || invoice.state || 'open',
  };
}

async function invoiceRefFromIds(invoiceIds: number[] | undefined): Promise<string> {
  return (await invoiceFromIds(invoiceIds))?.invoiceRef || '';
}

async function postAndMaybePayInvoice(invoiceId: number, paid: boolean) {
  try {
    await executeKw('account.move', 'action_post', [[invoiceId]]);
  } catch {
    // Already posted in many Odoo flows.
  }

  if (!paid || ODOO_PAYMENT_JOURNAL_ID <= 0) return;

  // Registering a payment against an invoice that owes nothing is an error in
  // Odoo ("There's nothing left to pay…"), which turned every repeat call for
  // an already-settled order — the idempotent path — into a failed sync.
  const [invoice] = await executeKw<Array<{ payment_state?: string; amount_residual?: number }>>(
    'account.move',
    'read',
    [[invoiceId]],
    {
      fields: ['payment_state', 'amount_residual'],
    }
  );
  const settled =
    ['paid', 'in_payment', 'reversed'].includes(String(invoice?.payment_state || '')) ||
    Number(invoice?.amount_residual ?? 0) <= 0;
  if (settled) return;

  const registerId = await executeKw<number>(
    'account.payment.register',
    'create',
    [
      {
        journal_id: ODOO_PAYMENT_JOURNAL_ID,
        payment_date: new Date().toISOString().slice(0, 10),
      },
    ],
    {
      context: {
        active_model: 'account.move',
        active_ids: [invoiceId],
      },
    }
  );
  await executeKw('account.payment.register', 'action_create_payments', [[registerId]]);
}

async function createInvoiceForOrder(order: StoreOrderRow, paid: boolean) {
  const odooOrder = await findOdooOrder(order);
  if (!odooOrder) throw new Error('Odoo Order not found');

  const existingInvoice = await invoiceFromIds(odooOrder.invoice_ids);
  if (existingInvoice) {
    await postAndMaybePayInvoice(existingInvoice.id, paid);
    const refreshed = (await invoiceFromIds([existingInvoice.id])) || existingInvoice;
    return { ...refreshed, duplicate: true };
  }

  if (['draft', 'sent'].includes(String(odooOrder.state || '').toLowerCase())) {
    await executeKw('sale.order', 'action_confirm', [[odooOrder.id]]);
  }

  // Invoicing goes through the standard wizard rather than
  // `sale.order._create_invoices`: Odoo refuses to run private methods over
  // JSON-RPC ("Private methods (such as 'sale.order._create_invoices') cannot
  // be called remotely"), so the direct call failed on every order.
  // "delivered" is the wizard's name for a regular, non-down-payment invoice.
  const context = {
    active_model: 'sale.order',
    active_id: odooOrder.id,
    active_ids: [odooOrder.id],
  };
  const wizardId = await executeKw<number>(
    'sale.advance.payment.inv',
    'create',
    [{ advance_payment_method: 'delivered' }],
    { context }
  );
  await executeKw('sale.advance.payment.inv', 'create_invoices', [[wizardId]], { context });

  const [invoiced] = await executeKw<OdooOrderRef[]>('sale.order', 'read', [[odooOrder.id]], {
    fields: ['invoice_ids'],
  });
  const invoice = await invoiceFromIds(invoiced?.invoice_ids || []);
  if (!invoice) throw new Error('Odoo invoice was created but no reference was returned');
  await postAndMaybePayInvoice(invoice.id, paid);
  const refreshed = (await invoiceFromIds([invoice.id])) || invoice;
  return { ...refreshed, duplicate: false };
}

/**
 * Raises the credit note that reverses `invoiceId`, and posts it.
 *
 * `reverse_moves` leaves the credit note in **draft**. A draft reversal changes
 * nothing in the books: the original invoice still reads as posted and paid, so
 * a cancelled order looked refunded in Chef while Odoo still counted the
 * revenue. Posting it is what actually reverses the entry.
 *
 * Returns the credit note id, or null when no credit note journal is
 * configured (the caller treats that as "reversal not attempted").
 */
async function createCreditNoteForInvoice(invoiceId: number): Promise<number | null> {
  if (ODOO_CREDIT_NOTE_JOURNAL_ID <= 0) return null;

  // Reversing an invoice twice writes a second credit note and hands the
  // customer their money back twice on paper. Cancellation can reach this from
  // the customer's own cancel, an operator's status push and reconciliation, so
  // the check has to live here rather than at each call site.
  const existing = await executeKw<Array<{ id: number; name: string }>>(
    'account.move',
    'search_read',
    [[['reversed_entry_id', '=', invoiceId]]],
    { fields: ['id', 'name'], limit: 1 }
  );
  if (existing[0]) return existing[0].id;

  const reversalId = await executeKw<number>(
    'account.move.reversal',
    'create',
    [
      {
        journal_id: ODOO_CREDIT_NOTE_JOURNAL_ID,
        reason: 'Zity Delguur refund/cancel',
        date: new Date().toISOString().slice(0, 10),
      },
    ],
    {
      context: {
        active_model: 'account.move',
        active_ids: [invoiceId],
      },
    }
  );
  await executeKw('account.move.reversal', 'reverse_moves', [[reversalId]]);

  const [reversal] = await executeKw<Array<{ new_move_ids?: number[] }>>(
    'account.move.reversal',
    'read',
    [[reversalId]],
    { fields: ['new_move_ids'] }
  );
  const creditNoteId = reversal?.new_move_ids?.[0] || null;
  if (!creditNoteId) return null;

  try {
    await executeKw('account.move', 'action_post', [[creditNoteId]]);
  } catch (err) {
    // The reversal exists either way — leave it for an accountant rather than
    // failing the cancellation, but make sure the draft is not silent.
    await addPersistentLog(
      'Odoo credit note post',
      'warning',
      `Credit note ${creditNoteId} created but left in draft: ${detailMessage(err)}`,
      { invoiceId, creditNoteId }
    );
  }
  return creditNoteId;
}

/**
 * Cancels a sale order in Odoo, reversing its invoice first.
 *
 * The credit note comes before the cancellation on purpose: reversing an
 * invoice is what actually undoes the money, and if the cancellation then
 * fails the books are still square. The resulting state is read back because
 * Odoo declines to cancel some orders (an invoice that cannot be reversed
 * leaves the order confirmed) and reports it by returning an action rather
 * than raising, which would otherwise look like success.
 */
async function cancelInOdoo(odooOrderId: number, order: StoreOrderRow) {
  // `odoo_invoice_id` is only filled in by the routes that create the invoice.
  // An order invoiced in Odoo directly — or one whose invoice a status pull
  // found before this fix recorded ids — has no id locally, and reading it off
  // the Odoo order is what keeps that order's refund from being skipped.
  let invoiceId = order.odoo_invoice_id || null;
  if (!invoiceId) {
    const [remote] = await executeKw<Array<{ invoice_ids?: number[] }>>(
      'sale.order',
      'read',
      [[odooOrderId]],
      { fields: ['invoice_ids'] }
    );
    invoiceId = (await invoiceFromIds(remote?.invoice_ids))?.id || null;
  }

  if (invoiceId) {
    try {
      await createCreditNoteForInvoice(invoiceId);
    } catch (err) {
      await addPersistentLog(
        'Odoo credit note',
        'error',
        `${order.order_ref}: ${detailMessage(err)}`,
        { invoiceId },
        order
      );
      throw err;
    }
  }

  await executeKw('sale.order', 'action_cancel', [[odooOrderId]]);

  const [state] = await executeKw<Array<{ state?: string }>>(
    'sale.order',
    'read',
    [[odooOrderId]],
    { fields: ['state'] }
  );
  const cancelled = String(state?.state || '').toLowerCase() === 'cancel';
  await addPersistentLog(
    'Odoo order cancel',
    cancelled ? 'success' : 'warning',
    cancelled
      ? `${order.order_ref} cancelled in Odoo`
      : `${order.order_ref} could not be cancelled in Odoo (state ${state?.state || 'unknown'}) — cancel it there by hand`,
    { odooOrderId, state: state?.state || '' },
    order
  );

  // The credit note above only balances the ledger — it moves no money. An
  // admin cancelling from here has to return the payment just as the customer
  // path does. `refundOrderPayment` claims the refund with a conditional
  // update, so a cancellation arriving from both paths refunds exactly once.
  await refundCancelledOrder(order);

  return cancelled;
}

/**
 * Returns a cancelled order's payment, and records the outcome where an
 * operator will see it. Never throws: the Odoo side is already cancelled, and
 * a gateway problem must not undo that.
 */
async function refundCancelledOrder(order: StoreOrderRow) {
  const invoiceId = String((order as any).payment_invoice_id || '');
  try {
    const refund = await refundOrderPayment({
      invoiceId,
      amount: Number(order.total_amount || 0) || undefined,
      reason: `Order ${order.order_ref} cancelled`,
    });
    if (refund.status === 'refunded') {
      await addPersistentLog(
        'Payment refund',
        'success',
        `${order.order_ref} refunded${refund.refundRef ? ` (ref ${refund.refundRef})` : ''}`,
        { invoiceId, refundRef: refund.refundRef || '' },
        order
      );
    } else if (refund.status !== 'already') {
      // manual / failed — money still owed. Loud on purpose.
      await addPersistentLog(
        'Payment refund',
        refund.status === 'failed' ? 'error' : 'warning',
        `${order.order_ref} NOT refunded: ${refund.reason}`,
        { invoiceId, outcome: refund.status },
        order
      );
    }
  } catch (err) {
    await addPersistentLog(
      'Payment refund',
      'error',
      `${order.order_ref} refund attempt threw: ${detailMessage(err)}`,
      { invoiceId },
      order
    );
  }
}

/**
 * Cancels the Odoo side of a Chef order. Safe to call for any order: one that
 * never reached Odoo has nothing to cancel.
 */
export async function cancelChefOrderInOdoo(options: {
  orderKey: string;
  userId?: string;
}): Promise<void> {
  if (!isOdooConfigured) return;
  const order = await loadOrderForSync({ orderKey: options.orderKey, userId: options.userId });
  if (!order || (!order.odoo_order_ref && !order.odoo_order_id)) return;

  const odooOrder = await findOdooOrder(order);
  if (!odooOrder) return;

  // Not an early return when Odoo already says `cancel`: an order cancelled on
  // the Odoo side still has a posted, paid invoice against it, and reversing
  // that is the half nobody else does. `cancelInOdoo` is safe to repeat.
  await cancelInOdoo(odooOrder.id, order);
}

/**
 * Ships the Odoo delivery order behind a Chef order that has been delivered.
 *
 * Without this the sale side of Odoo was complete — order, invoice, payment —
 * while the warehouse side never moved: every delivery order sat in "Ready"
 * forever, on-hand quantities never fell, and the product sync then copied
 * those frozen numbers back into the shop as if nothing had been sold.
 *
 * Never throws. A delivery Odoo will not validate (no stock, a wizard asking
 * about a backorder) is logged for the operator, who can finish it by hand;
 * the Chef order stays delivered either way.
 */
async function validateOdooDelivery(odooOrderId: number, order: StoreOrderRow): Promise<boolean> {
  const [saleOrder] = await executeKw<Array<{ picking_ids?: number[] }>>(
    'sale.order',
    'read',
    [[odooOrderId]],
    { fields: ['picking_ids'] }
  );
  const pickingIds = saleOrder?.picking_ids || [];
  if (pickingIds.length === 0) return true;

  const pickings = await executeKw<Array<{ id: number; name: string; state?: string }>>(
    'stock.picking',
    'read',
    [pickingIds],
    { fields: ['id', 'name', 'state'] }
  );

  let allDone = true;
  for (const picking of pickings) {
    const state = String(picking.state || '').toLowerCase();
    if (state === 'done' || state === 'cancel') continue;

    try {
      // Reserve what is available first; an unreserved picking validates to
      // nothing. Both calls are public API in every supported Odoo version.
      await executeKw('stock.picking', 'action_assign', [[picking.id]]);
      await executeKw('stock.picking', 'button_validate', [[picking.id]], {
        // Ship what is there rather than stopping on the backorder question,
        // which over JSON-RPC would come back as an action nobody can answer.
        context: { skip_backorder: true, picking_ids_not_to_backorder: [picking.id] },
      });
    } catch (err) {
      allDone = false;
      await addPersistentLog(
        'Odoo delivery validate',
        'warning',
        `${order.order_ref}: ${picking.name} could not be validated — ${detailMessage(err)}`,
        { pickingId: picking.id },
        order
      );
      continue;
    }

    const [after] = await executeKw<Array<{ state?: string }>>(
      'stock.picking',
      'read',
      [[picking.id]],
      { fields: ['state'] }
    );
    const done = String(after?.state || '').toLowerCase() === 'done';
    if (!done) allDone = false;
    await addPersistentLog(
      'Odoo delivery validate',
      done ? 'success' : 'warning',
      done
        ? `${order.order_ref}: ${picking.name} delivered`
        : `${order.order_ref}: ${picking.name} still ${after?.state || 'open'} — finish it in Odoo`,
      { pickingId: picking.id, state: after?.state || '' },
      order
    );
  }
  return allDone;
}

/**
 * Marks a Chef order's Odoo delivery as shipped. Safe for any order: one that
 * never reached Odoo, or has no warehouse move, does nothing.
 */
export async function markChefOrderDeliveredInOdoo(options: {
  orderKey: string;
  userId?: string;
}): Promise<void> {
  if (!isOdooConfigured || !ODOO_VALIDATE_DELIVERY) return;
  const order = await loadOrderForSync({ orderKey: options.orderKey, userId: options.userId });
  if (!order || (!order.odoo_order_ref && !order.odoo_order_id)) return;

  const odooOrder = await findOdooOrder(order);
  if (!odooOrder) return;
  if (String(odooOrder.state || '').toLowerCase() === 'cancel') return;

  await validateOdooDelivery(odooOrder.id, order);
}

async function fetchOdooProducts(limit: number) {
  try {
    return await executeKw<any[]>('product.product', 'search_read', [[['sale_ok', '=', true]]], {
      fields: [
        'id',
        'default_code',
        'barcode',
        'display_name',
        'list_price',
        'qty_available',
        'free_qty',
        'is_storable',
        'uom_id',
      ],
      limit,
    });
  } catch {
    return executeKw<any[]>('product.product', 'search_read', [[['sale_ok', '=', true]]], {
      fields: ['id', 'default_code', 'barcode', 'display_name', 'list_price', 'uom_id'],
      limit,
    });
  }
}

/**
 * What Odoo says is left to sell.
 *
 * `qty_available` is what sits on the shelf, including everything already
 * reserved for confirmed orders; `free_qty` is what is actually still sellable.
 * Chef takes stock out of its own catalog the moment an order is placed, while
 * Odoo only moves it when the delivery is validated — so syncing the on-hand
 * figure handed those reservations straight back, and the same last unit could
 * be sold again. `free_qty` already has Chef's confirmed orders subtracted,
 * which makes the two systems agree.
 */
function sellableQuantity(product: any): number | null {
  const free = Number(product?.free_qty);
  if (Number.isFinite(free)) return free;
  const onHand = Number(product?.qty_available);
  return Number.isFinite(onHand) ? onHand : null;
}

/** Products whose stock Odoo actually maintains. */
function inventoryTracked(products: any[]): any[] {
  return (products || []).filter(
    (product) =>
      product.default_code && product.is_storable !== false && sellableQuantity(product) !== null
  );
}

/**
 * True when Odoo reports zero on-hand for *every* tracked product.
 *
 * That is what a database with no inventory loaded looks like — not a real
 * sell-out of the whole catalog. Copying it into `store_products` takes the
 * shop offline, because checkout rejects any line whose `stock_quantity` is
 * below the requested quantity: a routine "sync products" would make every
 * basket unbuyable. A genuine partial stockout has at least one product with
 * stock left, so it syncs normally.
 */
export function catalogStockIsUnloaded(products: any[]): boolean {
  const tracked = inventoryTracked(products);
  return tracked.length > 0 && tracked.every((product) => sellableQuantity(product) === 0);
}

/**
 * Odoo's unit of measure, in the shop's words.
 *
 * Odoo names its units in English ("Units", "kg"), and writing that straight
 * into the catalog put "Units" on a price tag in a Mongolian shop.
 */
function shopUnitFromOdoo(uom: string): string {
  const name = uom.toLowerCase().trim();
  if (['kg', 'kgs', 'kilogram', 'kilograms', 'кг'].includes(name)) return 'кг';
  if (['g', 'gram', 'grams', 'гр'].includes(name)) return 'гр';
  if (['l', 'liter', 'liters', 'litre', 'litres', 'л'].includes(name)) return 'л';
  if (['ml', 'мл'].includes(name)) return 'мл';
  return 'ш';
}

/** SKUs the bridge uses for its own accounting lines, never for the shop. */
function isInternalSku(sku: string): boolean {
  return [ODOO_DELIVERY_PRODUCT_SKU, ODOO_POINTS_PRODUCT_SKU]
    .filter(Boolean)
    .some((internal) => internal.toLowerCase() === sku.toLowerCase());
}

/**
 * Brings products that exist only in Odoo into the Chef catalog.
 *
 * Odoo is the product master, but the sync could only ever *update* rows it
 * already had: a product created in Odoo — the place the shop is supposed to be
 * managed from — simply never appeared in the app. New rows land with what Odoo
 * knows (name, price, stock, unit) and defaults for what it does not (emoji,
 * category, shelf life), and are logged so somebody can dress them properly.
 */
async function importNewOdooProducts(products: any[], stockIsUnloaded: boolean): Promise<string[]> {
  if (!supabaseAdmin) return [];

  const sellables = (products || []).filter(
    (product) =>
      product.default_code &&
      !isInternalSku(String(product.default_code)) &&
      product.is_storable !== false
  );
  if (sellables.length === 0) return [];

  const codes = sellables.map((product) => String(product.default_code));
  const [bySku, byOdooSku] = await Promise.all([
    supabaseAdmin.from('store_products').select('sku').in('sku', codes),
    supabaseAdmin.from('store_products').select('odoo_product_sku').in('odoo_product_sku', codes),
  ]);
  const known = new Set<string>([
    ...(bySku.data || []).map((row: any) => String(row.sku)),
    ...(byOdooSku.data || []).map((row: any) => String(row.odoo_product_sku)),
  ]);

  const missing = sellables.filter((product) => !known.has(String(product.default_code)));
  if (missing.length === 0) return [];

  const { data: last } = await supabaseAdmin
    .from('store_products')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  let sortOrder = Number((last as any)?.sort_order || 0);

  const rows = missing.map((product) => {
    sortOrder += 10;
    const sellable = sellableQuantity(product);
    return {
      name: String(product.display_name || product.default_code).replace(/^\[[^\]]*\]\s*/, ''),
      emoji: '📦',
      // Odoo has no notion of the shop's aisles, so new arrivals land in the
      // catch-all until someone files them.
      category: '🧂 Амтлагч',
      unit: shopUnitFromOdoo(Array.isArray(product.uom_id) ? String(product.uom_id[1] || '') : ''),
      price_per_unit: Number(product.list_price || 0),
      sku: String(product.default_code),
      odoo_product_id: product.id,
      odoo_product_sku: String(product.default_code),
      stock_quantity: stockIsUnloaded || sellable === null ? 0 : Math.max(0, Math.floor(sellable)),
      expiry_days: 7,
      // Nothing goes on sale with no stock and no curation behind it.
      in_stock: false,
      sort_order: sortOrder,
    };
  });

  const { error } = await supabaseAdmin.from('store_products').insert(rows);
  if (error) {
    console.error('[Odoo product import]', error.message);
    return [];
  }

  const names = rows.map((row) => `${row.sku} (${row.name})`);
  await addPersistentLog(
    'Odoo product sync',
    'warning',
    `${rows.length} product(s) imported from Odoo and left hidden until they have a category, ` +
      `emoji and shelf life: ${names.join(', ')}`,
    { imported: names }
  );
  return names;
}

async function syncOdooProductsToStore(products: any[]) {
  if (!supabaseAdmin) return 0;

  // Prices and Odoo ids still sync; only the stock column is held back.
  const tracked = inventoryTracked(products);
  const stockIsUnloaded = catalogStockIsUnloaded(products);
  if (stockIsUnloaded) {
    await addPersistentLog(
      'Odoo product sync',
      'warning',
      `Odoo reports 0 on hand for all ${tracked.length} tracked products — stock levels left ` +
        'untouched. Load inventory in Odoo before relying on stock sync.',
      { trackedProducts: tracked.length }
    );
  }

  const updates = (products || [])
    .filter((product) => product.default_code)
    .flatMap((product) => {
      const patch: Record<string, unknown> = {
        odoo_product_id: product.id,
        odoo_product_sku: product.default_code,
        price_per_unit: Number(product.list_price || 0),
      };
      // Only inventory-tracked products carry a meaningful `qty_available`.
      // Services and consumables always report 0, and copying that over would
      // take a perfectly sellable product out of stock in the shop.
      const sellable = sellableQuantity(product);
      if (!stockIsUnloaded && product.is_storable !== false && sellable !== null) {
        patch.stock_quantity = Math.max(0, Math.floor(sellable));
      }
      return [
        supabaseAdmin.from('store_products').update(patch).eq('sku', product.default_code),
        supabaseAdmin
          .from('store_products')
          .update(patch)
          .eq('odoo_product_sku', product.default_code),
      ];
    });
  await Promise.all(updates);

  await importNewOdooProducts(products, stockIsUnloaded);
  return updates.length;
}

function serializeOdooProducts(products: any[]) {
  return (products || []).map((product) => ({
    id: product.id,
    sku: product.default_code || '',
    barcode: product.barcode || '',
    name: product.display_name || '',
    price: Number(product.list_price || 0),
    stock: sellableQuantity(product),
    unit: Array.isArray(product.uom_id) ? product.uom_id[1] : '',
  }));
}

router.get('/status', async (_req, res) => {
  if (!isOdooConfigured) {
    return res.json({ configured: false, connected: false });
  }
  try {
    await authenticateOdoo();
    let failedSyncs = 0;
    let neverSynced = 0;
    let lastError = '';
    if (supabaseAdmin) {
      const [countRes, lastRes, neverRes] = await Promise.all([
        supabaseAdmin
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .is('odoo_order_ref', null)
          .not('odoo_sync_error', 'is', null),
        supabaseAdmin
          .from('orders')
          .select('odoo_sync_error')
          .not('odoo_sync_error', 'is', null)
          .order('odoo_last_sync_attempt_at', { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle(),
        // Paid orders that never even reached Odoo. They carry no sync error, so
        // the count above missed them entirely and the dashboard stayed green
        // while orders were absent from the ledger.
        supabaseAdmin
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .is('odoo_order_ref', null)
          .in('status', SYNCABLE_ORDER_STATUSES),
      ]);
      failedSyncs = countRes.count || 0;
      neverSynced = neverRes.count || 0;
      lastError = String((lastRes.data as any)?.odoo_sync_error || '');
    }
    return res.json({
      configured: true,
      connected: true,
      alert: failedSyncs > 0 || neverSynced > 0,
      failedSyncs,
      neverSynced,
      lastError,
      // Which Odoo this bridge talks to, for the admin screen to display. Only
      // the host and database name — never the API user or the key. The client
      // used to carry these as VITE_ODOO_* build-time values, which put the
      // Odoo host, database and API account e-mail into every visitor's bundle.
      host: odooHost(),
      db: ODOO_DB,
    });
  } catch (err) {
    console.error('[Odoo status error]', detailMessage(err));
    return res.status(502).json({
      configured: true,
      connected: false,
      message: cleanOdooMessage(err),
    });
  }
});

router.get(
  '/products',
  authenticateToken,
  requireSignedIn,
  async (req: AuthenticatedRequest, res) => {
    try {
      const limit = Math.min(500, Math.max(1, Number(process.env.ODOO_PRODUCT_LIMIT || 200)));
      const products = await fetchOdooProducts(limit);

      if (req.query.sync === 'true' && !isChefAdmin(req)) {
        return res.status(403).json({ success: false, message: 'CHEF_ADMIN_REQUIRED' });
      }

      if (req.query.sync === 'true' && supabaseAdmin) {
        await syncOdooProductsToStore(products);
      }

      return res.json({ products: serializeOdooProducts(products) });
    } catch (err) {
      console.error('[Odoo products error]', detailMessage(err));
      return res.status(502).json({ success: false, message: cleanOdooMessage(err) });
    }
  }
);

router.post(
  '/orders',
  authenticateToken,
  requireSignedIn,
  async (req: AuthenticatedRequest, res) => {
    const orderKey = orderKeyFrom(req.body);
    if (!orderKey) {
      return res.status(400).json({
        success: false,
        message: 'orderId, orderRef, or chefOrderRef is required',
      });
    }

    const result = await syncChefOrderToOdoo({
      orderKey,
      userId: req.user!.id,
      userEmail: req.user!.email,
      payload: req.body,
    });
    return res.status(result.status).json(result);
  }
);

router.post(
  '/orders/status',
  authenticateToken,
  requireSignedIn,
  async (req: AuthenticatedRequest, res) => {
    if (req.body?.orderId || req.body?.externalOrderId || req.body?.orderRef) {
      const orderKey = firstString(
        req.body?.externalOrderId,
        req.body?.orderId,
        req.body?.orderRef
      );
      const status = firstString(req.body?.status).toLowerCase();
      if (!orderKey || !status) {
        return res.status(400).json({ success: false, message: 'ORDER_STATUS_REQUIRED' });
      }

      try {
        const order = await loadOrderForSync({ orderKey, userId: req.user!.id });
        if (!order) return res.status(404).json({ success: false, message: 'ORDER_NOT_FOUND' });
        const sync = await syncChefOrderToOdoo({
          orderKey,
          userId: req.user!.id,
          userEmail: req.user!.email,
          payload: req.body,
        });
        if (!sync.success) return res.status(sync.status).json(sync);

        const odooOrder = await findOdooOrder({
          ...order,
          odoo_order_ref: sync.odooOrderRef || order.odoo_order_ref,
          odoo_order_id: sync.odooOrderId || order.odoo_order_id,
        });
        if (!odooOrder)
          return res.status(404).json({ success: false, message: 'ODOO_ORDER_NOT_FOUND' });

        if (['cancelled', 'canceled', 'cancel'].includes(status)) {
          await cancelInOdoo(odooOrder.id, order);
        } else if (['delivered', 'shipping', 'packing', 'paid'].includes(status)) {
          if (['draft', 'sent'].includes(String(odooOrder.state || '').toLowerCase())) {
            await executeKw('sale.order', 'action_confirm', [[odooOrder.id]]);
          }
          // Delivered is the point at which the goods actually leave: ship the
          // warehouse move too, or Odoo's on-hand figures never change.
          if (status === 'delivered' && ODOO_VALIDATE_DELIVERY) {
            await validateOdooDelivery(odooOrder.id, order);
          }
          // Delivered from this side too: the customer's fridge is stocked with
          // what they bought, exactly once per order.
          if (status === 'delivered') {
            await stockFridgeFromOrder(order.id).catch((err) =>
              console.warn(`[fridge restock] ${order.order_ref}: ${detailMessage(err)}`)
            );
            await awardPointsForOrder(order.id).catch((err) =>
              console.warn(`[loyalty] ${order.order_ref}: ${detailMessage(err)}`)
            );
          }
        }

        if (supabaseAdmin && ['packing', 'shipping', 'delivered', 'cancelled'].includes(status)) {
          await supabaseAdmin.from('orders').update({ status }).eq('id', order.id);
        }
        await addPersistentLog(
          'Odoo order status push',
          'success',
          `${order.order_ref} status pushed as ${status}`,
          { status, odooOrderId: odooOrder.id },
          order
        );
        return res.json({
          success: true,
          externalOrderId: order.order_ref,
          odooOrderRef: odooOrder.name,
          status,
        });
      } catch (err) {
        console.error('[Odoo order status push error]', detailMessage(err));
        await addPersistentLog('Odoo order status push', 'error', detailMessage(err));
        return res.status(502).json({ success: false, message: cleanOdooMessage(err) });
      }
    }

    const requested = Array.isArray(req.body?.orders) ? req.body.orders : [];
    if (!requested.length) return res.json({ orders: [] });

    try {
      const rows = await Promise.all(
        requested.slice(0, 100).map(async (item: any) => {
          const orderKey = firstString(item?.externalOrderId, item?.orderId, item?.odooOrderRef);
          if (!orderKey) return null;
          const order = await loadOrderForSync({ orderKey, userId: req.user!.id });
          if (!order) return null;
          const odooOrder = await findOdooOrder(order);
          if (!odooOrder) {
            return {
              externalOrderId: order.order_ref,
              odooOrderRef: order.odoo_order_ref || '',
              state: '',
              invoiceRef: order.odoo_invoice_ref || '',
            };
          }

          // Record the invoice *id*, not just its reference. A status pull used
          // to store the ref alone, so an order whose invoice was discovered
          // this way kept `odoo_invoice_id` null — and cancelling it later
          // raised no credit note, because that path keys off the id.
          const discovered =
            order.odoo_invoice_id && order.odoo_invoice_ref
              ? null
              : await invoiceFromIds(odooOrder.invoice_ids);
          const invoiceRef = discovered?.invoiceRef || order.odoo_invoice_ref || '';
          if (
            discovered &&
            (discovered.invoiceRef !== order.odoo_invoice_ref ||
              discovered.id !== order.odoo_invoice_id)
          ) {
            await markOrderInvoice(
              order.id,
              discovered.invoiceRef,
              discovered.id,
              discovered.status
            );
          }

          // Only Odoo states that actually contradict the local one are applied.
          // Odoo keeps a confirmed order at `sale` through packing and shipping,
          // so mapping that back unconditionally walked every order being
          // fulfilled right back to `paid` on each status pull.
          const mappedStatus = mapOdooStateToStore(odooOrder.state);
          if (
            mappedStatus &&
            supabaseAdmin &&
            !storeStatusMatchesOdooState(order.status, odooOrder.state)
          ) {
            await supabaseAdmin.from('orders').update({ status: mappedStatus }).eq('id', order.id);
          }

          return {
            externalOrderId: order.order_ref,
            odooOrderRef: odooOrder.name,
            odooOrderId: odooOrder.id,
            state: odooOrder.state || '',
            invoiceStatus: odooOrder.invoice_status || '',
            invoiceRef,
            amountTotal: Number(odooOrder.amount_total || 0),
          };
        })
      );

      return res.json({ orders: rows.filter(Boolean) });
    } catch (err) {
      console.error('[Odoo order status error]', detailMessage(err));
      await addPersistentLog('Odoo order status sync', 'error', detailMessage(err));
      return res.status(502).json({ success: false, message: cleanOdooMessage(err) });
    }
  }
);

router.get(
  '/orders/failed',
  authenticateToken,
  requireSignedIn,
  async (req: AuthenticatedRequest, res) => {
    if (!isChefAdmin(req)) {
      return res.status(403).json({ success: false, message: 'CHEF_ADMIN_REQUIRED' });
    }
    if (!supabaseAdmin) {
      return res.status(503).json({ success: false, message: 'Supabase admin is not configured' });
    }

    const { data, error } = await supabaseAdmin
      .from('orders')
      .select(
        'id,order_ref,status,total_amount,created_at,odoo_sync_error,odoo_last_sync_attempt_at,profiles(display_name,email)'
      )
      // Any payable order that is not in Odoo, not only the ones that recorded
      // an error. An order nobody ever attempted has no error to filter on, so
      // requiring one hid exactly the orders most worth chasing — the operator
      // screen showed nothing while revenue sat outside the ledger. Same rule
      // reconciliation and /status now use.
      .is('odoo_order_ref', null)
      .in('status', SYNCABLE_ORDER_STATUSES)
      .order('odoo_last_sync_attempt_at', { ascending: false, nullsFirst: false })
      .limit(50);
    if (error) {
      console.error('[Odoo failed orders error]', error.message);
      return res.status(502).json({ success: false, message: 'Failed to load failed Odoo syncs' });
    }

    return res.json({
      orders: (data || []).map((order: any) => {
        const profile = Array.isArray(order.profiles) ? order.profiles[0] : order.profiles;
        return {
          id: order.order_ref || order.id,
          status: order.status,
          totalAmount: Number(order.total_amount || 0),
          /** No error recorded means the sync was never attempted, not that it passed. */
          neverAttempted: !order.odoo_sync_error,
          customerName: profile?.display_name || profile?.email?.split('@')[0] || '',
          customerEmail: profile?.email || '',
          syncError: order.odoo_sync_error || '',
          lastAttemptAt: order.odoo_last_sync_attempt_at || '',
          createdAt: order.created_at || '',
        };
      }),
    });
  }
);

router.post(
  '/invoices',
  authenticateToken,
  requireSignedIn,
  async (req: AuthenticatedRequest, res) => {
    const orderKey = firstString(
      req.body?.externalOrderId,
      req.body?.orderId,
      req.body?.odooOrderRef
    );
    if (!orderKey) return res.status(400).json({ success: false, message: 'ORDER_ID_REQUIRED' });

    try {
      const order = await loadOrderForSync({ orderKey, userId: req.user!.id });
      if (!order) return res.status(404).json({ success: false, message: 'ORDER_NOT_FOUND' });
      if (!order.odoo_order_ref && !order.odoo_order_id) {
        return res.status(409).json({ success: false, message: 'ORDER_NOT_SYNCED_TO_ODOO' });
      }

      const paymentStatus = firstString(
        req.body?.paymentStatus,
        req.body?.payment_status
      ).toLowerCase();
      const paid = paymentStatus === 'paid' || orderWasPrepaid(order);
      const invoice = await createInvoiceForOrder(order, paid);
      await markOrderInvoice(order.id, invoice.invoiceRef, invoice.id, invoice.status);
      await addPersistentLog(
        'Odoo invoice create',
        invoice.duplicate ? 'warning' : 'success',
        `${order.order_ref} → ${invoice.invoiceRef}${invoice.duplicate ? ' (existing)' : ''}`,
        {
          duplicate: invoice.duplicate,
          paid,
          invoiceId: invoice.id,
          invoiceStatus: invoice.status,
        },
        order
      );
      return res.json({
        success: true,
        invoiceId: invoice.id,
        invoiceRef: invoice.invoiceRef,
        invoiceStatus: invoice.status,
        duplicate: invoice.duplicate,
      });
    } catch (err) {
      console.error('[Odoo invoice error]', detailMessage(err));
      await addPersistentLog('Odoo invoice create', 'error', detailMessage(err));
      return res.status(502).json({ success: false, message: cleanOdooMessage(err) });
    }
  }
);

router.get('/logs', authenticateToken, requireSignedIn, async (req: AuthenticatedRequest, res) => {
  if (!isChefAdmin(req)) {
    return res.status(403).json({ success: false, message: 'CHEF_ADMIN_REQUIRED' });
  }
  if (!supabaseAdmin) {
    return res.status(503).json({ success: false, message: 'Supabase admin is not configured' });
  }

  const { data, error } = await supabaseAdmin
    .from('odoo_sync_logs')
    .select('id,created_at,action,status,message,details')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) {
    console.error('[Odoo logs error]', error.message);
    return res.status(502).json({ success: false, message: 'Failed to load Odoo logs' });
  }

  return res.json({
    logs: (data || []).map((log: any) => ({
      id: log.id,
      timestamp: log.created_at,
      action: log.action,
      status: publicLogStatus(log.status),
      message: log.message,
      details: log.details ? JSON.stringify(log.details) : undefined,
    })),
  });
});

/**
 * Brings a Chef order in line with an Odoo cancellation.
 *
 * Everything a cancellation owes the customer: the order stops, the stock goes
 * back on the shelf, the points they spent return, and the invoice is reversed.
 * Returns the order reference when it acted, so reconciliation can report it.
 */
async function applyOdooCancellation(order: StoreOrderRow): Promise<string | null> {
  if (!supabaseAdmin) return null;
  try {
    // The reconciliation scan reads a handful of columns across 500 orders; the
    // basket and the invoice id are only needed for the few it repairs, and
    // without them the stock release and the credit note below would quietly do
    // nothing at all.
    const { data: full, error: readError } = await supabaseAdmin
      .from('orders')
      .select('id,order_ref,items_snapshot,odoo_invoice_id')
      .eq('id', order.id)
      .maybeSingle();
    if (readError) throw new Error(readError.message);

    // Claim the cancellation: only the call that actually moves the order out of
    // its live status may hand back its stock and points. Repeating the release
    // would put goods on the shelf that were never taken off it.
    const { data: claimed, error } = await supabaseAdmin
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', order.id)
      .neq('status', 'cancelled')
      .select('id');
    if (error) throw new Error(error.message);
    if (!claimed || claimed.length === 0) return null;

    await releaseStock((full as any)?.items_snapshot);
    await refundPointsForOrder(order.id);
    const invoiceId = Number((full as any)?.odoo_invoice_id || 0);
    if (invoiceId > 0) await createCreditNoteForInvoice(invoiceId);

    await addPersistentLog(
      'Odoo reconciliation',
      'warning',
      `${order.order_ref} was cancelled in Odoo — cancelled in Chef, stock and points returned`,
      { odooOrderRef: order.odoo_order_ref },
      order
    );
    return order.order_ref;
  } catch (err) {
    await addPersistentLog(
      'Odoo reconciliation',
      'error',
      `${order.order_ref}: could not apply the Odoo cancellation — ${detailMessage(err)}`,
      {},
      order
    );
    return null;
  }
}

/**
 * Compares Chef's orders with Odoo's and reports the differences.
 *
 * Exported so it can run on a timer as well as on demand: drift that nobody
 * looks for is drift nobody finds, and a manual button is only pressed after
 * someone already suspects a problem.
 */
export async function reconcileOdooOrders() {
  if (!supabaseAdmin) throw new Error('Supabase admin is not configured');

  const { data: localOrders, error } = await supabaseAdmin
    .from('orders')
    .select('id,order_ref,total_amount,status,odoo_order_ref,odoo_order_id')
    .not('odoo_order_ref', 'is', null)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);

  // Orders that never reached Odoo at all.
  //
  // Reconciliation only looked at rows that already had an `odoo_order_ref`, and
  // /orders/failed only at rows that had a recorded `odoo_sync_error`. A paid
  // order that was never even attempted has neither, so it fell between the two
  // filters and no screen in the system could show it — revenue booked in Chef
  // and absent from the ledger, while reconciliation reported "clean".
  const { data: neverSyncedRows } = await supabaseAdmin
    .from('orders')
    .select('id,order_ref,total_amount,status,created_at')
    .is('odoo_order_ref', null)
    .in('status', SYNCABLE_ORDER_STATUSES)
    .order('created_at', { ascending: false })
    .limit(200);
  const neverSynced = neverSyncedRows || [];

  const refs = (localOrders || []).map((order: any) => order.odoo_order_ref).filter(Boolean);
  const odooOrders = refs.length
    ? await executeKw<OdooOrderRef[]>('sale.order', 'search_read', [[['name', 'in', refs]]], {
        fields: ['id', 'name', 'state', 'amount_total', 'client_order_ref'],
        limit: refs.length,
      })
    : [];
  const byRef = new Map((odooOrders || []).map((order: any) => [String(order.name), order]));
  const byExternal = new Map(
    (localOrders || []).map((order: any) => [String(order.order_ref), order])
  );
  const remoteByExternal = await executeKw<OdooOrderRef[]>(
    'sale.order',
    'search_read',
    [[['client_order_ref', 'ilike', 'ZITY-']]],
    {
      fields: ['id', 'name', 'state', 'amount_total', 'client_order_ref'],
      limit: 500,
    }
  );

  const repaired: Promise<string | null>[] = [];
  let missingInOdoo = 0;
  let amountMismatches = 0;
  let statusMismatches = 0;
  let missingInDelguur = 0;
  const mismatches: any[] = [];

  for (const local of localOrders || []) {
    const remote = byRef.get(String((local as any).odoo_order_ref));
    if (!remote) {
      missingInOdoo += 1;
      mismatches.push({ type: 'missing_in_odoo', orderRef: (local as any).order_ref });
      continue;
    }
    // A cancelled order keeps the amount it had, on both sides — Odoo does not
    // zero a cancelled sale order, and Chef does not rewrite the total. The
    // money was reversed by the credit note, so comparing the two is noise that
    // never clears; left in, every cancellation becomes a permanent "mismatch"
    // and the report stops being worth reading.
    const cancelledBothSides =
      String((local as any).status || '').toLowerCase() === 'cancelled' &&
      ['cancel', 'cancelled'].includes(String((remote as any).state || '').toLowerCase());

    if (
      !cancelledBothSides &&
      Math.round(Number((local as any).total_amount || 0)) !==
        Math.round(Number((remote as any).amount_total || 0))
    ) {
      amountMismatches += 1;
      mismatches.push({
        type: 'amount',
        orderRef: (local as any).order_ref,
        delguurAmount: Number((local as any).total_amount || 0),
        odooAmount: Number((remote as any).amount_total || 0),
      });
    }
    if (!storeStatusMatchesOdooState((local as any).status, (remote as any).state)) {
      statusMismatches += 1;
      mismatches.push({
        type: 'status',
        orderRef: (local as any).order_ref,
        delguurStatus: (local as any).status,
        odooState: (remote as any).state,
      });

      // Reconciliation used to stop at reporting. An order cancelled in Odoo —
      // by the operator who actually handles the warehouse — stayed live in
      // Chef for ever: still on its way as far as the customer could tell,
      // still holding stock, still counted as revenue. That one direction is
      // safe to apply, and applying it is the whole point of noticing.
      if (
        ODOO_APPLY_CANCELLATIONS &&
        String((remote as any).state || '').toLowerCase() === 'cancel' &&
        (local as any).status !== 'cancelled'
      ) {
        repaired.push(applyOdooCancellation(local as StoreOrderRow));
      }
    }
  }

  for (const remote of remoteByExternal || []) {
    const external = String((remote as any).client_order_ref || '');
    if (external && !byExternal.has(external)) {
      missingInDelguur += 1;
      mismatches.push({
        type: 'missing_in_delguur',
        orderRef: external,
        odooOrderRef: remote.name,
      });
    }
  }

  for (const order of neverSynced) {
    mismatches.push({
      type: 'never_synced',
      orderRef: (order as any).order_ref,
      delguurAmount: Number((order as any).total_amount || 0),
      delguurStatus: (order as any).status,
      createdAt: (order as any).created_at,
    });
  }

  const neverSyncedAmount = neverSynced.reduce(
    (sum, order: any) => sum + Number(order.total_amount || 0),
    0
  );

  const cancelledInChef = (await Promise.all(repaired)).filter(Boolean) as string[];

  const summary = {
    cancelledFromOdoo: cancelledInChef,
    checkedOrders: (localOrders || []).length,
    missingInOdoo,
    missingInDelguur,
    neverSynced: neverSynced.length,
    neverSyncedAmount,
    amountMismatches,
    statusMismatches,
    mismatches: mismatches.slice(0, 100),
    message:
      missingInOdoo +
        missingInDelguur +
        neverSynced.length +
        amountMismatches +
        statusMismatches ===
      0
        ? 'Odoo reconciliation clean'
        : 'Odoo reconciliation found mismatches',
  };
  await addPersistentLog('Odoo reconciliation', 'success', summary.message, summary);
  return summary;
}

router.post(
  '/reconcile',
  authenticateToken,
  requireSignedIn,
  async (req: AuthenticatedRequest, res) => {
    if (!isChefAdmin(req)) {
      return res.status(403).json({ success: false, message: 'CHEF_ADMIN_REQUIRED' });
    }
    if (!supabaseAdmin) {
      return res.status(503).json({ success: false, message: 'Supabase admin is not configured' });
    }

    try {
      return res.json(await reconcileOdooOrders());
    } catch (err) {
      console.error('[Odoo reconcile error]', detailMessage(err));
      await addPersistentLog('Odoo reconciliation', 'error', detailMessage(err));
      return res.status(502).json({ success: false, message: cleanOdooMessage(err) });
    }
  }
);

router.post(
  '/orders/:id/retry',
  authenticateToken,
  requireSignedIn,
  async (req: AuthenticatedRequest, res) => {
    if (!isChefAdmin(req)) {
      return res.status(403).json({ success: false, message: 'CHEF_ADMIN_REQUIRED' });
    }
    const result = await syncChefOrderToOdoo({
      orderKey: String(req.params.id || ''),
      userEmail: req.user!.email,
      payload: req.body || {},
    });
    return res.status(result.status).json(result);
  }
);

router.post(
  '/products/sync',
  authenticateToken,
  requireSignedIn,
  async (req: AuthenticatedRequest, res) => {
    if (!isChefAdmin(req)) {
      return res.status(403).json({ success: false, message: 'CHEF_ADMIN_REQUIRED' });
    }
    try {
      const limit = Math.min(500, Math.max(1, Number(process.env.ODOO_PRODUCT_LIMIT || 200)));
      const products = await fetchOdooProducts(limit);
      const updates = await syncOdooProductsToStore(products);
      return res.json({ success: true, products: serializeOdooProducts(products), updates });
    } catch (err) {
      console.error('[Odoo product sync error]', detailMessage(err));
      return res.status(502).json({ success: false, message: cleanOdooMessage(err) });
    }
  }
);

export default router;
