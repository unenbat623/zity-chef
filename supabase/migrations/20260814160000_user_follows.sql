-- Social graph — one chef following another.
--
-- `profiles.followers_count` never existed: the client kept the numbers in
-- localStorage and always rendered 0, and there was no way to follow anyone at
-- all. Storing the edges here makes the counts real and shared between users.

CREATE TABLE IF NOT EXISTS public.user_follows (
  follower_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CONSTRAINT user_follows_no_self CHECK (follower_id <> following_id)
);

-- "Who follows X" is the read the profile sheet does on every open; the primary
-- key only covers the follower side.
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.user_follows(following_id);

ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

-- Counts are public (they show on every profile); an edge may only be created
-- or removed by the person doing the following.
DO $$ BEGIN
  CREATE POLICY "follows_read" ON public.user_follows FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "follows_insert" ON public.user_follows
    FOR INSERT WITH CHECK (auth.uid() = follower_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "follows_delete" ON public.user_follows
    FOR DELETE USING (auth.uid() = follower_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
