-- Stock the shop with what the recipes actually call for.
--
-- Measured against the live data before this migration: 25 recipes use 77
-- distinct ingredients, of which the 16-product catalog could sell 17. Average
-- recipe coverage was 32%, and six recipes had *no* buyable ingredient at all —
-- the "order the missing items" button had nothing to offer. These are the
-- ingredients the recipe library asks for most often, garlic (7 recipes), olive
-- oil (5), salt and pepper (4 each) at the top.
--
-- PRICES ARE ESTIMATES. They are what the shop will charge and what
-- `npm run odoo:seed` writes into Odoo as `list_price`, so review them before
-- going live. Odoo is the master afterwards: a product sync overwrites these
-- with whatever Odoo holds.
--
-- No image_url: SmartImage falls back to the curated image map and then to an
-- emoji tile, which is honest, rather than pointing at a photo of something
-- else.

INSERT INTO public.store_products
  (id, name, name_en, emoji, category, unit, price_per_unit, sku, expiry_days, stock_quantity, in_stock, sort_order)
VALUES
  -- ── Pantry & seasoning ────────────────────────────────────────────────────
  ('00000000-0000-4000-8000-000000000017', 'Сармис',        'Garlic',        '🧄', '🥦 Ногоо',                'ш',  1500,  'GARLIC',      60,  100, true, 170),
  ('00000000-0000-4000-8000-000000000018', 'Давс',          'Salt',          '🧂', '🧂 Амтлагч',              'уут', 2500,  'SALT',        730, 100, true, 180),
  ('00000000-0000-4000-8000-000000000019', 'Хар перец',     'Black pepper',  '🌶️', '🧂 Амтлагч',              'ш',  4500,  'PEPPER',      365, 100, true, 190),
  ('00000000-0000-4000-8000-000000000020', 'Оливын тос',    'Olive oil',     '🫒', '🧂 Амтлагч',              'л',  28000, 'OLIVEOIL',    365, 100, true, 200),
  ('00000000-0000-4000-8000-000000000021', 'Зөгийн бал',    'Honey',         '🍯', '🧂 Амтлагч',              'ш',  18000, 'HONEY',       730, 100, true, 210),
  ('00000000-0000-4000-8000-000000000022', 'Сой соус',      'Soy sauce',     '🍶', '🧂 Амтлагч',              'ш',  9500,  'SOYSAUCE',    365, 100, true, 220),
  ('00000000-0000-4000-8000-000000000023', 'Томат паста',   'Tomato paste',  '🥫', '🧂 Амтлагч',              'ш',  5500,  'TOMATOPASTE', 365, 100, true, 230),
  ('00000000-0000-4000-8000-000000000024', 'Какао нунтаг',  'Cocoa powder',  '🍫', '🧂 Амтлагч',              'ш',  12000, 'COCOA',       365, 100, true, 240),
  ('00000000-0000-4000-8000-000000000025', 'Гүнжид',        'Sesame',        '🌰', '🧂 Амтлагч',              'ш',  6500,  'SESAME',      180, 100, true, 250),
  ('00000000-0000-4000-8000-000000000026', 'Самар',         'Nuts',          '🥜', '🧂 Амтлагч',              'ш',  15000, 'NUTS',        180, 100, true, 260),

  -- ── Grains & bakery ───────────────────────────────────────────────────────
  ('00000000-0000-4000-8000-000000000027', 'Овъёос',        'Oats',          '🥣', '🍞 Гурилан бүтээгдэхүүн', 'уут', 8500,  'OATS',        180, 100, true, 270),
  ('00000000-0000-4000-8000-000000000028', 'Гоймон',        'Noodles',       '🍜', '🍞 Гурилан бүтээгдэхүүн', 'уут', 4500,  'NOODLES',     365, 100, true, 280),
  ('00000000-0000-4000-8000-000000000029', 'Киноа',         'Quinoa',        '🌾', '🍞 Гурилан бүтээгдэхүүн', 'уут', 22000, 'QUINOA',      365, 100, true, 290),
  ('00000000-0000-4000-8000-000000000030', 'Гранола',       'Granola',       '🥣', '🍞 Гурилан бүтээгдэхүүн', 'уут', 16000, 'GRANOLA',     180, 100, true, 300),
  ('00000000-0000-4000-8000-000000000031', 'Чиа үр',        'Chia seeds',    '🫘', '🧂 Амтлагч',              'ш',  14000, 'CHIA',        365, 100, true, 310),

  -- ── Produce ───────────────────────────────────────────────────────────────
  ('00000000-0000-4000-8000-000000000032', 'Авокадо',       'Avocado',       '🥑', '🍎 Жимс',                 'ш',  7500,  'AVOCADO',     7,   100, true, 320),
  ('00000000-0000-4000-8000-000000000033', 'Шпинат',        'Spinach',       '🥬', '🥦 Ногоо',                'ш',  6500,  'SPINACH',     5,   100, true, 330),
  ('00000000-0000-4000-8000-000000000034', 'Брокколи',      'Broccoli',      '🥦', '🥦 Ногоо',                'кг', 9500,  'BROCCOLI',    7,   100, true, 340),
  ('00000000-0000-4000-8000-000000000035', 'Нимбэг',        'Lemon',         '🍋', '🍎 Жимс',                 'ш',  2500,  'LEMON',       14,  100, true, 350),
  ('00000000-0000-4000-8000-000000000036', 'Өргөст хэмх',   'Cucumber',      '🥒', '🥦 Ногоо',                'кг', 5500,  'CUCUMBER',    7,   100, true, 360),
  ('00000000-0000-4000-8000-000000000037', 'Черри томат',   'Cherry tomato', '🍅', '🥦 Ногоо',                'ш',  8500,  'CHERRYTOMATO',7,   100, true, 370),
  ('00000000-0000-4000-8000-000000000038', 'Ногоон салат',  'Lettuce',       '🥬', '🥦 Ногоо',                'ш',  4500,  'LETTUCE',     5,   100, true, 380),
  ('00000000-0000-4000-8000-000000000039', 'Банан',         'Banana',        '🍌', '🍎 Жимс',                 'кг', 6500,  'BANANA',      7,   100, true, 390),
  ('00000000-0000-4000-8000-000000000040', 'Киви',          'Kiwi',          '🥝', '🍎 Жимс',                 'кг', 12000, 'KIWI',        10,  100, true, 400),
  ('00000000-0000-4000-8000-000000000041', 'Бөөрөлзгөнө',   'Raspberry',     '🍓', '🍎 Жимс',                 'ш',  14000, 'RASPBERRY',   5,   100, true, 410),

  -- ── Protein & dairy ───────────────────────────────────────────────────────
  ('00000000-0000-4000-8000-000000000042', 'Сэлмон загас',  'Salmon',        '🐟', '🥩 Мах',                  'кг', 65000, 'SALMON',      3,   100, true, 420),
  ('00000000-0000-4000-8000-000000000043', 'Грек тараг',    'Greek yogurt',  '🥛', '🥛 Сүү, өндөг',           'ш',  7500,  'YOGURT',      14,  100, true, 430),
  ('00000000-0000-4000-8000-000000000044', 'Тофу',          'Tofu',          '🧊', '🥛 Сүү, өндөг',           'ш',  9500,  'TOFU',        14,  100, true, 440),
  ('00000000-0000-4000-8000-000000000045', 'Нут шош',       'Chickpeas',     '🫘', '🧂 Амтлагч',              'уут', 7500,  'CHICKPEAS',   365, 100, true, 450),
  ('00000000-0000-4000-8000-000000000046', 'Борц',          'Dried beef',    '🥩', '🥩 Мах',                  'кг', 45000, 'BORTS',       180, 100, true, 460)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  name_en = EXCLUDED.name_en,
  emoji = EXCLUDED.emoji,
  category = EXCLUDED.category,
  unit = EXCLUDED.unit,
  price_per_unit = EXCLUDED.price_per_unit,
  sku = EXCLUDED.sku,
  expiry_days = EXCLUDED.expiry_days,
  in_stock = EXCLUDED.in_stock,
  sort_order = EXCLUDED.sort_order;
