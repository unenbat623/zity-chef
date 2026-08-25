-- Give every catalog product a SKU.
--
-- The Odoo bridge matches a Chef order line to an Odoo product by
-- `odoo_product_id`, then by `odoo_product_sku`, then by `sku`
-- (server/routes/odoo.ts → odooProductForItem). The seeded catalog carried none
-- of the three, so every order sync failed with "Odoo product not found" no
-- matter how healthy the connection was. The SKU is also what
-- `/api/odoo/products?sync=true` matches on when it writes Odoo ids, prices and
-- stock back into the catalog, so it has to exist before that sync can bind the
-- two catalogs together.
--
-- Only rows that have no SKU yet are touched — a SKU set by hand or by an
-- earlier Odoo sync stays as it is.

UPDATE public.store_products AS p
SET sku = v.sku
FROM (VALUES
  ('00000000-0000-4000-8000-000000000001'::uuid, 'CARROT'),
  ('00000000-0000-4000-8000-000000000002'::uuid, 'BEEF'),
  ('00000000-0000-4000-8000-000000000003'::uuid, 'MILK'),
  ('00000000-0000-4000-8000-000000000004'::uuid, 'ONION'),
  ('00000000-0000-4000-8000-000000000005'::uuid, 'EGGS'),
  ('00000000-0000-4000-8000-000000000006'::uuid, 'APPLE'),
  ('00000000-0000-4000-8000-000000000007'::uuid, 'FLOUR'),
  ('00000000-0000-4000-8000-000000000008'::uuid, 'CHEESE'),
  ('00000000-0000-4000-8000-000000000009'::uuid, 'POTATO'),
  ('00000000-0000-4000-8000-000000000010'::uuid, 'CHICKEN'),
  ('00000000-0000-4000-8000-000000000011'::uuid, 'TOMATO'),
  ('00000000-0000-4000-8000-000000000012'::uuid, 'BREAD'),
  ('00000000-0000-4000-8000-000000000013'::uuid, 'CABBAGE'),
  ('00000000-0000-4000-8000-000000000014'::uuid, 'BUTTER'),
  ('00000000-0000-4000-8000-000000000015'::uuid, 'RICE'),
  ('00000000-0000-4000-8000-000000000016'::uuid, 'PORK')
) AS v(id, sku)
WHERE p.id = v.id AND p.sku IS NULL;
