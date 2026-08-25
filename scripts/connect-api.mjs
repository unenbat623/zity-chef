/**
 * Points everything at a Chef backend and proves the connection works.
 *
 * One command for the whole hand-off: write the address everywhere it is
 * needed, then exercise the API the way each client actually calls it and say
 * plainly whether the storefront can talk to it. Connectivity problems here are
 * nearly always a missing origin in ALLOWED_ORIGINS or a backend that is simply
 * not up — both are named directly rather than left as a failed fetch.
 *
 * Usage:
 *   node scripts/connect-api.mjs --api https://api.example.mn
 *   node scripts/connect-api.mjs --api … --shop https://shop.example.mn
 *   node scripts/connect-api.mjs --api … --verify-only
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const verifyOnly = argv.includes('--verify-only');

function readEnvFile(file) {
  if (!existsSync(file)) return {};
  const env = {};
  for (const line of readFileSync(file, 'utf8').split(/\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[m[1]] = v;
  }
  return env;
}

const CHEF_ENV = '.env';
const SHOP_DIR = path.resolve('..', 'zity-delguur-app');
const SHOP_ENV = path.join(SHOP_DIR, '.env');
const SHOP_INDEX = path.join(SHOP_DIR, 'index.html');

const chefEnv = readEnvFile(CHEF_ENV);
const shopEnv = readEnvFile(SHOP_ENV);

const api = (flag('api') || chefEnv.VITE_API_URL || '').replace(/\/+$/, '');
const shop = (flag('shop') || shopEnv.VITE_SITE_URL || '').replace(/\/+$/, '');

if (!api) {
  console.error('Usage: node scripts/connect-api.mjs --api https://api.example.mn [--shop https://shop.example.mn]');
  process.exit(2);
}
if (!/^https?:\/\/[^/\s]+$/i.test(api)) {
  console.error(`--api must be a bare origin without a path: got "${api}"`);
  process.exit(2);
}

let failures = 0;
const ok = (l, d = '') => console.log(`OK   ${l}${d ? ` — ${d}` : ''}`);
const fail = (l, d = '') => {
  failures += 1;
  console.log(`FAIL ${l}${d ? ` — ${d}` : ''}`);
};
const warn = (l, d = '') => console.log(`WARN ${l}${d ? ` — ${d}` : ''}`);

// ── 1. Write the address everywhere ──────────────────────────────────────────
function upsertEnv(file, values) {
  if (!existsSync(file)) return false;
  const lines = readFileSync(file, 'utf8').split(/\n/);
  for (const [key, value] of Object.entries(values)) {
    const i = lines.findIndex((line) => line.startsWith(`${key}=`));
    if (i >= 0) lines[i] = `${key}=${value}`;
    else lines.push(`${key}=${value}`);
  }
  copyFileSync(file, `${file}.bak.${Date.now()}`);
  writeFileSync(file, lines.join('\n'));
  return true;
}

/** The storefront reads this before its bundled value, so no rebuild is needed. */
function setIndexMeta(file, value) {
  if (!existsSync(file)) return false;
  const html = readFileSync(file, 'utf8');
  const re = /(<meta name="zity-chef-api" content=")[^"]*(")/;
  if (!re.test(html)) return false;
  copyFileSync(file, `${file}.bak.${Date.now()}`);
  writeFileSync(file, html.replace(re, `$1${value}$2`));
  return true;
}

if (!verifyOnly) {
  console.log('── writing configuration ──');
  const origins = [...new Set([api, shop].filter(Boolean))].join(',');
  upsertEnv(CHEF_ENV, {
    VITE_API_URL: api,
    SMOKE_API_URL: api,
    QPAY_CALLBACK_URL: `${api}/api/payments/qpay/callback`,
    ...(origins ? { ALLOWED_ORIGINS: origins } : {}),
  });
  ok('chef .env', `VITE_API_URL, SMOKE_API_URL, QPAY_CALLBACK_URL${origins ? ', ALLOWED_ORIGINS' : ''}`);

  if (upsertEnv(SHOP_ENV, { VITE_ZITY_CHEF_API_URL: api })) ok('storefront .env', 'VITE_ZITY_CHEF_API_URL');
  else warn('storefront .env', `${SHOP_ENV} not found`);

  if (setIndexMeta(SHOP_INDEX, api)) ok('storefront index.html', 'runtime meta set — no rebuild needed');
  else warn('storefront index.html', 'zity-chef-api meta tag not found');
  console.log('');
}

// ── 2. Prove it answers ──────────────────────────────────────────────────────
console.log('── reaching the API ──');
const call = async (path, init = {}) => {
  const res = await fetch(`${api}${path}`, { ...init, redirect: 'follow' });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 120) };
  }
  return { status: res.status, headers: res.headers, body };
};

let backendEnv = '';
try {
  const health = await call('/api/health');
  if (health.status === 200) {
    backendEnv = String(health.body?.environment || '');
    ok('GET /api/health', JSON.stringify(health.body).slice(0, 80));
  } else fail('GET /api/health', `HTTP ${health.status}`);
} catch (err) {
  fail('GET /api/health', err instanceof Error ? err.message : 'request failed');
  console.log(`\nNothing answered at ${api}. Is the backend deployed and the host correct?`);
  process.exit(1);
}

for (const [label, path] of [
  ['catalog', '/api/store/products'],
  ['recipes', '/api/recipes'],
  ['odoo bridge', '/api/odoo/status'],
  ['payment mode', '/api/payments/config'],
]) {
  try {
    const r = await call(path);
    if (r.status === 200) ok(`GET ${path}`, `${label}: ${JSON.stringify(r.body).slice(0, 70)}`);
    else fail(`GET ${path}`, `HTTP ${r.status}`);
  } catch (err) {
    fail(`GET ${path}`, err instanceof Error ? err.message : 'request failed');
  }
}

// ── 3. Prove the storefront's origin is allowed ──────────────────────────────
if (shop) {
  console.log('\n── browser access from the storefront ──');
  try {
    const res = await fetch(`${api}/api/store/products`, { headers: { Origin: shop } });
    const allow = res.headers.get('access-control-allow-origin');
    if (backendEnv && backendEnv !== 'production') {
      // Outside production the CORS handler waves every origin through, so a
      // pass here says nothing about how the deployed backend will behave.
      warn(
        'CORS not meaningfully tested',
        `backend is running in "${backendEnv}", which allows any origin — re-run against the production deployment`
      );
    } else if (allow === shop || allow === '*') ok('CORS allows the storefront origin', allow);
    else
      fail(
        'CORS allows the storefront origin',
        `no matching header for ${shop} — add it to ALLOWED_ORIGINS and redeploy the backend`
      );
  } catch (err) {
    fail('CORS preflight', err instanceof Error ? err.message : 'request failed');
  }
} else {
  warn('storefront origin not checked', 'pass --shop https://… to verify CORS');
}

// ── 4. Payment readiness ─────────────────────────────────────────────────────
try {
  const cfg = await call('/api/payments/config');
  const mode = cfg.body?.qpay;
  if (mode === 'live') ok('QPay is live');
  else
    warn(
      'QPay is in simulated mode',
      'orders cannot be taken in production until QPAY_* are set — then run `npm run qpay:check`'
    );
} catch {
  /* already reported above */
}

console.log(
  failures === 0
    ? `\nConnected. ${api} answers every client call.${verifyOnly ? '' : ' Rebuild is not required — the storefront reads the address from index.html.'}`
    : `\n${failures} check(s) failed.`
);
process.exit(failures === 0 ? 0 : 1);
