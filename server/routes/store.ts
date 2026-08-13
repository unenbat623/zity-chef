import express from 'express';
import { isSupabaseConfigured, supabasePublic } from '../supabase.js';

const router = express.Router();

// Fallback catalog matching Zity Chef Store UI catalog
const FALLBACK_PRODUCTS = [
  {
    id: 'p-carrot',
    name: 'Лууван',
    nameEn: 'Carrot',
    emoji: '🥕',
    category: '🥦 Ногоо',
    unit: 'кг',
    pricePerUnit: 2500,
    imageUrl: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=600&q=80',
  },
  {
    id: 'p-beef',
    name: 'Үхрийн мах',
    nameEn: 'Beef',
    emoji: '🥩',
    category: '🥩 Мах',
    unit: 'кг',
    pricePerUnit: 22000,
    imageUrl: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=600&q=80',
  },
  {
    id: 'p-milk',
    name: 'Сүү',
    nameEn: 'Milk',
    emoji: '🥛',
    category: '🥛 Сүү, өндөг',
    unit: 'л',
    pricePerUnit: 3800,
    imageUrl: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=600&q=80',
  },
  {
    id: 'p-onion',
    name: 'Сонгино',
    nameEn: 'Onion',
    emoji: '🧅',
    category: '🥦 Ногоо',
    unit: 'кг',
    pricePerUnit: 1800,
    imageUrl: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=600&q=80',
  },
  {
    id: 'p-egg',
    name: 'Өндөг',
    nameEn: 'Eggs',
    emoji: '🥚',
    category: '🥛 Сүү, өндөг',
    unit: 'хайрцаг',
    pricePerUnit: 6500,
    imageUrl: 'https://images.unsplash.com/photo-1587486913049-53fc88980cfc?w=600&q=80',
  },
  {
    id: 'p-apple',
    name: 'Алим',
    nameEn: 'Apple',
    emoji: '🍎',
    category: '🍎 Жимс',
    unit: 'кг',
    pricePerUnit: 8900,
    imageUrl: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=600&q=80',
  },
  {
    id: 'p-flour',
    name: 'Гурил',
    nameEn: 'Flour',
    emoji: '🌾',
    category: '🍞 Гурилан бүтээгдэхүүн',
    unit: 'уут',
    pricePerUnit: 3200,
    imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&q=80',
  },
  {
    id: 'p-cheese',
    name: 'Бяслаг',
    nameEn: 'Cheese',
    emoji: '🧀',
    category: '🥛 Сүү, өндөг',
    unit: 'ш',
    pricePerUnit: 12500,
    imageUrl: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=600&q=80',
  },
];

interface Product {
  id: string;
  name: string;
  nameEn: string | null;
  emoji: string;
  category: string | null;
  unit: string;
  pricePerUnit: number;
  imageUrl: string | null;
}

// ── GET /api/store/products (public catalog) ──────────────────────────────────
router.get('/products', async (_req, res) => {
  if (!isSupabaseConfigured || !supabasePublic) {
    return res.json({ products: FALLBACK_PRODUCTS, source: 'fallback' });
  }

  const { data, error } = await supabasePublic
    .from('store_products')
    .select('*')
    .eq('in_stock', true)
    .order('sort_order', { ascending: true });

  if (error || !data || data.length === 0) {
    return res.json({ products: FALLBACK_PRODUCTS, source: 'fallback' });
  }

  const products: Product[] = (data || []).map((p) => ({
    id: p.id,
    name: p.name,
    nameEn: p.name_en,
    emoji: p.emoji,
    category: p.category,
    unit: p.unit,
    pricePerUnit: Number(p.price_per_unit),
    imageUrl: p.image_url,
  }));
  return res.json({ products, source: 'supabase' });
});

export default router;
