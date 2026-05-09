import Database from 'better-sqlite3';
import path from 'path';
import { mkdirSync } from 'fs';
import type { CacheEntry } from '$lib/types';

const CACHE_DIR = path.join(process.cwd(), '.cache');
const CACHE_DB = path.join(CACHE_DIR, 'tourmaline.db');
const DEFAULT_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

let db: Database.Database | null = null;

function getDb(): Database.Database {
	if (db) return db;

	mkdirSync(CACHE_DIR, { recursive: true });
	db = new Database(CACHE_DB);
	db.pragma('journal_mode = WAL');

	db.exec(`
		CREATE TABLE IF NOT EXISTS cache (
			key TEXT PRIMARY KEY,
			source TEXT NOT NULL,
			data TEXT NOT NULL,
			created_at INTEGER NOT NULL,
			expires_at INTEGER NOT NULL
		)
	`);

	return db;
}

export function getCached<T>(key: string): T | null {
	const row = getDb()
		.prepare('SELECT data FROM cache WHERE key = ? AND expires_at > ?')
		.get(key, Date.now()) as CacheEntry | undefined;

	if (!row) return null;

	return JSON.parse(row.data) as T;
}

export function setCache<T>(key: string, source: string, data: T, ttl = DEFAULT_TTL): void {
	const now = Date.now();
	getDb()
		.prepare(
			'INSERT OR REPLACE INTO cache (key, source, data, created_at, expires_at) VALUES (?, ?, ?, ?, ?)'
		)
		.run(key, source, JSON.stringify(data), now, now + ttl);
}

export function clearCache(): void {
	getDb().exec('DELETE FROM cache');
}

export function getCacheStats(): { entries: number; sources: Record<string, number> } {
	const db = getDb();
	const count = (
		db.prepare('SELECT COUNT(*) as count FROM cache WHERE expires_at > ?').get(Date.now()) as {
			count: number;
		}
	).count;

	const sources = db
		.prepare('SELECT source, COUNT(*) as count FROM cache WHERE expires_at > ? GROUP BY source')
		.all(Date.now()) as Array<{ source: string; count: number }>;

	return {
		entries: count,
		sources: Object.fromEntries(sources.map((s) => [s.source, s.count]))
	};
}
