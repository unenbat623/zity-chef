import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const anonKey = process.env.SUPABASE_ANON_KEY || '';

// Server-side admin client — service role key, bypasses RLS. Used ONLY for
// trusted operations (e.g. validating an access token). NEVER exposed to clients.
export const supabaseAdmin =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

/**
 * True when the per-user database path is usable. Requires the URL + anon key,
 * because user data is read/written through an RLS-scoped client (below), not
 * through the admin client.
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && anonKey);

/**
 * Anon client for reading PUBLIC data (e.g. the store catalog) with no user
 * session. RLS still applies, so it only sees rows exposed by a public policy.
 */
export const supabasePublic =
  supabaseUrl && anonKey
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
