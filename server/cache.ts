/**
 * Cache layer with a pluggable backend:
 *   - Upstash Redis (HTTP) when UPSTASH_REDIS_REST_URL + _TOKEN are set — shared
 *     across all server instances / serverless invocations (required at scale).
 *   - In-memory LRU otherwise — fine for a single instance / local dev.
 *
 * The interface is async so both backends look the same to callers.
 */
import { Redis } from '@upstash/redis';

export interface CacheStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlMs: number): Promise<void>;
  stats(): { backend: string; size: number; validEntries: number; totalCacheHits: number };
}

// ── In-memory LRU store ───────────────────────────────────────────────────────
interface CacheEntry {
  value: string;
  expiresAt: number;
  hitCount: number;
}

class LRUStore implements CacheStore {
  private cache = new Map<string, CacheEntry>();
  constructor(private maxSize = 1000) {}

  async get(key: string): Promise<string | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    // Move to end (most recently used) and count the hit.
    this.cache.delete(key);
    entry.hitCount++;
    this.cache.set(key, entry);
    return entry.value;
  }

  async set(key: string, value: string, ttlMs: number): Promise<void> {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, { value, expiresAt: Date.now() + ttlMs, hitCount: 0 });
  }

  stats() {
    let totalHits = 0;
    let valid = 0;
    const now = Date.now();
    this.cache.forEach((entry) => {
      if (now < entry.expiresAt) {
        valid++;
        totalHits += entry.hitCount;
      }
    });
    return { backend: 'memory', size: this.cache.size, validEntries: valid, totalCacheHits: totalHits };
  }
}

// ── Redis-backed store ────────────────────────────────────────────────────────
class RedisStore implements CacheStore {
  private hits = 0;
  constructor(
    private redis: Redis,
    private ns: string
  ) {}

  async get(key: string): Promise<string | null> {
    const value = await this.redis.get<string>(`${this.ns}:${key}`);
    if (value != null) this.hits++;
    return value ?? null;
  }

  async set(key: string, value: string, ttlMs: number): Promise<void> {
    await this.redis.set(`${this.ns}:${key}`, value, { px: ttlMs });
  }

  stats() {
    return { backend: 'redis', size: -1, validEntries: -1, totalCacheHits: this.hits };
  }
}

// ── Backend selection ─────────────────────────────────────────────────────────
const hasUpstash = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);

// automaticDeserialization: false → get() always returns the raw string we stored
// (so JSON payloads survive round-trips without being double-parsed).
export const redisClient: Redis | null = hasUpstash
  ? Redis.fromEnv({ automaticDeserialization: false })
  : null;

export const cacheBackend = redisClient ? 'redis' : 'memory';

function makeStore(namespace: string, maxSize: number): CacheStore {
  return redisClient ? new RedisStore(redisClient, namespace) : new LRUStore(maxSize);
}

// Singleton stores shared across all requests.
export const aiResponseCache = makeStore('ai', 2000); // AI chat responses, TTL 10min
export const ocrResultCache = makeStore('ocr', 500); // Receipt OCR, TTL 1hr
