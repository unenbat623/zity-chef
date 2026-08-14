-- Per-user daily AI quota.
--
-- The tier limits shown in the subscription modal were never enforced anywhere:
-- `subscription` only drove a badge and the premium-recipe lock, so every user
-- had unlimited AI and the cost per user was unbounded. Counting in server
-- memory is not enough either — on Vercel each request may hit a different
-- instance, so the counter has to live in Postgres.

CREATE TABLE IF NOT EXISTS public.ai_usage (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  requests   INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, usage_date)
);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "ai_usage_own" ON public.ai_usage FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT SELECT ON public.ai_usage TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_usage TO service_role;

-- Claims one request against today's allowance and reports what is left.
-- The INSERT .. ON CONFLICT .. WHERE is a single statement, so two concurrent
-- serverless instances cannot both slip past the limit.
CREATE OR REPLACE FUNCTION public.consume_ai_quota(p_limit INTEGER)
RETURNS TABLE (used INTEGER, remaining INTEGER, allowed BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_used INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT 0, 0, FALSE;
    RETURN;
  END IF;

  IF p_limit <= 0 THEN
    RETURN QUERY SELECT 0, 0, FALSE;
    RETURN;
  END IF;

  INSERT INTO public.ai_usage AS u (user_id, usage_date, requests, updated_at)
  VALUES (v_uid, CURRENT_DATE, 1, NOW())
  ON CONFLICT (user_id, usage_date) DO UPDATE
    SET requests = u.requests + 1, updated_at = NOW()
    WHERE u.requests < p_limit
  RETURNING u.requests INTO v_used;

  IF v_used IS NULL THEN
    -- The conflict target existed but the WHERE guard rejected the update.
    SELECT u.requests INTO v_used
      FROM public.ai_usage u
     WHERE u.user_id = v_uid AND u.usage_date = CURRENT_DATE;
    RETURN QUERY SELECT COALESCE(v_used, p_limit), 0, FALSE;
    RETURN;
  END IF;

  RETURN QUERY SELECT v_used, GREATEST(p_limit - v_used, 0), TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_ai_quota(INTEGER) TO authenticated, service_role;

-- Read-only companion so the UI can show "3/5 left" without spending a request.
CREATE OR REPLACE FUNCTION public.get_ai_usage()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT requests FROM public.ai_usage
      WHERE user_id = auth.uid() AND usage_date = CURRENT_DATE),
    0);
$$;

GRANT EXECUTE ON FUNCTION public.get_ai_usage() TO authenticated, service_role;
