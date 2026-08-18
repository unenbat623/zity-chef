/**
 * Presentation helpers for values that arrive from the database as raw English
 * enums. Rendering them verbatim put "Easy", "paid" and "family" in front of
 * users of an otherwise fully Mongolian app.
 */

type Translate = (key: string, params?: Record<string, string | number>) => string;

const DIFFICULTY_KEYS: Record<string, string> = {
  easy: 'difficulty_easy',
  medium: 'difficulty_medium',
  hard: 'difficulty_hard',
};

/** Recipe difficulty ("Easy" | "Medium" | "Hard") in the active language. */
export function formatDifficulty(value: string | undefined, t: Translate): string {
  if (!value) return '';
  const key = DIFFICULTY_KEYS[value.toLowerCase()];
  return key ? t(key) : value;
}

const ORDER_STATUS_KEYS: Record<string, string> = {
  pending: 'store_statusPending',
  paid: 'store_statusPaid',
  delivering: 'store_statusDelivering',
  completed: 'store_statusCompleted',
  cancelled: 'store_statusCancelled',
};

/** Order status enum in the active language. */
export function formatOrderStatus(value: string | undefined, t: Translate): string {
  if (!value) return '';
  const key = ORDER_STATUS_KEYS[value.toLowerCase()];
  return key ? t(key) : value;
}

const TIER_KEYS: Record<string, string> = {
  free: 'subFree',
  pro: 'subPro',
  family: 'subFamily',
};

/** Subscription tier enum in the active language. */
export function formatTier(value: string | undefined, t: Translate): string {
  if (!value) return '';
  const key = TIER_KEYS[value.toLowerCase()];
  return key ? t(key) : value;
}
