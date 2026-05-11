import Database from 'better-sqlite3';
import { gzipSync, gunzipSync } from 'node:zlib';
import path from 'path';
import { fileURLToPath } from 'url';
import type { TealScrobble } from '$lib/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, '../../../../tourmaline.db');

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface ScrobbleCacheRow {
	did: string;
	cursor: string;
	scrobbles: TealScrobble[];
	fetchedAt: number;
}

let db: Database.Database | null = null;

function getDb(): Database.Database {
	if (db) return db;

	db = new Database(DB_PATH);
	db.pragma('journal_mode = WAL');
	db.exec(`
		CREATE TABLE IF NOT EXISTS scrobble_cache (
			did TEXT PRIMARY KEY,
			cursor TEXT NOT NULL,
			scrobbles BLOB NOT NULL,
			fetched_at INTEGER NOT NULL
		)
	`);

	return db;
}

export function getCached(did: string): ScrobbleCacheRow | null {
	const row = getDb()
		.prepare('SELECT cursor, scrobbles, fetched_at FROM scrobble_cache WHERE did = ?')
		.get(did) as { cursor: string; scrobbles: Buffer; fetched_at: number } | undefined;

	if (!row) return null;

	const json = row.scrobbles instanceof Buffer
		? gunzipSync(row.scrobbles).toString('utf-8')
		: row.scrobbles as unknown as string; // fallback for old uncompressed rows

	return {
		did,
		cursor: row.cursor,
		scrobbles: JSON.parse(json),
		fetchedAt: row.fetched_at
	};
}

export function setCached(did: string, cursor: string, scrobbles: TealScrobble[]): void {
	const compressed = gzipSync(Buffer.from(JSON.stringify(scrobbles), 'utf-8'));

	const stmt = getDb().prepare(`
		INSERT INTO scrobble_cache (did, cursor, scrobbles, fetched_at)
		VALUES (?, ?, ?, ?)
		ON CONFLICT(did) DO UPDATE SET
			cursor = excluded.cursor,
			scrobbles = excluded.scrobbles,
			fetched_at = excluded.fetched_at
	`);

	stmt.run(did, cursor, compressed, Date.now());
}

export function isStale(row: ScrobbleCacheRow): boolean {
	return Date.now() - row.fetchedAt > ONE_WEEK_MS;
}
