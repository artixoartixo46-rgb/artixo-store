/**
 * ARTIXO Traffic Manager
 * ──────────────────────
 * Two-layer client-side load balancer:
 *
 * Layer A — In-memory TTL cache
 *   Serves repeat calls instantly without hitting Supabase.
 *   e.g. navigating back to the products page reuses the cached list.
 *
 * Layer B — In-flight deduplication
 *   If 10 components all call loadProducts() at the same time,
 *   only ONE network request goes to Supabase; the rest await the same promise.
 *
 * Usage:
 *   import { cachedQuery, invalidate } from "@/lib/trafficManager";
 *
 *   const products = await cachedQuery(
 *     "products:all",
 *     () => supabase.from("products").select("*").then(r => r.data),
 *     3 * 60_000   // 3-min TTL (optional, default 5 min)
 *   );
 *
 *   // After a mutation, bust the relevant cache:
 *   invalidate("products:");
 */

type CacheEntry = { data: unknown; exp: number };

const mem: Map<string, CacheEntry>       = new Map();
const inFlight: Map<string, Promise<unknown>> = new Map();

const DEFAULT_TTL = 5 * 60_000; // 5 minutes

// ── Core API ──────────────────────────────────────────────────────────────────

/**
 * Fetch with dedup + cache.
 * `key`   — unique string for this query (e.g. "products:approved")
 * `fn`    — async function that returns the data
 * `ttlMs` — how long to keep in memory (default 5 min)
 */
export async function cachedQuery<T>(
  key: string,
  fn: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL
): Promise<T> {
  // 1. Memory cache hit (and not expired)
  const cached = mem.get(key);
  if (cached && Date.now() < cached.exp) {
    return cached.data as T;
  }

  // 2. Deduplicate: another call with the same key is already in-flight
  if (inFlight.has(key)) {
    return inFlight.get(key) as Promise<T>;
  }

  // 3. Fresh fetch
  const promise = fn()
    .then((data) => {
      mem.set(key, { data, exp: Date.now() + ttlMs });
      inFlight.delete(key);
      return data;
    })
    .catch((err) => {
      inFlight.delete(key);
      throw err;
    });

  inFlight.set(key, promise);
  return promise as Promise<T>;
}

/**
 * Invalidate all cache entries whose key starts with `prefix`.
 * Call after mutations so stale data isn't served.
 *
 * Examples:
 *   invalidate("products:")   // bust all product queries
 *   invalidate("profiles:")   // bust seller profile queries
 *   invalidate("")            // clear entire cache
 */
export function invalidate(prefix: string): void {
  for (const key of mem.keys()) {
    if (key.startsWith(prefix)) mem.delete(key);
  }
}

/**
 * Peek at current cache stats (useful for debugging).
 */
export function cacheStats(): { size: number; keys: string[] } {
  const now = Date.now();
  const keys: string[] = [];
  for (const [k, v] of mem.entries()) {
    if (v.exp > now) keys.push(k);
    else mem.delete(k); // evict expired
  }
  return { size: keys.length, keys };
}

// ── TTL constants (re-exported for use in hooks) ──────────────────────────────
export const TTL = {
  CATEGORIES:    30 * 60_000,  // 30 min
  SITE_SETTINGS: 10 * 60_000,  // 10 min
  PROFILES:       5 * 60_000,  //  5 min
  REVIEWS:        5 * 60_000,
  PRODUCTS:       3 * 60_000,  //  3 min
  PRODUCT_DETAIL: 2 * 60_000,  //  2 min
};
