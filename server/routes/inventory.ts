import express from 'express';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth.js';
import { supabaseAdmin, isSupabaseConfigured } from '../supabase.js';
import { Ingredient } from '../../src/types.js';

const router = express.Router();
router.use(authenticateToken);

// In-memory fallback inventory store for offline / local demo
const memoryStore = new Map<string, Ingredient[]>([
  ['guest-user-00000000-0000-0000-0000-000000000000', [
    { id: '1', name: 'Шинэ Сүү', emoji: '🥛', category: '🥛 Сүү, өндөг', quantity: 1, unit: 'л', expiryDays: 3, pricePerUnit: 3900 },
    { id: '2', name: 'Үхрийн Мах', emoji: '🥩', category: '🥩 Мах', quantity: 800, unit: 'гр', expiryDays: 5, pricePerUnit: 24000 },
    { id: '3', name: 'Сонгино', emoji: '🥦', category: '🥦 Ногоо', quantity: 4, unit: 'ш', expiryDays: 12, pricePerUnit: 1800 },
    { id: '4', name: 'Гурил', emoji: '🌾', category: '🌾 Амтлагч', quantity: 1000, unit: 'гр', expiryDays: 30, pricePerUnit: 2500 }
  ]]
]);

// ── GET /api/inventory ────────────────────────────────────────────────────────
router.get('/', async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id || 'guest-user-00000000-0000-0000-0000-000000000000';

  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin
        .from('inventory_items')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        return res.json({ items: data, source: 'supabase' });
      }
    } catch (err) {
      console.error('[Supabase Inventory Fetch Error]', err);
    }
  }

  // Fallback to memory store
  const items = memoryStore.get(userId) || [];
  return res.json({ items, source: 'memory' });
});

// ── POST /api/inventory ───────────────────────────────────────────────────────
router.post('/', async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id || 'guest-user-00000000-0000-0000-0000-000000000000';
  const newItem = req.body as Partial<Ingredient>;

  if (!newItem.name) {
    return res.status(400).json({ error: 'name is required' });
  }

  const itemToInsert: Ingredient = {
    id: newItem.id || `item-${Date.now()}`,
    name: newItem.name,
    emoji: newItem.emoji || '📦',
    category: newItem.category || '🥦 Ногоо',
    quantity: newItem.quantity || 1,
    unit: newItem.unit || 'ш',
    expiryDays: newItem.expiryDays || 7,
    pricePerUnit: newItem.pricePerUnit || 3000,
  };

  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin
        .from('inventory_items')
        .insert({
          user_id: userId,
          name: itemToInsert.name,
          emoji: itemToInsert.emoji,
          category: itemToInsert.category,
          quantity: itemToInsert.quantity,
          unit: itemToInsert.unit,
          price_per_unit: itemToInsert.pricePerUnit
        })
        .select()
        .single();

      if (!error && data) {
        return res.status(201).json({ item: data, source: 'supabase' });
      }
    } catch (err) {
      console.error('[Supabase Inventory Insert Error]', err);
    }
  }

  // Memory fallback
  const userItems = memoryStore.get(userId) || [];
  const updated = [itemToInsert, ...userItems];
  memoryStore.set(userId, updated);
  return res.status(201).json({ item: itemToInsert, source: 'memory' });
});

// ── DELETE /api/inventory/:id ────────────────────────────────────────────────
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id || 'guest-user-00000000-0000-0000-0000-000000000000';
  const { id } = req.params;

  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      await supabaseAdmin
        .from('inventory_items')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
    } catch (err) {
      console.error('[Supabase Inventory Delete Error]', err);
    }
  }

  // Memory fallback
  const userItems = memoryStore.get(userId) || [];
  memoryStore.set(userId, userItems.filter(i => i.id !== id));
  return res.json({ success: true });
});

export default router;
