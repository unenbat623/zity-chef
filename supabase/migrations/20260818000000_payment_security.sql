-- ════════════════════════════════════════════════════════════════════════════
-- Payment security hardening
--   1. payment_intents: what each invoice buys, durable across restarts and
--      serverless instances (was an in-process Map, so a paid upgrade could
--      silently vanish between the create and the callback).
--   2. profiles column lockdown: RLS lets a user UPDATE their own row, which
--      included subscription_tier — so anyone holding the anon key could grant
--      themselves Pro from the browser console. Column-level grants keep the
--      profile editable while making the subscription columns service-role only.
--   3. handle_new_user: a bare INSERT aborted the whole auth signup on any
--      pre-existing profile row (surfaced to the user as an opaque
--      "Database error saving new user").
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Payment intents ────────────────────────────────────────────────────────
-- user_id is TEXT, not a profiles FK: order invoices can belong to per-device
-- guest identities ("guest:<id>") that have no auth.users row.
CREATE TABLE IF NOT EXISTS public.payment_intents (
  invoice_id TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'plan' CHECK (kind IN ('plan', 'order')),
  tier       TEXT CHECK (tier IN ('pro', 'family')),
  months     INTEGER NOT NULL DEFAULT 1 CHECK (months BETWEEN 1 AND 12),
  amount     NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  -- pending → paid (payment verified) → consumed (order created against it)
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'consumed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at    TIMESTAMPTZ
);

-- Service-role only. RLS with no policies blocks the API roles, and the
-- explicit REVOKE also undoes the schema-wide default grant from the init
-- migration, so neither anon nor authenticated can even SELECT.
ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_intents FROM anon, authenticated;

-- ── 2. Profiles: subscription columns become service-role only ────────────────
-- RLS still scopes writes to the user's own row; these grants scope which
-- columns that row-level permission may touch. subscription_tier and
-- subscription_expires_at are deliberately absent — only the server's admin
-- client (payment verification) may write them.
REVOKE INSERT, UPDATE ON public.profiles FROM authenticated;
GRANT INSERT (id, email, display_name, avatar_url, lang) ON public.profiles TO authenticated;
GRANT UPDATE (email, display_name, avatar_url, lang) ON public.profiles TO authenticated;

-- ── 3. Signup trigger must never abort the auth INSERT ────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN unique_violation THEN
  -- e.g. the UNIQUE(email) constraint: a leftover profile row must not block
  -- the new account; the client-side profile sync reconciles it later.
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
