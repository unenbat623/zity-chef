-- Global daily AI ceiling.
--
-- Per-user quotas bound what one person can spend, but not what the whole app
-- can: 2000 sign-ups on a good day would still run up a bill nobody approved.
-- This is the hard stop that keeps the monthly cost inside a fixed budget.

CREATE TABLE IF NOT EXISTS public.ai_usage_global (
  usage_date DATE PRIMARY KEY DEFAULT CURRENT_DATE,
  requests   INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ai_usage_global ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.ai_usage_global TO service_role;

-- Claims one request against the app-wide allowance. Same single-statement
-- INSERT .. ON CONFLICT .. WHERE guard as the per-user counter, so concurrent
-- serverless instances cannot both slip past the ceiling.
CREATE OR REPLACE FUNCTION public.consume_global_ai_budget(p_limit INTEGER)
RETURNS TABLE (used INTEGER, remaining INTEGER, allowed BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_used INTEGER;
BEGIN
  IF p_limit <= 0 THEN
    RETURN QUERY SELECT 0, 0, FALSE;
    RETURN;
  END IF;

  INSERT INTO public.ai_usage_global AS g (usage_date, requests, updated_at)
  VALUES (CURRENT_DATE, 1, NOW())
  ON CONFLICT (usage_date) DO UPDATE
    SET requests = g.requests + 1, updated_at = NOW()
    WHERE g.requests < p_limit
  RETURNING g.requests INTO v_used;

  IF v_used IS NULL THEN
    SELECT g.requests INTO v_used FROM public.ai_usage_global g WHERE g.usage_date = CURRENT_DATE;
    RETURN QUERY SELECT COALESCE(v_used, p_limit), 0, FALSE;
    RETURN;
  END IF;

  RETURN QUERY SELECT v_used, GREATEST(p_limit - v_used, 0), TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_global_ai_budget(INTEGER) TO authenticated, service_role;

-- Read-only view of today's app-wide usage, for the health endpoint.
CREATE OR REPLACE FUNCTION public.get_global_ai_usage()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT requests FROM public.ai_usage_global WHERE usage_date = CURRENT_DATE), 0);
$$;

GRANT EXECUTE ON FUNCTION public.get_global_ai_usage() TO authenticated, service_role;
