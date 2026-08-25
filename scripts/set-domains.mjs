/**
 * Writes every domain-dependent setting across both repos in one go.
 *
 * The same host appears in eight places spread over two `.env` files, and a
 * single one left on `localhost` breaks something quietly: QPay silently never
 * calls back, or the browser is refused by CORS, or OAuth returns to the wrong
 * site. Setting them together removes that class of mistake.
 *
 * Nothing here is a secret — only URLs. Credentials stay where they are.
 *
 * Usage:
 *   node scripts/set-domains.mjs --api https://api.example.mn --shop https://shop.example.mn
 *   node scripts/set-domains.mjs --api … --shop … --app https://chef.example.mn
 *   node scripts/set-domains.mjs --api … --shop … --dry-run
 *
 *   --api   Chef backend, where /api/* is served. QPay calls back here.
 *   --shop  Zity Delguur storefront.
 *   --app   Chef's own web app. Defaults to --api when they share a host.
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const dryRun = argv.includes('--dry-run');

const api = (flag('api') || '').replace(/\/+$/, '');
const shop = (flag('shop') || '').replace(/\/+$/, '');
const app = (flag('app') || api).replace(/\/+$/, '');

if (!api || !shop) {
  console.error('Usage: node scripts/set-domains.mjs --api https://… --shop https://… [--app https://…]');
  process.exit(2);
}

for (const [name, url] of [['--api', api], ['--shop', shop], ['--app', app]]) {
  if (!/^https:\/\/[^/\s]+$/i.test(url)) {
    console.error(`${name} must be a bare https origin (no path, no trailing slash): got "${url}"`);
    process.exit(2);
  }
  if (/localhost|127\.0\.0\.1|\d+\.\d+\.\d+\.\d+/.test(url)) {
    console.error(`${name} looks like a local address (${url}). QPay cannot reach it.`);
    process.exit(2);
  }
}

// Chef repo is where this script lives; the storefront sits beside it.
const CHEF_ENV = '.env';
const SHOP_ENV = path.resolve('..', 'zity-delguur-app', '.env');

const chefValues = {
  // QPay posts the payment notification here.
  QPAY_CALLBACK_URL: `${api}/api/payments/qpay/callback`,
  // Browsers are refused any origin not on this list.
  ALLOWED_ORIGINS: [...new Set([app, shop])].join(','),
  VITE_API_URL: api,
  VITE_AUTH_REDIRECT_URL: app,
  SMOKE_API_URL: api,
};

const shopValues = {
  VITE_ZITY_CHEF_API_URL: api,
  VITE_AUTH_REDIRECT_URL: shop,
  VITE_SITE_URL: shop,
};

/** Replaces KEY=… in place, appending the line when the key is absent. */
function upsertEnv(file, values) {
  if (!existsSync(file)) {
    console.error(`  ${file} does not exist — skipped.`);
    return false;
  }
  const lines = readFileSync(file, 'utf8').split(/\n/);
  for (const [key, value] of Object.entries(values)) {
    const index = lines.findIndex((line) => line.startsWith(`${key}=`));
    if (index >= 0) lines[index] = `${key}=${value}`;
    else lines.push(`${key}=${value}`);
  }
  if (!dryRun) {
    copyFileSync(file, `${file}.bak.${Date.now()}`);
    writeFileSync(file, lines.join('\n'));
  }
  return true;
}

const show = (file, values) => {
  console.log(`\n${file}`);
  for (const [k, v] of Object.entries(values)) console.log(`  ${k}=${v}`);
};

console.log(dryRun ? 'DRY RUN — nothing is written.\n' : 'Writing domain settings…');
show(CHEF_ENV, chefValues);
show(SHOP_ENV, shopValues);

const wroteChef = upsertEnv(CHEF_ENV, chefValues);
const wroteShop = upsertEnv(SHOP_ENV, shopValues);

if (!dryRun && (wroteChef || wroteShop)) {
  console.log('\nWritten. A timestamped .bak copy was kept next to each file.');
}

console.log(`
Still to do by hand — these live in other people's dashboards:

  1. Supabase → Authentication → URL Configuration
       Site URL:       ${shop}
       Redirect URLs:  ${shop}/**
                       ${app}/**
     Sign-in returns to whatever is listed here; anything missing sends the
     user to the wrong site after Google login.

  2. QPay merchant account
       Callback URL:   ${api}/api/payments/qpay/callback
     Confirm with QPay that the merchant is allowed to call it, then run
     \`npm run qpay:check\` — it verifies the callback is reachable from outside.

  3. Deploy host environment (Vercel / Render / Docker)
     The values above are the local .env only. Set the same ones, plus the
     secrets, in the host's environment.
`);
