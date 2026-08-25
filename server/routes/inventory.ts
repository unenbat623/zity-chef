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

/** Дэлгүүрийн бараа хамгийн ихдээ ийм хоног хадгалагдана. */
const MAX_EXPIRY_DAYS = 3650;

/**
 * `days`-ийг хүчинтэй хугацаанд багтаана.
 *
 * `new Date(NaN).toISOString()` нь RangeError шиддэг. Express 4 нь async
 * handler-ийн rejection-ыг барьдаггүй тул тэр алдаа unhandled rejection болж
 * Node процессыг бүхэлд нь унагаадаг байв — `{"expiryDays":"abc"}` гэсэн ганц
 * хүсэлт backend-ийг зогсооход хангалттай байсан.
 */
function normalizeExpiryDays(value: unknown): number | null {
  // Only a number or a numeric string counts. `Number(null)` and `Number('')`
  // are both 0, which would have quietly turned a nonsense field into "expires
  // today" rather than telling the caller their request was wrong.
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : NaN;
  const days = Math.trunc(numeric);
  if (!Number.isFinite(days) || days < 0 || days > MAX_EXPIRY_DAYS) return null;
  return days;
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

  const name = String(body.name ?? '').trim();
  if (!name || name.length > 200) {
    return res.status(400).json({ error: 'name is required' });
  }

  const expiryDays = normalizeExpiryDays(body.expiryDays ?? 7);
  if (expiryDays === null) {
    return res.status(400).json({ error: 'INVALID_EXPIRY_DAYS' });
  }

  const quantity = Number(body.quantity ?? 1);
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100_000) {
    return res.status(400).json({ error: 'INVALID_QUANTITY' });
  }

  const pricePerUnit = Number(body.pricePerUnit ?? 3000);
  if (!Number.isFinite(pricePerUnit) || pricePerUnit < 0 || pricePerUnit > 100_000_000) {
    return res.status(400).json({ error: 'INVALID_PRICE' });
  }

  const item: Ingredient = {
    id: body.id || `item-${Date.now()}`,
    name,
    emoji: body.emoji || '📦',
    category: body.category || '🥦 Ногоо',
    quantity,
    unit: body.unit || 'ш',
    expiryDays,
    pricePerUnit,
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
    if (body.name !== undefined) patch.name = String(body.name).slice(0, 200);
    if (body.emoji !== undefined) patch.emoji = body.emoji;
    if (body.category !== undefined) patch.category = body.category;
    if (body.unit !== undefined) patch.unit = body.unit;

    // Same bounds as the create path — an out-of-range `expiryDays` here reached
    // `new Date(NaN).toISOString()` and took the process down with it.
    if (body.expiryDays !== undefined) {
      const expiryDays = normalizeExpiryDays(body.expiryDays);
      if (expiryDays === null) return res.status(400).json({ error: 'INVALID_EXPIRY_DAYS' });
      patch.expiry_date = expiryDateFromDays(expiryDays);
    }
    if (body.quantity !== undefined) {
      const quantity = Number(body.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100_000) {
        return res.status(400).json({ error: 'INVALID_QUANTITY' });
      }
      patch.quantity = quantity;
    }
    if (body.pricePerUnit !== undefined) {
      const pricePerUnit = Number(body.pricePerUnit);
      if (!Number.isFinite(pricePerUnit) || pricePerUnit < 0 || pricePerUnit > 100_000_000) {
        return res.status(400).json({ error: 'INVALID_PRICE' });
      }
      patch.price_per_unit = pricePerUnit;
    }

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
