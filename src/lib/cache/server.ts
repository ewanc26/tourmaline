import Database from 'better-sqlite3';
import { gzipSync, gunzipSync } from 'node:zlib';
import path from 'path';
import { fileURLToPath } from 'url';
import type { ArtistInfo, TealScrobble } from '$lib/types';

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
	db.exec(`
		CREATE TABLE IF NOT EXISTS artist_enrichment (
			name TEXT PRIMARY KEY,
			data BLOB NOT NULL
		)
	`);

	return db;
}

// ── Scrobble cache ──────────────────────────────────────────────────

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

// ── Artist enrichment cache ─────────────────────────────────────────

export function getEnrichment(name: string): ArtistInfo | null {
	const row = getDb()
		.prepare('SELECT data FROM artist_enrichment WHERE name = ?')
		.get(name) as { data: Buffer } | undefined;

	if (!row) return null;

	const json = row.data instanceof Buffer
		? gunzipSync(row.data).toString('utf-8')
		: row.data as unknown as string;

	return JSON.parse(json) as ArtistInfo;
}

export function setEnrichment(name: string, info: ArtistInfo): void {
	const compressed = gzipSync(Buffer.from(JSON.stringify(info), 'utf-8'));

	const stmt = getDb().prepare(`
		INSERT INTO artist_enrichment (name, data)
		VALUES (?, ?)
		ON CONFLICT(name) DO UPDATE SET
			data = excluded.data
	`);

	stmt.run(name, compressed);
}

export function setEnrichmentBatch(entries: Array<{ name: string; data: ArtistInfo }>): void {
	const stmt = getDb().prepare(`
		INSERT INTO artist_enrichment (name, data)
		VALUES (?, ?)
		ON CONFLICT(name) DO UPDATE SET
			data = excluded.data
	`);

	const insertMany = getDb().transaction((items: Array<{ name: string; data: ArtistInfo }>) => {
		for (const { name, data } of items) {
			const compressed = gzipSync(Buffer.from(JSON.stringify(data), 'utf-8'));
			stmt.run(name, compressed);
		}
	});

	insertMany(entries);
}

export function getAllEnrichments(): Map<string, ArtistInfo> {
	const rows = getDb()
		.prepare('SELECT name, data FROM artist_enrichment')
		.all() as Array<{ name: string; data: Buffer }>;

	const result = new Map<string, ArtistInfo>();

	for (const row of rows) {
		const json = row.data instanceof Buffer
			? gunzipSync(row.data).toString('utf-8')
			: row.data as unknown as string;
		result.set(row.name, JSON.parse(json) as ArtistInfo);
	}

	return result;
}
