import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const anonKey = process.env.SUPABASE_ANON_KEY || '';

function hasRealSupabaseConfig(url: string, key: string): boolean {
  const placeholders = ['your-project-ref', 'your_supabase', 'your-'];
  return Boolean(
    url &&
    key &&
    url.includes('.supabase.co') &&
    !placeholders.some((placeholder) => url.includes(placeholder) || key.includes(placeholder))
  );
}

const hasAnonConfig = hasRealSupabaseConfig(supabaseUrl, anonKey);
const hasAdminConfig = hasRealSupabaseConfig(supabaseUrl, serviceRoleKey);

// Server-side admin client — service role key, bypasses RLS. Used ONLY for
// trusted operations (e.g. validating an access token). NEVER exposed to clients.
export const supabaseAdmin = hasAdminConfig
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

/**
 * Auth verification only needs a Supabase client that can call auth.getUser().
 * Prefer service role when configured, but fall back to the anon key so
 * production deployments without service_role still treat valid Google users
 * as authenticated instead of silently dropping them into guest memory mode.
 */
export const supabaseAuth = hasAdminConfig
  ? supabaseAdmin
  : hasAnonConfig
    ? createClient(supabaseUrl, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

/**
 * True when the per-user database path is usable. Requires the URL + anon key,
 * because user data is read/written through an RLS-scoped client (below), not
 * through the admin client.
 */
export const isSupabaseConfigured = hasAnonConfig;

/**
 * Anon client for reading PUBLIC data (e.g. the store catalog) with no user
 * session. RLS still applies, so it only sees rows exposed by a public policy.
 */
export const supabasePublic = hasAnonConfig
  ? createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

/**
 * Scoped clients, keyed by access token.
 *
 * Every `createClient` builds a PostgREST, an auth and a realtime client behind
 * it, and one used to be constructed for *every request* — a busy instance spent
 * a measurable share of its time allocating and collecting clients it threw away
 * milliseconds later. A token maps to exactly one user for its lifetime, so the
 * client is safe to reuse; the map is bounded so a stream of expired tokens
 * cannot grow it without limit.
 */
const MAX_CACHED_USER_CLIENTS = 500;
const userClients = new Map<string, SupabaseClient>();

/**
 * Returns a Supabase client scoped to a specific user's access token. RLS
 * policies apply, so the user can only read/write their own rows — even though
 * the server never manually filters by user_id.
 */
export function getSupabaseForUser(accessToken: string) {
  const cached = userClients.get(accessToken);
  if (cached) {
    // Refresh recency: re-inserting moves the key to the end of the Map's
    // insertion order, which is what makes the eviction below least-recent.
    userClients.delete(accessToken);
    userClients.set(accessToken, cached);
    return cached;
  }

  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (userClients.size >= MAX_CACHED_USER_CLIENTS) {
    const oldest = userClients.keys().next().value;
    if (oldest !== undefined) userClients.delete(oldest);
  }
  userClients.set(accessToken, client);
  return client;
}
