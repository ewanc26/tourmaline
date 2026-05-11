// Cross-environment cache layer.
// Browser: in-memory Map. Server: SQLite (lazy-loaded).

interface CacheEntry {
	data: string;
	expiresAt: number;
}

const memoryCache = new Map<string, CacheEntry>();
const DEFAULT_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days
const NEGATIVE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days for negative results

interface CacheResult<T> {
	value: T | null;
	hit: boolean;
}

/**
 * Get a cached value.
 * Returns `{ hit: false }` if the key was never queried or has expired.
 * Returns `{ hit: true, value: null }` if the key was queried and the
 * result was null (a "negative cache" hit).
 * Returns `{ hit: true, value: T }` for positive hits.
 */
export function getCached<T>(key: string): CacheResult<T> {
	const now = Date.now();
	const entry = memoryCache.get(key);
	if (!entry || entry.expiresAt <= now) {
		memoryCache.delete(key);
		return { hit: false, value: null };
	}
	const parsed = JSON.parse(entry.data);
	// Negative results are stored as the string "null"
	if (parsed === null) {
		return { hit: true, value: null };
	}
	return { hit: true, value: parsed as T };
}

export function setCache<T>(key: string, _source: string, data: T | null, ttl?: number): void {
	const effectiveTtl = ttl ?? (data === null ? NEGATIVE_TTL : DEFAULT_TTL);
	const expiresAt = Date.now() + effectiveTtl;
	memoryCache.set(key, { data: JSON.stringify(data), expiresAt });
}

export function clearCache(): void {
	memoryCache.clear();
}
