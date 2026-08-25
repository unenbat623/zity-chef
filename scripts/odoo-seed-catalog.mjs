/**
 * Creates the Chef catalog in Odoo, one product per `store_products` SKU.
 *
 * The bridge treats Odoo as the product master: order lines are looked up there
 * by `default_code`, and `/api/odoo/products?sync=true` copies Odoo ids, prices
 * and on-hand quantities back into the Chef catalog. A brand-new Odoo database
 * has no products at all, so every order sync fails with "Odoo product not
 * found" even when the connection itself is healthy. This walks the Chef
 * catalog and creates the missing counterparts.
 *
 * It writes to the live Odoo database, so it does nothing without --confirm.
 * Re-running is safe: a SKU that already exists in Odoo is only linked back to
 * the Chef row, never duplicated.
 *
 * Usage:
 *   node scripts/odoo-seed-catalog.mjs                # dry run — prints the plan
 *   node scripts/odoo-seed-catalog.mjs --confirm      # create products in Odoo
 *   node scripts/odoo-seed-catalog.mjs --confirm --stock 100
 *                                                     # …and set on-hand qty
 *
 * Products are created as storable goods. Until they have stock in Odoo their
 * `qty_available` is 0, and an `/api/odoo/products?sync=true` afterwards will
 * copy that 0 into the catalog's `stock_quantity` — which takes the store out
 * of stock. Load real inventory in Odoo (or pass --stock) before syncing.
 */
import { existsSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  const env = {};
  for (const line of readFileSync(path, 'utf8').split(/\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
  return env;
}

const env = { ...process.env, ...readEnvFile('.env') };
const confirm = process.argv.includes('--confirm');
const stockArg = Number(process.argv[process.argv.indexOf('--stock') + 1]);
const initialStock = Number.isFinite(stockArg) && stockArg > 0 ? stockArg : 0;

const ODOO_URL = (env.ODOO_URL || '').replace(/\/+$/, '');
const missing = ['ODOO_URL', 'ODOO_DB', 'ODOO_USERNAME', 'ODOO_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter(
  (key) => !env[key]
);
if (missing.length > 0) {
  console.error(`Missing required env: ${missing.join(', ')}`);
  process.exit(2);
}

async function rpc(service, method, args) {
  const res = await fetch(`${ODOO_URL}/jsonrpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { service, method, args }, id: 1 }),
  });
  const json = await res.json();
  if (json.error) {
    const detail = json.error.data?.message || json.error.message || 'Odoo request failed';
    throw new Error(String(detail).split('\n')[0]);
  }
  return json.result;
}

const uid = await rpc('common', 'login', [env.ODOO_DB, env.ODOO_USERNAME, env.ODOO_API_KEY]);
if (!uid) {
  console.error('Odoo authentication failed — check ODOO_USERNAME / ODOO_API_KEY.');
  process.exit(1);
}
const call = (model, method, args, kwargs = {}) =>
  rpc('object', 'execute_kw', [env.ODOO_DB, uid, env.ODOO_API_KEY, model, method, args, kwargs]);

const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: catalog, error } = await db
  .from('store_products')
  .select('id,name,name_en,sku,price_per_unit,odoo_product_id,odoo_product_sku')
  .order('sort_order', { ascending: true });
if (error) {
  console.error(`Catalog read failed: ${error.message}`);
  process.exit(1);
}

const withSku = (catalog || []).filter((p) => p.sku || p.odoo_product_sku);
const withoutSku = (catalog || []).filter((p) => !p.sku && !p.odoo_product_sku);
if (withoutSku.length > 0) {
  console.log(
    `${withoutSku.length} catalog product(s) have no SKU and are skipped: ` +
      withoutSku.map((p) => p.name).join(', ')
  );
  console.log('Apply the store_product_skus migration (npm run db:push) first.\n');
}

// The delivery fee line needs its own product, addressed by SKU from the env.
const deliverySku = env.ODOO_DELIVERY_PRODUCT_SKU || '';
const plan = withSku.map((p) => ({
  sku: p.odoo_product_sku || p.sku,
  name: p.name,
  nameEn: p.name_en,
  price: Number(p.price_per_unit) || 0,
  storeId: p.id,
  service: false,
}));
if (deliverySku && !Number(env.ODOO_DELIVERY_PRODUCT_ID || 0)) {
  plan.push({
    sku: deliverySku,
    name: 'Хүргэлт',
    nameEn: 'Delivery',
    price: 0,
    storeId: null,
    service: true,
  });
}

// Points paid for part of an order arrive as a negative line, which needs a
// product of its own — without it Odoo would invoice the customer for money
// they already settled with points.
const pointsSku = env.ODOO_POINTS_PRODUCT_SKU || 'POINTSDISCOUNT';
const couponSku = env.ODOO_COUPON_PRODUCT_SKU || 'COUPONDISCOUNT';
plan.push({
  sku: pointsSku,
  name: 'Zity оноогоор хөнгөлсөн',
  nameEn: 'Zity points discount',
  price: 0,
  storeId: null,
  service: true,
});

// Coupons book against their own product. Sharing the points one would make the
// ledger unable to separate a settled loyalty liability from a plain discount.
plan.push({
  sku: couponSku,
  name: 'Zity купон хөнгөлөлт',
  nameEn: 'Zity coupon discount',
  price: 0,
  storeId: null,
  service: true,
});

const skus = plan.map((item) => item.sku);
const existing = skus.length
  ? await call('product.product', 'search_read', [[['default_code', 'in', skus]], ['id', 'default_code', 'name']])
  : [];
const bySku = new Map(existing.map((p) => [p.default_code, p]));

console.log(`Odoo: ${ODOO_URL} (db ${env.ODOO_DB})`);
console.log(`catalog products with a SKU: ${withSku.length}`);
console.log(`already in Odoo: ${existing.length}`);
console.log(`to create: ${plan.filter((item) => !bySku.has(item.sku)).length}`);
for (const item of plan) {
  const found = bySku.get(item.sku);
  console.log(`  ${found ? `link  #${found.id}` : 'create      '} ${item.sku.padEnd(10)} ${item.name}`);
}

if (!confirm) {
  console.log('\nDry run. Re-run with --confirm to write these products to Odoo.');
  process.exit(0);
}

// ── Create ───────────────────────────────────────────────────────────────────
const companyId = Number(env.ODOO_COMPANY_ID || 0);
for (const item of plan) {
  if (bySku.has(item.sku)) continue;
  const values = {
    name: item.name,
    default_code: item.sku,
    list_price: item.price,
    sale_ok: true,
    purchase_ok: !item.service,
    type: item.service ? 'service' : 'consu',
    ...(item.service ? {} : { is_storable: true }),
    ...(companyId > 0 ? { company_id: companyId } : {}),
  };
  try {
    const id = await call('product.product', 'create', [values]);
    bySku.set(item.sku, { id, default_code: item.sku, name: item.name });
    console.log(`created #${id} ${item.sku} ${item.name}`);
  } catch (err) {
    // `is_storable` only exists from Odoo 18 on; older databases use type 'product'.
    if (String(err.message).includes('is_storable')) {
      const legacy = { ...values, type: item.service ? 'service' : 'product' };
      delete legacy.is_storable;
      const id = await call('product.product', 'create', [legacy]);
      bySku.set(item.sku, { id, default_code: item.sku, name: item.name });
      console.log(`created #${id} ${item.sku} ${item.name}`);
    } else {
      console.error(`FAILED ${item.sku}: ${err.message}`);
    }
  }
}

// ── Optional opening stock ───────────────────────────────────────────────────
if (initialStock > 0) {
  const [location] = await call('stock.location', 'search_read', [
    [['usage', '=', 'internal']],
    ['id', 'complete_name'],
  ], { limit: 1 });
  if (!location) {
    console.log('No internal stock location found — skipping the opening stock.');
  } else {
    for (const item of plan) {
      if (item.service) continue;
      const product = bySku.get(item.sku);
      if (!product) continue;
      try {
        const quantId = await call('stock.quant', 'create', [
          { product_id: product.id, location_id: location.id, inventory_quantity: initialStock },
        ]);
        await call('stock.quant', 'action_apply_inventory', [[quantId]]);
      } catch (err) {
        console.error(`stock FAILED ${item.sku}: ${err.message}`);
      }
    }
    console.log(`opening stock of ${initialStock} applied in ${location.complete_name}`);
  }
}

// ── Link the Odoo ids back into the Chef catalog ─────────────────────────────
let linked = 0;
for (const item of plan) {
  if (!item.storeId) continue;
  const product = bySku.get(item.sku);
  if (!product) continue;
  const { error: updateError } = await db
    .from('store_products')
    .update({ odoo_product_id: product.id, odoo_product_sku: item.sku })
    .eq('id', item.storeId);
  if (updateError) console.error(`link FAILED ${item.sku}: ${updateError.message}`);
  else linked += 1;
}
console.log(`\nlinked ${linked} catalog row(s) to their Odoo product id.`);
console.log('Order sync can now resolve every line. Load real inventory in Odoo before');
console.log('running /api/odoo/products?sync=true, which copies Odoo stock into the catalog.');
