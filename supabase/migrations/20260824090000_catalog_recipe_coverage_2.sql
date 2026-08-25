-- The rest of what the recipe library asks for.
--
-- After the first pass the shop covered 77% of the ingredients across 25
-- recipes. What was left was the long tail — a herb here, a sauce there — and
-- every one of them is still an ingredient somebody is told to buy and cannot.
-- Four entries are deliberately left out because they are not products:
-- "Халуун ус" (hot water), "Мөс" (ice), "Тос" and "Жимс" (generic oil and
-- fruit, which the matcher correctly refuses to guess at).
--
-- PRICES ARE ESTIMATES, exactly as in the first pass: review them, and remember
-- `npm run odoo:seed` writes them into Odoo as `list_price`.

INSERT INTO public.store_products
  (id, name, name_en, emoji, category, unit, price_per_unit, sku, expiry_days, stock_quantity, in_stock, sort_order)
VALUES
  ('00000000-0000-4000-8000-000000000047', 'Олив',            'Olives',        '🫒', '🧂 Амтлагч', 'ш',  9500,  'OLIVES',      180, 100, true, 470),
  ('00000000-0000-4000-8000-000000000048', 'Самрын үр',       'Seeds',         '🌰', '🧂 Амтлагч', 'ш',  11000, 'SEEDS',       180, 100, true, 480),
  ('00000000-0000-4000-8000-000000000049', 'Самрын тос',      'Nut butter',    '🥜', '🧂 Амтлагч', 'ш',  18000, 'NUTBUTTER',   180, 100, true, 490),
  ('00000000-0000-4000-8000-000000000050', 'Матча нунтаг',    'Matcha powder', '🍵', '🧂 Амтлагч', 'ш',  35000, 'MATCHA',      365, 100, true, 500),
  ('00000000-0000-4000-8000-000000000051', 'Цагаан гаа',      'Cardamom',      '🌿', '🧂 Амтлагч', 'ш',  8500,  'CARDAMOM',    365, 100, true, 510),
  ('00000000-0000-4000-8000-000000000052', 'Куркума нунтаг',  'Turmeric',      '🟡', '🧂 Амтлагч', 'ш',  6500,  'TURMERIC',    365, 100, true, 520),
  ('00000000-0000-4000-8000-000000000053', 'Кокосын ус',      'Coconut water', '🥥', '🍎 Жимс',    'ш',  7500,  'COCONUTWATER',180, 100, true, 530),
  ('00000000-0000-4000-8000-000000000054', 'Ромэн салат',     'Romaine',       '🥬', '🥦 Ногоо',   'ш',  5500,  'ROMAINE',     5,   100, true, 540),
  ('00000000-0000-4000-8000-000000000055', 'Сухари',          'Croutons',      '🍞', '🍞 Гурилан бүтээгдэхүүн', 'уут', 5500, 'CROUTONS', 180, 100, true, 550),
  ('00000000-0000-4000-8000-000000000056', 'Цезарь соус',     'Caesar sauce',  '🥗', '🧂 Амтлагч', 'ш',  12000, 'CAESAR',      180, 100, true, 560),
  ('00000000-0000-4000-8000-000000000057', 'Томат соус',      'Tomato sauce',  '🥫', '🧂 Амтлагч', 'ш',  6500,  'TOMATOSAUCE', 365, 100, true, 570),
  ('00000000-0000-4000-8000-000000000058', 'Розмарин',        'Rosemary',      '🌿', '🥦 Ногоо',   'ш',  4500,  'ROSEMARY',    7,   100, true, 580),
  ('00000000-0000-4000-8000-000000000059', 'Базилик',         'Basil',         '🌿', '🥦 Ногоо',   'ш',  4500,  'BASIL',       7,   100, true, 590),
  ('00000000-0000-4000-8000-000000000060', 'Аспарагус',       'Asparagus',     '🥬', '🥦 Ногоо',   'кг', 18000, 'ASPARAGUS',   7,   100, true, 600),
  ('00000000-0000-4000-8000-000000000061', 'Сам хорхой',      'Shrimp',        '🦐', '🥩 Мах',     'кг', 48000, 'SHRIMP',      3,   100, true, 610),
  ('00000000-0000-4000-8000-000000000062', 'Амтат хулуу',     'Pumpkin',       '🎃', '🥦 Ногоо',   'кг', 5500,  'PUMPKIN',     30,  100, true, 620),
  ('00000000-0000-4000-8000-000000000063', 'Бальзамик цуу',   'Balsamic',      '🍾', '🧂 Амтлагч', 'ш',  14000, 'BALSAMIC',    730, 100, true, 630),
  ('00000000-0000-4000-8000-000000000064', 'Мисо паста',      'Miso paste',    '🍲', '🧂 Амтлагч', 'ш',  16000, 'MISO',        180, 100, true, 640),
  ('00000000-0000-4000-8000-000000000065', 'Вакаме замаг',    'Wakame',        '🌊', '🧂 Амтлагч', 'ш',  9500,  'WAKAME',      365, 100, true, 650),
  ('00000000-0000-4000-8000-000000000066', 'Даши шөл',        'Dashi stock',   '🍜', '🧂 Амтлагч', 'ш',  11000, 'DASHI',       365, 100, true, 660),
  ('00000000-0000-4000-8000-000000000067', 'Ваниль',          'Vanilla',       '🍦', '🧂 Амтлагч', 'ш',  9500,  'VANILLA',     730, 100, true, 670)
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
