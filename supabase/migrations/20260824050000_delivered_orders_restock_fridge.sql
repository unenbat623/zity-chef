-- Groceries bought in the app end up in the app's fridge.
--
-- Chef's whole loop is fridge → recipe → missing ingredients → order. The last
-- step never closed: a delivered order left the fridge exactly as it was, so a
-- customer who bought two kilos of carrots through Zity had to add them by hand
-- — or photograph the receipt and have the AI read back what the app itself had
-- just sold them.
--
-- `inventory_stocked_at` makes the restock happen exactly once per order, no
-- matter how many times the delivered status is pushed or replayed.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS inventory_stocked_at TIMESTAMPTZ;

-- The store sells bread and flour, and the fridge had nowhere to put them: its
-- category check listed five of the store's six categories, so any restock of a
-- bakery product would have been rejected by the constraint.
ALTER TABLE public.inventory_items
  DROP CONSTRAINT IF EXISTS inventory_items_category_check;

ALTER TABLE public.inventory_items
  ADD CONSTRAINT inventory_items_category_check CHECK (category IN (
    '🥦 Ногоо', '🥩 Мах', '🥛 Сүү, өндөг', '🧂 Амтлагч', '🍎 Жимс', '🍞 Гурилан бүтээгдэхүүн'
  ));
