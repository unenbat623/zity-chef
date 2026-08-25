import { getSupabaseForUser, supabaseAdmin, isSupabaseConfigured } from '../supabase.js';
import { AuthenticatedRequest, isGuestId } from '../middleware/auth.js';

export type Tier = 'free' | 'pro' | 'family';

/** Daily AI allowance per tier. Env-tunable so pricing can change without a deploy. */
export const DAILY_AI_LIMIT: Record<Tier, number> = {
  free: Number(process.env.AI_FREE_DAILY_LIMIT || 2),
  pro: Number(process.env.AI_PRO_DAILY_LIMIT || 100),
  family: Number(process.env.AI_FAMILY_DAILY_LIMIT || 300),
};

/**
 * App-wide daily ceiling. Per-user quotas bound one person's spend; this bounds
 * everyone's. The default sits just inside the Gemini free tier (~1,000 req/day
 * on Flash-Lite) so the bill stays at zero until it is deliberately raised.
 * Roughly: 231 req/day ≈ $5/month if every request were billed.
 */
export const GLOBAL_DAILY_LIMIT = Number(process.env.AI_GLOBAL_DAILY_LIMIT || 900);

const TIER_TTL_MS = 60_000;
const tierCache = new Map<string, { tier: Tier; at: number }>();

function normalizeTier(value: unknown): Tier {
  return value === 'pro' || value === 'family' ? value : 'free';
}

/**
 * The subscription tier of record, read from `profiles`. The auth middleware
 * cannot supply it: the JWT carries no tier claim, so trusting the client would
 * let anyone hand themselves Pro by editing localStorage.
 */
export async function getSubscriptionTier(req: AuthenticatedRequest): Promise<Tier> {
  const userId = req.user?.id;
  if (!userId || isGuestId(userId) || !req.accessToken || !isSupabaseConfigured) return 'free';

  const cached = tierCache.get(userId);
  if (cached && Date.now() - cached.at < TIER_TTL_MS) return cached.tier;

  try {
    const db = getSupabaseForUser(req.accessToken);
    const { data, error } = await db
      .from('profiles')
      .select('subscription_tier,subscription_expires_at')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) return 'free';

    const expiresAt = data.subscription_expires_at ? new Date(data.subscription_expires_at) : null;
    const expired = expiresAt !== null && expiresAt.getTime() < Date.now();
    const tier = expired ? 'free' : normalizeTier(data.subscription_tier);

    tierCache.set(userId, { tier, at: Date.now() });
    return tier;
  } catch {
    return 'free';
  }
}

/** Called once a payment is verified. Uses the admin client — a user must not
 *  be able to promote themselves, so this never runs off the caller's token. */
export async function setSubscriptionTier(
  userId: string,
  tier: Tier,
  months = 1
): Promise<boolean> {
  if (!supabaseAdmin) return false;
  const expiresAt =
    tier === 'free' ? null : new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      subscription_tier: tier,
      subscription_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    console.error('[subscription] failed to set tier:', error.message);
    return false;
  }
  tierCache.delete(userId);
  return true;
}

export interface QuotaResult {
  allowed: boolean;
  used: number;
  remaining: number;
  limit: number;
  tier: Tier;
  /** Set when the app-wide ceiling stopped the request, not the user's own. */
  budgetExhausted?: boolean;
}

let globalMemoryUsage = { day: '', count: 0 };

/**
 * Claims one request against the app-wide daily ceiling. Runs before the
 * per-user claim so a blocked request never burns someone's personal quota.
 */
async function consumeGlobalBudget(accessToken?: string): Promise<boolean> {
  if (GLOBAL_DAILY_LIMIT <= 0) return true; // 0 or less disables the ceiling

  if (accessToken && isSupabaseConfigured) {
    try {
      const db = getSupabaseForUser(accessToken);
      const { data, error } = await db.rpc('consume_global_ai_budget', {
        p_limit: GLOBAL_DAILY_LIMIT,
      });
      const row = Array.isArray(data) ? data[0] : data;
      if (!error && row) return Boolean(row.allowed);
      if (error) console.warn('[subscription] global budget RPC unavailable:', error.message);
    } catch (err) {
      console.warn('[subscription] global budget failed:', (err as Error).message);
    }
  }

  const day = new Date().toISOString().slice(0, 10);
  if (globalMemoryUsage.day !== day) globalMemoryUsage = { day, count: 0 };
  if (globalMemoryUsage.count >= GLOBAL_DAILY_LIMIT) return false;
  globalMemoryUsage.count += 1;
  return true;
}

// Per-instance fallback for guests and for when Postgres is unreachable. Not
// authoritative across serverless instances, but better than no ceiling at all.
const memoryUsage = new Map<string, { day: string; count: number }>();

/**
 * Quota key for the in-memory fallback. Guests are keyed by IP, not by their
 * X-Guest-Id: that header is client-generated, so a caller could rotate it and
 * reset their allowance at will — enough to drain the app-wide daily AI budget
 * from a single machine. Signed-in users keep their uid (their quota is
 * normally enforced in Postgres anyway).
 */
function quotaKeyFor(req: AuthenticatedRequest, userId: string): string {
  if (!isGuestId(userId)) return userId;
  return `ip:${req.ip || req.socket?.remoteAddress || 'unknown'}`;
}

function consumeInMemory(key: string, limit: number): { used: number; allowed: boolean } {
  const day = new Date().toISOString().slice(0, 10);
  const entry = memoryUsage.get(key);
  const current = entry && entry.day === day ? entry.count : 0;
  if (current >= limit) return { used: current, allowed: false };
  memoryUsage.set(key, { day, count: current + 1 });
  return { used: current + 1, allowed: true };
}

/** Claims one AI request against the caller's daily allowance. */
export async function consumeAiQuota(req: AuthenticatedRequest): Promise<QuotaResult> {
  const tier = await getSubscriptionTier(req);
  const limit = DAILY_AI_LIMIT[tier];
  const userId = req.user?.id || 'anonymous';

  // The budget ceiling comes first: if the app is out of allowance for today,
  // the user should not lose one of their own requests over it.
  if (!(await consumeGlobalBudget(req.accessToken))) {
    return { allowed: false, used: 0, remaining: 0, limit, tier, budgetExhausted: true };
  }

  if (!isGuestId(userId) && req.accessToken && isSupabaseConfigured) {
    try {
      const db = getSupabaseForUser(req.accessToken);
      const { data, error } = await db.rpc('consume_ai_quota', { p_limit: limit });
      const row = Array.isArray(data) ? data[0] : data;
      if (!error && row) {
        return {
          allowed: Boolean(row.allowed),
          used: Number(row.used ?? 0),
          remaining: Number(row.remaining ?? 0),
          limit,
          tier,
        };
      }
      if (error) console.warn('[subscription] consume_ai_quota unavailable:', error.message);
    } catch (err) {
      console.warn('[subscription] quota RPC failed:', (err as Error).message);
    }
  }

  const local = consumeInMemory(quotaKeyFor(req, userId), limit);
  return {
    allowed: local.allowed,
    used: local.used,
    remaining: Math.max(limit - local.used, 0),
    limit,
    tier,
  };
}

/** Current usage without spending a request — for the UI counter. */
export async function peekAiQuota(req: AuthenticatedRequest): Promise<QuotaResult> {
  const tier = await getSubscriptionTier(req);
  const limit = DAILY_AI_LIMIT[tier];
  const userId = req.user?.id || 'anonymous';
  let used = 0;

  if (!isGuestId(userId) && req.accessToken && isSupabaseConfigured) {
    try {
      const db = getSupabaseForUser(req.accessToken);
      const { data, error } = await db.rpc('get_ai_usage');
      if (!error && typeof data === 'number') used = data;
    } catch {
      /* fall through to the in-memory view */
    }
  } else {
    // Same key consumeAiQuota writes under, or the counter the UI shows would
    // never match the one actually being enforced.
    const day = new Date().toISOString().slice(0, 10);
    const entry = memoryUsage.get(quotaKeyFor(req, userId));
    used = entry && entry.day === day ? entry.count : 0;
  }

  return { allowed: used < limit, used, remaining: Math.max(limit - used, 0), limit, tier };
}
