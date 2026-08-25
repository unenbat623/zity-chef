/**
 * Verifies that QPay is ready to take real money, before anyone tries to.
 *
 * Everything the integration needs is checked against the live merchant API in
 * the order it fails in production: configuration → authentication → invoice
 * creation → payment lookup → the callback QPay has to be able to reach. Each
 * step reports what to fix rather than just failing.
 *
 * It creates ONE small real invoice to prove the merchant account works and
 * nobody pays it — an unpaid QPay invoice simply expires. Pass --no-invoice to
 * stop after authentication.
 *
 * Usage:
 *   npm run qpay:check
 *   npm run qpay:check -- --no-invoice
 *   npm run qpay:check -- --amount 10
 */
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

const env = { ...process.env, ...readEnvFile('.env') };
const args = process.argv.slice(2);
const skipInvoice = args.includes('--no-invoice');
const amountArg = Number(args[args.indexOf('--amount') + 1]);
const amount = Number.isFinite(amountArg) && amountArg > 0 ? amountArg : 10;

const BASE = (env.QPAY_BASE_URL || 'https://merchant.qpay.mn/v2').replace(/\/+$/, '');
const USERNAME = env.QPAY_USERNAME || '';
const PASSWORD = env.QPAY_PASSWORD || '';
const INVOICE_CODE = env.QPAY_INVOICE_CODE || '';
const CALLBACK = env.QPAY_CALLBACK_URL || '';

let failures = 0;
const ok = (label, detail = '') => console.log(`OK   ${label}${detail ? ` — ${detail}` : ''}`);
const fail = (label, detail = '') => {
  failures += 1;
  console.log(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
};
const warn = (label, detail = '') => console.log(`WARN ${label}${detail ? ` — ${detail}` : ''}`);

const looksUnset = (value) => !value || /your_|example|changeme/i.test(value);

// ── 1. Configuration ─────────────────────────────────────────────────────────
console.log('── configuration ──');
for (const [key, value] of [
  ['QPAY_USERNAME', USERNAME],
  ['QPAY_PASSWORD', PASSWORD],
  ['QPAY_INVOICE_CODE', INVOICE_CODE],
]) {
  if (looksUnset(value)) fail(`${key} is set`, 'still empty or a placeholder');
  else ok(`${key} is set`);
}
console.log(`INFO QPAY_BASE_URL = ${BASE}`);

if (!CALLBACK) {
  warn(
    'QPAY_CALLBACK_URL is set',
    'without it QPay cannot notify us; the client poll still settles invoices, but slower'
  );
} else if (!/^https:\/\//i.test(CALLBACK)) {
  fail('QPAY_CALLBACK_URL is https', `got ${CALLBACK} — QPay will not call a plain-http endpoint`);
} else if (/localhost|127\.0\.0\.1|:\d{4}$/.test(CALLBACK)) {
  fail('QPAY_CALLBACK_URL is publicly reachable', `${CALLBACK} is a local address`);
} else {
  ok('QPAY_CALLBACK_URL looks public', CALLBACK);
}

if (failures > 0) {
  console.log('\nFix the configuration above before re-running.');
  process.exit(2);
}

// ── 2. Authentication ────────────────────────────────────────────────────────
console.log('\n── merchant authentication ──');
const basic = Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');
let token = '';
try {
  const res = await fetch(`${BASE}/auth/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/json' },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    fail('POST /auth/token', `HTTP ${res.status} ${JSON.stringify(body).slice(0, 200)}`);
    console.log('\nCheck QPAY_USERNAME / QPAY_PASSWORD with your QPay account manager.');
    process.exit(1);
  }
  token = body.access_token;
  const expiresIn = Number(body.expires_in || 0);
  ok('POST /auth/token', expiresIn ? `token valid for ${Math.round(expiresIn / 60)} min` : 'token issued');
} catch (err) {
  fail('POST /auth/token', err instanceof Error ? err.message : 'request failed');
  process.exit(1);
}

// ── 3. Callback reachability ─────────────────────────────────────────────────
// QPay calls this from its own network; if we cannot reach it from here, it
// almost certainly cannot either.
if (CALLBACK) {
  console.log('\n── callback reachability ──');
  try {
    const res = await fetch(`${CALLBACK}?invoice=preflight`, { method: 'GET' });
    if (res.ok) ok('callback endpoint answers', `HTTP ${res.status}`);
    else warn('callback endpoint answers', `HTTP ${res.status} — QPay expects a 2xx`);
  } catch (err) {
    fail(
      'callback endpoint is reachable from the internet',
      err instanceof Error ? err.message : 'request failed'
    );
  }
}

// ── 4. Invoice creation ──────────────────────────────────────────────────────
if (skipInvoice) {
  console.log('\nSkipping invoice creation (--no-invoice).');
} else {
  console.log('\n── invoice creation ──');
  const senderInvoiceNo = `PREFLIGHT-${Date.now()}`;
  const body = {
    invoice_code: INVOICE_CODE,
    sender_invoice_no: senderInvoiceNo,
    invoice_receiver_code: 'terminal',
    invoice_description: 'Zity preflight check — do not pay',
    amount,
  };
  if (CALLBACK) body.callback_url = `${CALLBACK}?invoice=${encodeURIComponent(senderInvoiceNo)}`;

  try {
    const res = await fetch(`${BASE}/invoice`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.invoice_id) {
      fail('POST /invoice', `HTTP ${res.status} ${JSON.stringify(data).slice(0, 250)}`);
      console.log('\nA rejected invoice_code is the usual cause — confirm it with QPay.');
      process.exit(1);
    }
    ok('POST /invoice', `invoice_id=${data.invoice_id} amount=${amount}₮`);
    ok('QR returned', data.qr_image ? 'qr_image present' : 'no qr_image (check with QPay)');
    ok('bank deep links returned', `${(data.urls || []).length} app link(s)`);

    // 5. The lookup the client polls with.
    const check = await fetch(`${BASE}/payment/check`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        object_type: 'INVOICE',
        object_id: data.invoice_id,
        offset: { page_number: 1, page_limit: 100 },
      }),
    });
    const checkBody = await check.json().catch(() => ({}));
    if (!check.ok) fail('POST /payment/check', `HTTP ${check.status}`);
    else
      ok(
        'POST /payment/check',
        `paid_amount=${checkBody.paid_amount ?? 0} rows=${(checkBody.rows || []).length} (unpaid is expected)`
      );

    console.log(`\nINFO invoice ${senderInvoiceNo} was left unpaid and will expire on its own.`);
  } catch (err) {
    fail('POST /invoice', err instanceof Error ? err.message : 'request failed');
  }
}

console.log(
  failures === 0
    ? '\nQPay is ready. Set the same values in the production environment and deploy.'
    : `\n${failures} check(s) failed.`
);
process.exit(failures === 0 ? 0 : 1);
