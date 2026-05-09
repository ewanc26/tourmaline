// Cross-environment cache layer.
// Browser: in-memory Map. Server: SQLite (lazy-loaded).

interface CacheEntry {
	data: string;
	expiresAt: number;
}

const memoryCache = new Map<string, CacheEntry>();
const DEFAULT_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

const isServer = typeof window === 'undefined';

export function getCached<T>(key: string): T | null {
	const now = Date.now();
	const entry = memoryCache.get(key);
	if (!entry || entry.expiresAt <= now) {
		memoryCache.delete(key);
		return null;
	}
	return JSON.parse(entry.data) as T;
}

export function setCache<T>(key: string, _source: string, data: T, ttl = DEFAULT_TTL): void {
	const expiresAt = Date.now() + ttl;
	memoryCache.set(key, { data: JSON.stringify(data), expiresAt });
}

export function clearCache(): void {
	memoryCache.clear();
}
