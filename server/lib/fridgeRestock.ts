import { supabaseAdmin } from '../supabase.js';

/**
 * Puts a delivered order's groceries into the customer's fridge.
 *
 * This is the step that closes Chef's loop — fridge → recipe → missing
 * ingredients → order → fridge. Without it the app sold food and then asked the
 * customer to tell it what they had bought.
 *
 * Runs at most once per order (`orders.inventory_stocked_at`), so replaying the
 * delivered status or reconciling with Odoo cannot double-stock a fridge.
 */

/** Fridge units are a closed set; the catalog sells in shop units. */
const UNIT_MAP: Record<string, { unit: 'гр' | 'л' | 'ш'; factor: number }> = {
  кг: { unit: 'гр', factor: 1000 },
  kg: { unit: 'гр', factor: 1000 },
  гр: { unit: 'гр', factor: 1 },
  g: { unit: 'гр', factor: 1 },
  л: { unit: 'л', factor: 1 },
  l: { unit: 'л', factor: 1 },
  мл: { unit: 'л', factor: 0.001 },
  ш: { unit: 'ш', factor: 1 },
  pcs: { unit: 'ш', factor: 1 },
  уут: { unit: 'ш', factor: 1 },
  хайрцаг: { unit: 'ш', factor: 1 },
  ширхэг: { unit: 'ш', factor: 1 },
};

const FRIDGE_CATEGORIES = [
  '🥦 Ногоо',
  '🥩 Мах',
  '🥛 Сүү, өндөг',
  '🧂 Амтлагч',
  '🍎 Жимс',
  '🍞 Гурилан бүтээгдэхүүн',
];

/** Converts a purchase quantity into the units the fridge stores. */
export function toFridgeQuantity(
  quantity: number,
  unit: string
): { quantity: number; unit: 'гр' | 'л' | 'ш' } {
  const mapped = UNIT_MAP[
    String(unit || '')
      .toLowerCase()
      .trim()
  ] ?? { unit: 'ш' as const, factor: 1 };
  const converted = Number(quantity || 0) * mapped.factor;
  return {
    // Grams are whole; litres keep two decimals for half-litre cartons.
    quantity: mapped.unit === 'гр' ? Math.round(converted) : Math.round(converted * 100) / 100,
    unit: mapped.unit,
  };
}

function expiryDateFromDays(days: number): string {
  const safe = Number.isFinite(days) && days > 0 ? days : 7;
  return new Date(Date.now() + safe * 86_400_000).toISOString().slice(0, 10);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMBEDDED_UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

/**
 * The catalog id behind an order line. Orders placed before the canonical
 * snapshot stored the cart line id — `cart-<uuid>-<timestamp>` — so reading
 * `item.id` verbatim would find no product and restock the fridge with a
 * nameless, category-less row.
 */
function catalogIdOf(item: any): string {
  const raw = String(item?.productId ?? item?.id ?? '');
  if (UUID_RE.test(raw)) return raw;
  const embedded = raw.match(EMBEDDED_UUID_RE);
  return embedded ? embedded[0] : '';
}

export interface RestockResult {
  stocked: number;
  skipped: 'already' | 'no-items' | 'not-configured' | null;
}

export async function stockFridgeFromOrder(orderKey: string): Promise<RestockResult> {
  if (!supabaseAdmin) return { stocked: 0, skipped: 'not-configured' };

  const query = supabaseAdmin
    .from('orders')
    .select('id,user_id,order_ref,items_snapshot,inventory_stocked_at');
  const { data: order, error } = await (
    UUID_RE.test(orderKey)
      ? query.or(`id.eq.${orderKey},order_ref.eq.${orderKey}`)
      : query.eq('order_ref', orderKey)
  ).maybeSingle();

  if (error) throw new Error(error.message);
  if (!order) return { stocked: 0, skipped: 'no-items' };
  if (order.inventory_stocked_at) return { stocked: 0, skipped: 'already' };

  const items = Array.isArray(order.items_snapshot) ? order.items_snapshot : [];
  if (items.length === 0) return { stocked: 0, skipped: 'no-items' };

  // The snapshot carries name, emoji, unit and quantity but not the shelf life
  // or the category, so the catalog fills those in.
  const productIds = [...new Set(items.map(catalogIdOf))].filter(Boolean);

  const catalog = new Map<string, any>();
  if (productIds.length > 0) {
    const { data: products } = await supabaseAdmin
      .from('store_products')
      .select('id,name,name_en,emoji,category,unit,expiry_days,price_per_unit')
      .in('id', productIds);
    for (const product of products || []) catalog.set(String(product.id), product);
  }

  const rows = items
    .map((item: any) => {
      const product = catalog.get(catalogIdOf(item));
      const quantity = Number(item?.quantity || 0);
      if (quantity <= 0) return null;

      const converted = toFridgeQuantity(quantity, product?.unit || item?.unit || 'ш');
      const category = FRIDGE_CATEGORIES.includes(String(product?.category))
        ? String(product?.category)
        : '🧂 Амтлагч';

      return {
        user_id: order.user_id,
        name: String(product?.name || item?.name || 'Бараа'),
        name_en: product?.name_en || null,
        emoji: String(product?.emoji || item?.emoji || '📦'),
        category,
        quantity: converted.quantity,
        unit: converted.unit,
        expiry_date: expiryDateFromDays(Number(product?.expiry_days ?? 7)),
        price_per_unit: Number(item?.pricePerUnit ?? product?.price_per_unit ?? 0),
      };
    })
    .filter(Boolean);

  if (rows.length === 0) return { stocked: 0, skipped: 'no-items' };

  // Claim the order first: the conditional update is what makes two delivered
  // pushes racing each other stock the fridge once rather than twice. Claiming
  // after the insert would mean deleting rows to undo the loser, and deleting a
  // customer's groceries to fix our own race is worse than the race.
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from('orders')
    .update({ inventory_stocked_at: new Date().toISOString() })
    .eq('id', order.id)
    .is('inventory_stocked_at', null)
    .select('id');
  if (claimError) throw new Error(claimError.message);
  if (!claimed || claimed.length === 0) return { stocked: 0, skipped: 'already' };

  const { error: insertError } = await supabaseAdmin.from('inventory_items').insert(rows);
  if (insertError) {
    // Hand the claim back so a retry can still stock the fridge.
    await supabaseAdmin.from('orders').update({ inventory_stocked_at: null }).eq('id', order.id);
    throw new Error(insertError.message);
  }

  return { stocked: rows.length, skipped: null };
}
