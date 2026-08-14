-- Shelf life per product.
--
-- The fridge tracks an expiry date for every ingredient, but the store catalog
-- had no such column: the "add ingredient" picker read it off a hardcoded list
-- in the client bundle, so anything added from the real catalog would have had
-- no expiry at all once that list was deleted.

ALTER TABLE public.store_products
  ADD COLUMN IF NOT EXISTS expiry_days INTEGER NOT NULL DEFAULT 7;

UPDATE public.store_products SET expiry_days = v.days
FROM (VALUES
  ('Лууван', 14),
  ('Үхрийн мах', 3),
  ('Сүү', 5),
  ('Сонгино', 30),
  ('Өндөг', 21),
  ('Алим', 14),
  ('Гурил', 180),
  ('Бяслаг', 14),
  ('Төмс', 30),
  ('Тахианы мах', 2),
  ('Улаан лооль', 7),
  ('Талх', 4),
  ('Байцаа', 14),
  ('Цөцгийн тос', 30),
  ('Будаа', 365),
  ('Гахайн мах', 3)
) AS v(name, days)
WHERE public.store_products.name = v.name;
