/**
 * LRU Cache — хамгийн бага зардалтай in-memory кэш
 * Upstash Redis-тэй солих боломжтой (prod дээр $0.20/100k cmd)
 */

interface CacheEntry {
  value: string;
  expiresAt: number;
  hitCount: number;
}

export class LRUCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  get(key: string): string | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    // Move to end (LRU = most recently used)
    this.cache.delete(key);
    entry.hitCount++;
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: string, value: string, ttlMs: number): void {
    if (this.cache.size >= this.maxSize) {
      // Evict least recently used (first entry)
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
      hitCount: 0,
    });
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
    return {
      size: this.cache.size,
      validEntries: valid,
      totalCacheHits: totalHits,
    };
  }
}

// Singleton instances (shared across all requests)
export const aiResponseCache = new LRUCache(2000); // AI chat responses, TTL 10min
export const ocrResultCache = new LRUCache(500); // Receipt OCR, TTL 1hr
