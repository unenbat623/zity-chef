import express from 'express';
import { isSupabaseConfigured, supabasePublic } from '../supabase.js';

const router = express.Router();

interface Product {
  id: string;
  name: string;
  nameEn: string | null;
  emoji: string;
  category: string | null;
  unit: string;
  pricePerUnit: number;
  imageUrl: string | null;
  expiryDays: number;
}

/**
 * The store catalog, served from the database.
 *
 * A hardcoded eight-product copy used to stand in on any error — including an
 * empty table — so a misconfigured deployment sold a catalog nobody could
 * fulfil. A failure is now reported as one.
 */
// ── GET /api/store/products (public catalog) ──────────────────────────────────
router.get('/products', async (_req, res) => {
  if (!isSupabaseConfigured || !supabasePublic) {
    return res.status(503).json({ error: 'CATALOG_UNAVAILABLE' });
  }

  const { data, error } = await supabasePublic
    .from('store_products')
    .select('*')
    .eq('in_stock', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[Store catalog error]', error.message);
    return res.status(503).json({ error: 'CATALOG_UNAVAILABLE' });
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
    expiryDays: Number(p.expiry_days) || 7,
  }));
  return res.json({ products, source: 'supabase' });
});

export default router;
