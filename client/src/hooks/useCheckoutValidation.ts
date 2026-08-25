import { CartItem } from '../types';
import { authedFetch } from '../lib/apiClient';

export interface CheckoutValidation {
  ok: boolean;
  /** Why the basket was refused, in the server's wording. */
  message?: string;
  /** Machine-readable reason, e.g. AUTH_REQUIRED. */
  code?: string;
  /** Catalog price of the basket, before delivery and any discount. */
  subtotal?: number;
  /** What delivery adds, by the server's own rule. */
  deliveryFee?: number;
  /** What a coupon takes off. */
  discountAmount?: number;
  /**
   * What the server will charge for this basket: subtotal − discount + delivery.
   * The payment is raised for exactly this, so the quote and the charge cannot
   * drift — order creation recomputes it and refuses anything else.
   */
  totalAmount?: number;
}

/**
 * Asks the server whether this basket can still be bought, before any money
 * moves: every line in stock, every product still on sale, and the catalog
 * price of the basket.
 *
 * `/api/store/checkout/validate` existed but nothing ever called it, so the
 * first time a sold-out or re-priced basket was noticed was after the customer
 * had already paid — and the order was then refused. Checking first turns that
 * into a message they can act on.
 *
 * A network failure resolves as `ok` rather than blocking the sale: order
 * creation validates everything again, so a pre-flight outage must not stop a
 * basket that is perfectly fine.
 */
export async function validateCheckout(
  items: CartItem[],
  deliveryMode: 'delivery' | 'pickup' = 'delivery'
): Promise<CheckoutValidation> {
  try {
    const res = await authedFetch('/api/store/checkout/validate', {
      method: 'POST',
      body: JSON.stringify({
        items: items.map((item) => ({ id: item.productId || item.id, quantity: item.quantity })),
        deliveryMode,
      }),
    });
    const data = await res.json().catch(() => ({}));
    // The endpoint answers with `message` for a basket problem and `error` for
    // an access one; reading only the first left a signed-out shopper staring
    // at an empty reason.
    if (!res.ok) return { ok: false, message: data.message, code: data.error };
    return {
      ok: true,
      subtotal: Number(data.subtotal ?? 0),
      deliveryFee: Number(data.deliveryFee ?? 0),
      discountAmount: Number(data.discountAmount ?? 0),
      totalAmount: Number(data.totalAmount ?? data.subtotal ?? 0),
    };
  } catch {
    return { ok: true };
  }
}
