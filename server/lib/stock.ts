import { supabaseAdmin } from '../supabase.js';

/**
 * Catalog stock, shared by the routes that move it.
 *
 * Checkout takes stock out, cancellation puts it back, and reconciliation puts
 * it back too when Odoo says an order was cancelled there — so this cannot live
 * inside the orders route, which already imports the Odoo one.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Takes the basket's quantities out of the catalog's stock, atomically.
 *
 * Returns null on success, or the reason the basket cannot be filled. Stock was
 * previously only ever *read* (by the checkout validation the client never
 * called) and written by the Odoo product sync — never decremented by a sale,
 * so the shop could sell the same last unit to everyone who asked for it.
 */
export async function reserveStock(
  items: Array<{ id: string; quantity: number }>
): Promise<{ name: string; available: number } | null> {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin.rpc('reserve_store_stock', {
    p_items: items.map((item) => ({ id: item.id, quantity: item.quantity })),
  });
  if (error) {
    // A deployment that has not run the migration yet must not lose orders over
    // a missing function — it is no worse off than before this check existed.
    if (error.message.includes('reserve_store_stock')) {
      console.warn('[orders] stock reservation unavailable — run npm run db:push');
      return null;
    }
    throw new Error(error.message);
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || row.ok) return null;
  return { name: String(row.short_name || ''), available: Number(row.available || 0) };
}

/** Puts a cancelled order's quantities back into the catalog. */
export async function releaseStock(items: any[]): Promise<void> {
  if (!supabaseAdmin || !Array.isArray(items) || items.length === 0) return;
  const payload = items
    .map((item: any) => ({
      id: String(item?.id ?? item?.productId ?? ''),
      quantity: Number(item?.quantity || 0),
    }))
    .filter((item) => UUID_RE.test(item.id) && item.quantity > 0);
  if (payload.length === 0) return;
  const { error } = await supabaseAdmin.rpc('release_store_stock', { p_items: payload });
  if (error) console.error('[orders] stock release failed:', error.message);
}
