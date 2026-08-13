-- Zity Chef production catalog seed.
-- Keeps public catalog/recipe APIs DB-backed instead of falling back to bundled demo data.

CREATE TABLE IF NOT EXISTS public.recipes (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  title_en     TEXT,
  image        TEXT,
  tags         TEXT[] NOT NULL DEFAULT '{}',
  time         TEXT,
  difficulty   TEXT,
  category     TEXT,
  cuisine      TEXT,
  nutrition    JSONB NOT NULL DEFAULT '{}',
  ingredients  TEXT[] NOT NULL DEFAULT '{}',
  steps        JSONB NOT NULL DEFAULT '[]',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "recipes_read" ON public.recipes FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT SELECT ON public.recipes TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipes TO service_role;

INSERT INTO public.store_products
  (id, name, name_en, emoji, category, unit, price_per_unit, image_url, in_stock, sort_order)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'Лууван', 'Carrot', '🥕', '🥦 Ногоо', 'кг', 2500, 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=600&q=80', true, 10),
  ('00000000-0000-4000-8000-000000000002', 'Үхрийн мах', 'Beef', '🥩', '🥩 Мах', 'кг', 22000, 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=600&q=80', true, 20),
  ('00000000-0000-4000-8000-000000000003', 'Сүү', 'Milk', '🥛', '🥛 Сүү, өндөг', 'л', 3800, 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=600&q=80', true, 30),
  ('00000000-0000-4000-8000-000000000004', 'Сонгино', 'Onion', '🧅', '🥦 Ногоо', 'кг', 1800, 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=600&q=80', true, 40),
  ('00000000-0000-4000-8000-000000000005', 'Өндөг', 'Eggs', '🥚', '🥛 Сүү, өндөг', 'хайрцаг', 6500, 'https://images.unsplash.com/photo-1587486913049-53fc88980cfc?w=600&q=80', true, 50),
  ('00000000-0000-4000-8000-000000000006', 'Алим', 'Apple', '🍎', '🍎 Жимс', 'кг', 8900, 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=600&q=80', true, 60),
  ('00000000-0000-4000-8000-000000000007', 'Гурил', 'Flour', '🌾', '🍞 Гурилан бүтээгдэхүүн', 'уут', 3200, 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&q=80', true, 70),
  ('00000000-0000-4000-8000-000000000008', 'Бяслаг', 'Cheese', '🧀', '🥛 Сүү, өндөг', 'ш', 12500, 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=600&q=80', true, 80)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  name_en = EXCLUDED.name_en,
  emoji = EXCLUDED.emoji,
  category = EXCLUDED.category,
  unit = EXCLUDED.unit,
  price_per_unit = EXCLUDED.price_per_unit,
  image_url = EXCLUDED.image_url,
  in_stock = EXCLUDED.in_stock,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.recipes
  (id, title, title_en, image, tags, time, difficulty, category, cuisine, nutrition, ingredients, steps)
VALUES
  (
    'nomad-tsuivan',
    'Уламжлалт Нүүдэлчний Цүйван',
    'Traditional Nomad Tsuivan',
    'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80',
    ARRAY['Монгол хоол', 'Цүйван', 'Нүүдэлчин'],
    '25 мин',
    'Дунд',
    'Үндсэн хоол',
    'Монгол',
    '{"calories":580,"protein":32,"carbs":58,"fat":22}'::jsonb,
    ARRAY['Үхрийн мах', 'Гурил', 'Сонгино', 'Лууван', 'Сармис', 'Давс', 'Хар перец', 'Тос'],
    '[
      {"title":"Гурил бэлтгэх","description":"Гурилаа давстай бүлээн усаар зуураад нимгэн элдэж хайрна.","timerMinutes":15},
      {"title":"Мах, ногоо хуурах","description":"Махаа өндөр гал дээр шараад сонгино, лууван, сармис нэмнэ.","timerMinutes":8},
      {"title":"Жигнэж болгох","description":"Хэрчсэн гурилаа дээр нь тавьж бага зэрэг ус нэмээд таглаж жигнэнэ.","timerMinutes":12}
    ]'::jsonb
  ),
  (
    'mongolian-huushuur',
    'Шүүслэг Монгол Хуушуур',
    'Juicy Mongolian Huushuur',
    'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80',
    ARRAY['Монгол хоол', 'Хуушуур', 'Үндсэн хоол'],
    '35 мин',
    'Дунд',
    'Үндсэн хоол',
    'Монгол',
    '{"calories":540,"protein":28,"carbs":48,"fat":26}'::jsonb,
    ARRAY['Үхрийн мах', 'Гурил', 'Сонгино', 'Сармис', 'Давс', 'Хар перец', 'Тос'],
    '[
      {"title":"Гурил зуурах","description":"Гурилаа дунд хатуулагтай зуураад амраана.","timerMinutes":20},
      {"title":"Мах амтлах","description":"Мах, сонгино, сармисыг жижиглээд давс, перецээр амтална.","timerMinutes":8},
      {"title":"Чимхэж шарах","description":"Махаа гуриланд боогоод халуун тосонд алтан шаргал болтол шарна.","timerMinutes":10}
    ]'::jsonb
  )
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  title_en = EXCLUDED.title_en,
  image = EXCLUDED.image,
  tags = EXCLUDED.tags,
  time = EXCLUDED.time,
  difficulty = EXCLUDED.difficulty,
  category = EXCLUDED.category,
  cuisine = EXCLUDED.cuisine,
  nutrition = EXCLUDED.nutrition,
  ingredients = EXCLUDED.ingredients,
  steps = EXCLUDED.steps;
