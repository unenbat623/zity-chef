-- ════════════════════════════════════════════════════════════════════════════
-- Zity Chef — Supabase PostgreSQL Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- Free tier: 500MB DB, 50k MAU, unlimited API requests
-- ════════════════════════════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Users ─────────────────────────────────────────────────────────────────────
-- Supabase Auth handles authentication; this extends auth.users with app data
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- email is nullable: anonymous sign-in creates a real user with no email.
  -- (In Postgres, UNIQUE permits multiple NULLs, so anon users don't collide.)
  email         TEXT UNIQUE,
  display_name  TEXT,
  avatar_url    TEXT,
  subscription_tier TEXT NOT NULL DEFAULT 'free'
    CHECK (subscription_tier IN ('free', 'pro', 'family')),
  subscription_expires_at TIMESTAMPTZ,
  lang          TEXT NOT NULL DEFAULT 'mn' CHECK (lang IN ('mn', 'en')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile when user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Fridge Inventory ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  name_en       TEXT,
  emoji         TEXT NOT NULL DEFAULT '📦',
  category      TEXT NOT NULL CHECK (category IN (
    '🥦 Ногоо', '🥩 Мах', '🥛 Сүү, өндөг', '🧂 Амтлагч', '🍎 Жимс'
  )),
  quantity      NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit          TEXT NOT NULL DEFAULT 'ш' CHECK (unit IN ('гр', 'л', 'ш', 'g', 'l', 'pcs')),
  -- expiry_date is the source of truth; remaining days is computed in the app
  -- (a generated column can't use CURRENT_DATE — it isn't IMMUTABLE).
  expiry_date   DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '7 days'),
  price_per_unit NUMERIC(12,2) DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_user_id ON public.inventory_items(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_expiry ON public.inventory_items(expiry_date);

-- ── Orders ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.orders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_ref       TEXT UNIQUE NOT NULL DEFAULT 'ZITY-' || LPAD(FLOOR(RANDOM()*900000+100000)::TEXT, 6, '0'),
  items_snapshot  JSONB NOT NULL DEFAULT '[]',
  total_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'delivering', 'completed', 'cancelled')),
  payment_method  TEXT NOT NULL DEFAULT 'qpay'
    CHECK (payment_method IN ('qpay', 'socialpay', 'card')),
  delivery_address TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);

-- ── Meal Plans ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.meal_plans (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  plan_data       JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, week_start_date)
);

-- ── AI Chat History (optional — Pro tier feature) ──────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  messages      JSONB NOT NULL DEFAULT '[]',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Row Level Security (RLS) — users can only see their own data ───────────
ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plans      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions   ENABLE ROW LEVEL SECURITY;

-- Profiles: user reads/updates own profile only
CREATE POLICY "profiles_own" ON public.profiles
  FOR ALL USING (auth.uid() = id);

-- Inventory: user manages own items only
CREATE POLICY "inventory_own" ON public.inventory_items
  FOR ALL USING (auth.uid() = user_id);

-- Orders: user sees own orders only
CREATE POLICY "orders_own" ON public.orders
  FOR ALL USING (auth.uid() = user_id);

-- Meal plans: user manages own plans
CREATE POLICY "meal_plans_own" ON public.meal_plans
  FOR ALL USING (auth.uid() = user_id);

-- Chat sessions: user sees own sessions
CREATE POLICY "chat_sessions_own" ON public.chat_sessions
  FOR ALL USING (auth.uid() = user_id);

-- ── Auto-update updated_at timestamps ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER touch_profiles        BEFORE UPDATE ON public.profiles        FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_inventory       BEFORE UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_orders          BEFORE UPDATE ON public.orders          FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ════════════════════════════════════════════════════════════════════════════
-- Community (social feed) — Phase 2
-- Posts are a PUBLIC feed (everyone can read); writes are restricted to the owner.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.community_posts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_name   TEXT NOT NULL DEFAULT 'Zity Chef',
  author_avatar TEXT,
  image_url     TEXT,
  caption       TEXT NOT NULL DEFAULT '',
  recipe_id     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_posts_created ON public.community_posts(created_at DESC);

CREATE TABLE IF NOT EXISTS public.post_likes (
  post_id    UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.post_comments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id     UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL DEFAULT 'Хэрэглэгч',
  text        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_comments_post ON public.post_comments(post_id);

ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments   ENABLE ROW LEVEL SECURITY;

-- Public read; owner-only writes.
CREATE POLICY "posts_read"    ON public.community_posts FOR SELECT USING (true);
CREATE POLICY "posts_insert"  ON public.community_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "posts_modify"  ON public.community_posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "posts_delete"  ON public.community_posts FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "likes_read"    ON public.post_likes FOR SELECT USING (true);
CREATE POLICY "likes_insert"  ON public.post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "likes_delete"  ON public.post_likes FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "comments_read"   ON public.post_comments FOR SELECT USING (true);
CREATE POLICY "comments_insert" ON public.post_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments_delete" ON public.post_comments FOR DELETE USING (auth.uid() = user_id);

-- ── Stories (ephemeral, 24h) ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stories (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_name   TEXT NOT NULL DEFAULT 'Zity Chef',
  author_avatar TEXT,
  image_url     TEXT,
  caption       TEXT,
  sticker       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);
CREATE INDEX IF NOT EXISTS idx_stories_expiry ON public.stories(expires_at);

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stories_read"   ON public.stories FOR SELECT USING (true);
CREATE POLICY "stories_insert" ON public.stories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "stories_delete" ON public.stories FOR DELETE USING (auth.uid() = user_id);

-- ── Direct messages (realtime) ────────────────────────────────────────────────
-- conversation_id embeds the participant ids (e.g. "dm:<uidA>|<uidB>"), so RLS
-- can grant access to a message iff the caller's uid appears in it.
CREATE TABLE IF NOT EXISTS public.direct_messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id TEXT NOT NULL,
  sender_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_name     TEXT NOT NULL DEFAULT 'Хэрэглэгч',
  text            TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dm_conversation ON public.direct_messages(conversation_id, created_at);

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dm_read"   ON public.direct_messages
  FOR SELECT USING (position(auth.uid()::text in conversation_id) > 0);
CREATE POLICY "dm_insert" ON public.direct_messages
  FOR INSERT WITH CHECK (sender_id = auth.uid() AND position(auth.uid()::text in conversation_id) > 0);

-- Broadcast INSERTs over Supabase Realtime.
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;

CREATE TRIGGER touch_chat_sessions   BEFORE UPDATE ON public.chat_sessions   FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ════════════════════════════════════════════════════════════════════════════
-- Grants — RLS still filters rows, but the API roles need table-level access.
-- (Supabase's dashboard sets these automatically; a raw migration must be explicit.)
-- ════════════════════════════════════════════════════════════════════════════
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- Apply the same defaults to any future tables created by this role.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
