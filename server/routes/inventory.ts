import express from 'express';
import { AuthenticatedRequest, authenticateToken, isGuestId } from '../middleware/auth.js';
import { isSupabaseConfigured, getSupabaseForUser } from '../supabase.js';
import { Ingredient } from '../../client/src/types.js';

const router = express.Router();
router.use(authenticateToken);

// In-memory fallback store — used only for guests / when Supabase is unset.
// Keyed by user id so each identity is isolated even without a database.
const memoryStore = new Map<string, Ingredient[]>();

// ── Helpers ──────────────────────────────────────────────────────────────────
/** True when the request should hit Postgres (real, verified user + config). */
function usesDb(req: AuthenticatedRequest): boolean {
  return Boolean(isSupabaseConfigured && req.accessToken && !isGuestId(req.user?.id));
}

/** Map a snake_case DB row to the camelCase Ingredient the frontend expects. */
function rowToIngredient(r: Record<string, unknown>): Ingredient {
  return {
    id: String(r.id),
    name: String(r.name),
    nameEn: (r.name_en as string) ?? undefined,
    emoji: (r.emoji as string) || '📦',
    category: r.category as Ingredient['category'],
    quantity: Number(r.quantity ?? 1),
    unit: (r.unit as Ingredient['unit']) || 'ш',
    expiryDays: r.expiry_date
      ? Math.max(0, Math.ceil((new Date(String(r.expiry_date)).getTime() - Date.now()) / 86400000))
      : 7,
    pricePerUnit: r.price_per_unit != null ? Number(r.price_per_unit) : undefined,
  };
}

function expiryDateFromDays(days: number): string {
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

// ── GET /api/inventory ────────────────────────────────────────────────────────
router.get('/', async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;

  if (usesDb(req)) {
    const db = getSupabaseForUser(req.accessToken!);
    const { data, error } = await db
      .from('inventory_items')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[Supabase Inventory Fetch Error]', error.message);
      return res.status(502).json({ error: 'Failed to load inventory' });
    }
    return res.json({ items: (data || []).map(rowToIngredient), source: 'supabase' });
  }

  const items = memoryStore.get(userId) || [];
  return res.json({ items, source: 'memory' });
});

// ── POST /api/inventory ───────────────────────────────────────────────────────
router.post('/', async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const body = req.body as Partial<Ingredient>;

  if (!body.name) {
    return res.status(400).json({ error: 'name is required' });
  }

  const item: Ingredient = {
    id: body.id || `item-${Date.now()}`,
    name: body.name,
    emoji: body.emoji || '📦',
    category: body.category || '🥦 Ногоо',
    quantity: body.quantity ?? 1,
    unit: body.unit || 'ш',
    expiryDays: body.expiryDays ?? 7,
    pricePerUnit: body.pricePerUnit ?? 3000,
  };

  if (usesDb(req)) {
    const db = getSupabaseForUser(req.accessToken!);
    const { data, error } = await db
      .from('inventory_items')
      .insert({
        user_id: userId,
        name: item.name,
        name_en: item.nameEn ?? null,
        emoji: item.emoji,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        expiry_date: expiryDateFromDays(item.expiryDays),
        price_per_unit: item.pricePerUnit ?? 0,
      })
      .select()
      .single();
    if (error) {
      console.error('[Supabase Inventory Insert Error]', error.message);
      return res.status(502).json({ error: 'Failed to add item' });
    }
    return res.status(201).json({ item: rowToIngredient(data), source: 'supabase' });
  }

  const userItems = memoryStore.get(userId) || [];
  memoryStore.set(userId, [item, ...userItems]);
  return res.status(201).json({ item, source: 'memory' });
});

// ── PUT /api/inventory/:id ────────────────────────────────────────────────────
router.put('/:id', async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const body = req.body as Partial<Ingredient>;

  if (usesDb(req)) {
    const db = getSupabaseForUser(req.accessToken!);
    const patch: Record<string, unknown> = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.emoji !== undefined) patch.emoji = body.emoji;
    if (body.category !== undefined) patch.category = body.category;
    if (body.quantity !== undefined) patch.quantity = body.quantity;
    if (body.unit !== undefined) patch.unit = body.unit;
    if (body.expiryDays !== undefined) patch.expiry_date = expiryDateFromDays(body.expiryDays);
    if (body.pricePerUnit !== undefined) patch.price_per_unit = body.pricePerUnit;

    const { data, error } = await db
      .from('inventory_items')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) {
      console.error('[Supabase Inventory Update Error]', error.message);
      return res.status(502).json({ error: 'Failed to update item' });
    }
    return res.json({ item: rowToIngredient(data), source: 'supabase' });
  }

  const userItems = memoryStore.get(userId) || [];
  const updated = userItems.map((i) => (i.id === id ? { ...i, ...body, id } : i));
  memoryStore.set(userId, updated);
  const item = updated.find((i) => i.id === id);
  return res.json({ item, source: 'memory' });
});

// ── DELETE /api/inventory/:id ────────────────────────────────────────────────
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { id } = req.params;

  if (usesDb(req)) {
    const db = getSupabaseForUser(req.accessToken!);
    const { error } = await db.from('inventory_items').delete().eq('id', id);
    if (error) {
      console.error('[Supabase Inventory Delete Error]', error.message);
      return res.status(502).json({ error: 'Failed to delete item' });
    }
    return res.json({ success: true });
  }

  const userItems = memoryStore.get(userId) || [];
  memoryStore.set(
    userId,
    userItems.filter((i) => i.id !== id)
  );
  return res.json({ success: true });
});

export default router;
