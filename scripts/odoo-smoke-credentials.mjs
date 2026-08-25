/**
 * Fills the two smoke-test credentials that `npm run odoo:smoke` needs before it
 * can exercise the authenticated Odoo endpoints:
 *
 *   SMOKE_ACCESS_TOKEN — an access token for the first address in
 *                        CHEF_ADMIN_EMAILS, since /api/odoo/logs and
 *                        /api/odoo/reconcile require a chef admin.
 *   SMOKE_ORDER_ID     — the newest order of that user that is in a syncable
 *                        state (paid/packing/shipping/delivered).
 *
 * The token is a real Supabase session: the service role key issues a magic-link
 * token for the admin address and this exchanges it for a session, so it works
 * on projects using asymmetric signing keys, where nothing can be minted
 * locally. That also means it counts as a sign-in of that account.
 *
 * Operator-only local tool: it needs the service role key, so it must never run
 * in the browser or in CI. Both values are written back into .env.
 *
 * Usage:  node scripts/odoo-smoke-credentials.mjs
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const ENV_PATH = '.env';
const SYNCABLE = ['paid', 'packing', 'shipping', 'delivered'];

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

/**
 * Replaces KEY=… in .env, appending the line when the key is absent. The file
 * keeps its trailing newline — without it the next appended setting would land
 * on the same line as the last value and become part of it.
 */
function upsertEnv(path, values) {
  const lines = (existsSync(path) ? readFileSync(path, 'utf8') : '').replace(/\n$/, '').split(/\n/);
  for (const [key, value] of Object.entries(values)) {
    const index = lines.findIndex((line) => line.startsWith(`${key}=`));
    if (index >= 0) lines[index] = `${key}=${value}`;
    else lines.push(`${key}=${value}`);
  }
  writeFileSync(path, `${lines.join('\n')}\n`);
}

const env = { ...process.env, ...readEnvFile(ENV_PATH) };
const missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY'].filter(
  (key) => !env[key]
);
if (missing.length > 0) {
  console.error(`Missing required env: ${missing.join(', ')}`);
  process.exit(2);
}

const adminEmail = (env.CHEF_ADMIN_EMAILS || '').split(',')[0].trim().toLowerCase();
if (!adminEmail) {
  console.error('CHEF_ADMIN_EMAILS is empty — nothing to sign in as.');
  process.exit(2);
}

const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── A real session for the admin address ─────────────────────────────────────
// generateLink returns the hashed token behind the magic link without sending
// any mail; verifyOtp trades it for an access token.
const { data: link, error: linkError } = await admin.auth.admin.generateLink({
  type: 'magiclink',
  email: adminEmail,
});
if (linkError || !link?.properties?.hashed_token) {
  console.error(`Could not issue a login token for ${adminEmail}: ${linkError?.message || 'no token returned'}`);
  console.error('Sign in to Chef with that address once, then re-run this script.');
  process.exit(1);
}

const { data: session, error: verifyError } = await anon.auth.verifyOtp({
  token_hash: link.properties.hashed_token,
  type: 'magiclink',
});
if (verifyError || !session?.session?.access_token) {
  console.error(`Login failed: ${verifyError?.message || 'no session returned'}`);
  process.exit(1);
}

const token = session.session.access_token;
const userId = session.user?.id || link.user?.id || '';
const expiresAt = session.session.expires_at
  ? new Date(session.session.expires_at * 1000).toISOString()
  : 'unknown';

// ── A syncable order of that user ────────────────────────────────────────────
const { data: orders, error: orderError } = await admin
  .from('orders')
  .select('id,order_ref,status,total_amount,odoo_order_ref,created_at')
  .eq('user_id', userId)
  .in('status', SYNCABLE)
  .order('created_at', { ascending: false })
  .limit(1);
if (orderError) {
  console.error(`Order lookup failed: ${orderError.message}`);
  process.exit(1);
}
const order = orders?.[0] || null;

upsertEnv(ENV_PATH, {
  SMOKE_ACCESS_TOKEN: token,
  ...(order ? { SMOKE_ORDER_ID: order.id } : {}),
});

console.log(`admin user: ${adminEmail} (${userId})`);
console.log(`SMOKE_ACCESS_TOKEN: written to ${ENV_PATH}, expires ${expiresAt}`);
if (order) {
  console.log(
    `SMOKE_ORDER_ID: ${order.id} (${order.order_ref}, ${order.status}, ${order.total_amount})` +
      (order.odoo_order_ref ? ` — already synced as ${order.odoo_order_ref}` : '')
  );
} else {
  console.log(
    `SMOKE_ORDER_ID: no ${SYNCABLE.join('/')} order found for this user — place one paid order, then re-run.`
  );
}

// ── Verify the token against the running API ─────────────────────────────────
const apiBaseUrl = (env.SMOKE_API_URL || env.VITE_API_URL || `http://localhost:${env.PORT || 3002}`)
  .replace(/\/+$/, '');
try {
  const res = await fetch(`${apiBaseUrl}/api/odoo/logs`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  console.log(`token check: GET ${apiBaseUrl}/api/odoo/logs → HTTP ${res.status}`);
  if (res.status === 403) {
    console.error(`${adminEmail} is not in CHEF_ADMIN_EMAILS on the API side.`);
  }
} catch (error) {
  console.log(
    `token check skipped: API at ${apiBaseUrl} is not reachable (${error instanceof Error ? error.message : 'request failed'})`
  );
}
