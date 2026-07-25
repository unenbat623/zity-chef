import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Server-side Supabase client — uses service role key (bypasses RLS for admin ops)
// NEVER expose this key to the frontend
export const supabaseAdmin =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

export const isSupabaseConfigured = !!supabaseAdmin;

/**
 * Get a user-scoped Supabase client using their JWT token.
 * RLS policies apply — user can only access their own data.
 */
export function getSupabaseForUser(accessToken: string) {
  return createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY || '', {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
