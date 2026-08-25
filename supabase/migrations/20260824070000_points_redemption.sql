-- Spending Zity points.
--
-- Points have been earned since the loyalty ledger shipped and could never be
-- used for anything: there was no redemption table, no endpoint, and no way to
-- turn a balance into money off an order. One point is one tugrik.
--
-- Redemptions live in their own table because the earning ledger's constraints
-- (positive points, one row per order) describe an award, not a spend.

CREATE TABLE IF NOT EXISTS public.zity_points_redemptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  points INTEGER NOT NULL CHECK (points > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS idx_zity_redemptions_user ON public.zity_points_redemptions(user_id);
ALTER TABLE public.zity_points_redemptions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "redemptions_own_read" ON public.zity_points_redemptions
    FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT SELECT ON public.zity_points_redemptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.zity_points_redemptions TO service_role;

/**
 * Spends points against an order, or refuses.
 *
 * The advisory lock serialises a customer's redemptions: two orders checking
 * out at the same moment would otherwise both read the same balance and both
 * spend it. Held for the transaction only, and taken per user, so it never
 * blocks anybody else.
 */
CREATE OR REPLACE FUNCTION public.redeem_zity_points(p_user uuid, p_order uuid, p_points integer)
RETURNS TABLE (ok boolean, balance integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_earned integer;
  v_spent integer;
  v_balance integer;
BEGIN
  IF p_points IS NULL OR p_points <= 0 THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_user::text));

  SELECT COALESCE(SUM(points), 0) INTO v_earned
  FROM public.zity_points_ledger WHERE user_id = p_user;
  SELECT COALESCE(SUM(points), 0) INTO v_spent
  FROM public.zity_points_redemptions WHERE user_id = p_user;

  v_balance := v_earned - v_spent;
  IF v_balance < p_points THEN
    RETURN QUERY SELECT false, v_balance;
    RETURN;
  END IF;

  INSERT INTO public.zity_points_redemptions (user_id, order_id, points)
  VALUES (p_user, p_order, p_points);

  RETURN QUERY SELECT true, v_balance - p_points;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_zity_points(uuid, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_zity_points(uuid, uuid, integer) TO service_role;
