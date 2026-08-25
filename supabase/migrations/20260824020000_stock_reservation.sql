-- Atomic stock reservation for checkout.
--
-- `stock_quantity` was written by the Odoo product sync and read by
-- /api/store/checkout/validate, but nothing ever decremented it: two customers
-- could buy the same last unit, and the column drifted further from reality
-- with every sale. Order creation now reserves stock through this function.
--
-- The basket is locked, checked and decremented inside one function call, so
-- the check and the write cannot be interleaved by a concurrent order. A basket
-- that cannot be satisfied in full changes nothing and reports the first
-- product that came up short.

CREATE OR REPLACE FUNCTION public.reserve_store_stock(p_items jsonb)
RETURNS TABLE (ok boolean, short_product_id uuid, short_name text, available integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_short RECORD;
BEGIN
  -- Lock every row in the basket first, in id order so two baskets sharing
  -- products queue up instead of deadlocking.
  PERFORM 1
  FROM public.store_products p
  WHERE p.id IN (
    SELECT DISTINCT (item->>'id')::uuid FROM jsonb_array_elements(p_items) AS item
  )
  ORDER BY p.id
  FOR UPDATE;

  -- The same product twice in one basket counts as one larger line.
  SELECT p.id AS id, p.name AS name, p.stock_quantity AS stock
  INTO v_short
  FROM (
    SELECT (item->>'id')::uuid AS product_id, SUM((item->>'quantity')::integer) AS quantity
    FROM jsonb_array_elements(p_items) AS item
    GROUP BY 1
  ) r
  LEFT JOIN public.store_products p ON p.id = r.product_id
  WHERE p.id IS NULL OR p.in_stock IS NOT TRUE OR p.stock_quantity < r.quantity
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT false, v_short.id, v_short.name, COALESCE(v_short.stock, 0);
    RETURN;
  END IF;

  UPDATE public.store_products p
  SET stock_quantity = p.stock_quantity - r.quantity
  FROM (
    SELECT (item->>'id')::uuid AS product_id, SUM((item->>'quantity')::integer) AS quantity
    FROM jsonb_array_elements(p_items) AS item
    GROUP BY 1
  ) r
  WHERE p.id = r.product_id;

  RETURN QUERY SELECT true, NULL::uuid, NULL::text, NULL::integer;
END;
$$;

-- Puts reserved stock back when an order is cancelled.
CREATE OR REPLACE FUNCTION public.release_store_stock(p_items jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.store_products p
  SET stock_quantity = p.stock_quantity + q.quantity
  FROM (
    SELECT (item->>'id')::uuid AS product_id, SUM((item->>'quantity')::integer) AS quantity
    FROM jsonb_array_elements(p_items) AS item
    GROUP BY 1
  ) q
  WHERE p.id = q.product_id;
END;
$$;

-- Server-side only: both functions bypass RLS, so no browser role may call them.
REVOKE ALL ON FUNCTION public.reserve_store_stock(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_store_stock(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_store_stock(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_store_stock(jsonb) TO service_role;
