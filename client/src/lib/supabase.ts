import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ── Supabase browser client (anon key — RLS enforced) ────────────────────────
// The anon key is safe to ship to the browser; Row Level Security on the
// database is what actually protects each user's data. NEVER put the
// service_role key here.

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

function hasRealSupabaseConfig(url: string, key: string): boolean {
  const placeholders = ['your-project-ref', 'your_supabase', 'your-'];
  return Boolean(
    url &&
      key &&
      url.includes('.supabase.co') &&
      !placeholders.some((placeholder) => url.includes(placeholder) || key.includes(placeholder))
  );
}

/**
 * True when both env vars are present. When false the app still runs, but in a
 * local-only "demo" mode: no real accounts, no per-user persistence. This lets
 * developers boot the UI without a Supabase project while making the missing
 * configuration obvious (see the console warning below).
 */
export const isSupabaseConfigured = hasRealSupabaseConfig(supabaseUrl, supabaseAnonKey);

if (!isSupabaseConfigured && import.meta.env.DEV) {
  // eslint-disable-next-line no-console
  console.warn(
    '[Zity Chef] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set — ' +
      'authentication and per-user persistence are disabled (demo mode).'
  );
}

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/**
 * Current access token (JWT) for the signed-in (or anonymous) session, or null
 * in demo mode / before the first session is established. Used to authorize
 * API calls to the backend.
 */
export async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
