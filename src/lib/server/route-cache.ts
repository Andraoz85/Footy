type CacheEntry<T> = {
  value: T;
  expiresAt: number;
  staleUntil: number;
};

const cache = new Map<string, CacheEntry<unknown>>();

export function getFreshCache<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) return null;
  return entry.value;
}

export function getStaleCache<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.staleUntil) return null;
  return entry.value;
}

export function setCache<T>(
  key: string,
  value: T,
  ttlMs: number,
  staleMs = ttlMs * 4
) {
  const now = Date.now();
  cache.set(key, {
    value,
    expiresAt: now + ttlMs,
    staleUntil: now + ttlMs + staleMs,
  });
}
