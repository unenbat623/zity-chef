import express from 'express';
import { isSupabaseConfigured, supabasePublic } from '../supabase.js';

const router = express.Router();

// Small fallback catalog when Supabase isn't configured (demo mode).
const FALLBACK_PRODUCTS = [
  { id: 'p-milk', name: 'Сүү', nameEn: 'Milk', emoji: '🥛', category: '🥛 Сүү, өндөг', unit: 'л', pricePerUnit: 3800 },
  { id: 'p-beef', name: 'Үхрийн мах', nameEn: 'Beef', emoji: '🥩', category: '🥩 Мах', unit: 'гр', pricePerUnit: 22000 },
  { id: 'p-onion', name: 'Сонгино', nameEn: 'Onion', emoji: '🧅', category: '🥦 Ногоо', unit: 'ш', pricePerUnit: 1800 },
  { id: 'p-egg', name: 'Өндөг', nameEn: 'Eggs', emoji: '🥚', category: '🥛 Сүү, өндөг', unit: 'ш', pricePerUnit: 6500 },
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

  if (error) {
    console.error('[Store Products Error]', error.message);
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
