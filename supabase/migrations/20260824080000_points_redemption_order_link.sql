-- Points are spent before the order they pay for exists.
--
-- Checkout has to know the money is covered before it writes an order, and the
-- points have to be taken off the balance before the (discounted) payment is
-- consumed — otherwise two checkouts could spend the same points. So a
-- redemption starts life unattached and is linked to the order once it lands;
-- if anything downstream fails, the row is deleted and the points come back.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS points_redeemed INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.zity_points_redemptions
  ALTER COLUMN order_id DROP NOT NULL;

-- The signature gains a column, which CREATE OR REPLACE cannot do.
DROP FUNCTION IF EXISTS public.redeem_zity_points(uuid, uuid, integer);

CREATE FUNCTION public.redeem_zity_points(p_user uuid, p_order uuid, p_points integer)
RETURNS TABLE (ok boolean, balance integer, redemption_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_earned integer;
  v_spent integer;
  v_balance integer;
  v_id uuid;
BEGIN
  IF p_points IS NULL OR p_points <= 0 THEN
    RETURN QUERY SELECT false, 0, NULL::uuid;
    RETURN;
  END IF;

  -- Serialises this customer's redemptions: two baskets checking out together
  -- would otherwise read the same balance and both spend it.
  PERFORM pg_advisory_xact_lock(hashtext(p_user::text));

  SELECT COALESCE(SUM(points), 0) INTO v_earned
  FROM public.zity_points_ledger WHERE user_id = p_user;
  SELECT COALESCE(SUM(points), 0) INTO v_spent
  FROM public.zity_points_redemptions WHERE user_id = p_user;

  v_balance := v_earned - v_spent;
  IF v_balance < p_points THEN
    RETURN QUERY SELECT false, v_balance, NULL::uuid;
    RETURN;
  END IF;

  INSERT INTO public.zity_points_redemptions (user_id, order_id, points)
  VALUES (p_user, p_order, p_points)
  RETURNING id INTO v_id;

  RETURN QUERY SELECT true, v_balance - p_points, v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_zity_points(uuid, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_zity_points(uuid, uuid, integer) TO service_role;
