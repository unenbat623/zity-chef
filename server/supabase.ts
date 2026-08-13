import { createClient } from '@supabase/supabase-js';

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
export const supabaseAdmin =
  hasAdminConfig
    ? createClient(supabaseUrl, serviceRoleKey, {
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
export const supabasePublic =
  hasAnonConfig
    ? createClient(supabaseUrl, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

/**
 * Returns a Supabase client scoped to a specific user's access token. RLS
 * policies apply, so the user can only read/write their own rows — even though
 * the server never manually filters by user_id.
 */
export function getSupabaseForUser(accessToken: string) {
  return createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
