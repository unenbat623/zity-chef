import { existsSync, readFileSync } from 'node:fs';

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

function isMissing(value) {
  return !value || /your_|example|localhost/i.test(value);
}

async function request(baseUrl, path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: options.method || 'GET',
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text.slice(0, 300) };
  }
  return { ok: res.ok, status: res.status, data };
}

const fileEnv = readEnvFile('.env');
const env = { ...process.env, ...fileEnv };
const apiBaseUrl = (env.SMOKE_API_URL || env.VITE_API_URL || `http://localhost:${env.PORT || 3002}`).replace(
  /\/+$/,
  ''
);

const required = ['ODOO_URL', 'ODOO_DB', 'ODOO_USERNAME', 'ODOO_API_KEY'];
const missing = required.filter((key) => isMissing(env[key]));

console.log(`Odoo smoke target: ${apiBaseUrl}`);
for (const key of [
  ...required,
  'ODOO_DELIVERY_PRODUCT_ID',
  'ODOO_DELIVERY_PRODUCT_SKU',
  'ODOO_PAYMENT_JOURNAL_ID',
  'ODOO_CREDIT_NOTE_JOURNAL_ID',
  'ODOO_PRICELIST_ID',
  'ODOO_COMPANY_ID',
]) {
  console.log(`${key}: ${isMissing(env[key]) ? 'missing_or_placeholder' : 'set'}`);
}

if (missing.length > 0) {
  console.error(`Missing required Odoo env: ${missing.join(', ')}`);
  process.exit(2);
}

const token = env.SMOKE_ACCESS_TOKEN || '';
const smokeOrderId = env.SMOKE_ORDER_ID || env.SMOKE_EXTERNAL_ORDER_ID || '';
const checks = [
  { name: 'status', path: '/api/odoo/status' },
  { name: 'products', path: '/api/odoo/products', token, auth: true },
  { name: 'logs', path: '/api/odoo/logs', token, auth: true },
  { name: 'reconcile', path: '/api/odoo/reconcile', method: 'POST', token, auth: true },
];

let failed = 0;
for (const check of checks) {
  if (check.auth && !token) {
    console.log(`SKIP ${check.name}: SMOKE_ACCESS_TOKEN not set`);
    continue;
  }

  try {
    const result = await request(apiBaseUrl, check.path, {
      method: check.method,
      token: check.token,
    });
    const message = result.data.message || result.data.error || '';
    console.log(`${result.ok ? 'OK' : 'FAIL'} ${check.name}: HTTP ${result.status} ${message}`);
    if (!result.ok) failed += 1;
  } catch (error) {
    failed += 1;
    console.log(`FAIL ${check.name}: ${error instanceof Error ? error.message : 'request failed'}`);
  }
}

if (!token) {
  console.log('SKIP order lifecycle: SMOKE_ACCESS_TOKEN not set');
} else if (!smokeOrderId) {
  console.log('SKIP order lifecycle: SMOKE_ORDER_ID not set');
} else {
  const body = { orderId: smokeOrderId, externalOrderId: smokeOrderId };
  const lifecycle = [
    { name: 'order sync', path: '/api/odoo/orders', method: 'POST', body },
    { name: 'order sync duplicate guard', path: '/api/odoo/orders', method: 'POST', body },
    { name: 'invoice', path: '/api/odoo/invoices', method: 'POST', body },
    {
      name: 'order status pull',
      path: '/api/odoo/orders/status',
      method: 'POST',
      body: { orders: [body] },
    },
    {
      name: 'order status push',
      path: '/api/odoo/orders/status',
      method: 'POST',
      body: { ...body, status: 'packing' },
    },
  ];

  for (const check of lifecycle) {
    try {
      const result = await request(apiBaseUrl, check.path, {
        method: check.method,
        token,
        body: check.body,
      });
      const ref = result.data.odooOrderRef || result.data.invoiceRef || '';
      const message = result.data.message || result.data.error || ref;
      console.log(`${result.ok ? 'OK' : 'FAIL'} ${check.name}: HTTP ${result.status} ${message}`);
      if (!result.ok) failed += 1;
    } catch (error) {
      failed += 1;
      console.log(`FAIL ${check.name}: ${error instanceof Error ? error.message : 'request failed'}`);
    }
  }
}

if (failed > 0) process.exit(1);
