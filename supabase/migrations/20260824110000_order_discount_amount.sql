-- ════════════════════════════════════════════════════════════════════════════
-- Coupon discount on the order
--
-- The shopper is charged items − coupon + delivery, and the coupon part was
-- recorded nowhere. Two consequences, both of them accounting errors:
--
--   1. The Odoo sale order was built from catalog prices with no discount line,
--      so it totalled the full amount. A 10% coupon on a 44,000₮ basket left
--      Odoo claiming 49,000₮ against 44,600₮ actually collected — revenue
--      overstated by the discount, and an invoice asking the customer for money
--      they had already been let off.
--   2. Reconciliation compares the two totals, so every coupon order would be
--      reported as a mismatch that no one could explain.
--
-- Keeping the amount on the row lets any later re-sync rebuild the same sale
-- order, exactly as `delivery_fee` does.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.orders.discount_amount IS
  'Coupon discount applied to this order. Already deducted from total_amount and mirrored as a negative discount line on the Odoo sale order.';
