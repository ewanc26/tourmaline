import type { TealScrobble } from '$lib/types';

const DB_NAME = 'tourmaline';
const STORE_NAME = 'scrobbles';
const DB_VERSION = 1;

export interface ScrobbleCache {
	cursor: string;
	scrobbles: TealScrobble[];
	fetchedAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
	if (dbPromise) return dbPromise;

	dbPromise = new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME);
			}
		};

		request.onsuccess = () => resolve(request.result);
		request.onerror = () => {
			dbPromise = null;
			reject(request.error);
		};
	});

	return dbPromise;
}

export async function getCached(did: string): Promise<ScrobbleCache | null> {
	try {
		const db = await openDb();
		const tx = db.transaction(STORE_NAME, 'readonly');
		const store = tx.objectStore(STORE_NAME);
		const request = store.get(did);

		return new Promise((resolve, reject) => {
			request.onsuccess = () => {
				resolve(request.result ?? null);
			};
			request.onerror = () => reject(request.error);
		});
	} catch {
		return null;
	}
}

export async function setCached(did: string, data: ScrobbleCache): Promise<void> {
	try {
		const db = await openDb();
		const tx = db.transaction(STORE_NAME, 'readwrite');
		const store = tx.objectStore(STORE_NAME);
		store.put(data, did);

		return new Promise((resolve, reject) => {
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
		});
	} catch {
		// IndexedDB write failures are non-critical
	}
}

export async function removeCached(did: string): Promise<void> {
	try {
		const db = await openDb();
		const tx = db.transaction(STORE_NAME, 'readwrite');
		const store = tx.objectStore(STORE_NAME);
		store.delete(did);

		return new Promise((resolve, reject) => {
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
		});
	} catch {
		// non-critical
	}
}
