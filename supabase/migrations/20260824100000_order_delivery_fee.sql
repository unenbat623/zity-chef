-- What the customer paid for delivery.
--
-- The fee rule existed and was quoted by the checkout validation, but nothing
-- ever charged it: order totals were the basket and nothing else, so Odoo saw
-- no delivery line either. Storing it per order keeps the invoice, the Odoo
-- sale order and the amount actually charged in agreement, and keeps a later
-- change to the fee from rewriting history.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_fee INTEGER NOT NULL DEFAULT 0;
