import { getCached, setCache } from './cache';

interface DeezerArtist {
	id: number;
	name: string;
	picture_medium?: string;
	nb_fan?: number;
	type: 'artist';
}

interface DeezerSearchResult {
	data: Array<DeezerArtist>;
	total: number;
}

/**
 * JSONP helper for Deezer API (CORS-free from browser).
 * Deezer supports JSONP via output=jsonp&callback=... — this bypasses
 * CORS restrictions entirely since JSONP loads via script tags.
 */
function jsonp<T>(url: string): Promise<T> {
	return new Promise((resolve, reject) => {
		const callbackName = `__dz_${Date.now()}_${Math.random().toString(36).slice(2)}`;

		const timeout = setTimeout(() => {
			cleanup();
			reject(new Error('Deezer JSONP timeout'));
		}, 10000);

		function cleanup() {
			clearTimeout(timeout);
			delete (window as unknown as Record<string, unknown>)[callbackName];
			script.remove();
		}

		(window as unknown as Record<string, (...args: unknown[]) => void>)[callbackName] = (
			data: unknown
		) => {
			cleanup();
			resolve(data as T);
		};

		const script = document.createElement('script');
		const separator = url.includes('?') ? '&' : '?';
		script.src = `${url}${separator}output=jsonp&callback=${callbackName}`;
		script.onerror = () => {
			cleanup();
			reject(new Error('Deezer JSONP script error'));
		};
		document.head.appendChild(script);
	});
}

export async function searchArtist(name: string): Promise<DeezerArtist | null> {
	const cacheKey = `dz:search:${name.toLowerCase()}`;
	const cached = getCached<DeezerArtist | null>(cacheKey);
	if (cached.hit) return cached.value;

	try {
		const url = `https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}`;
		const data = await jsonp<DeezerSearchResult>(url);
		const match = data.data?.[0] ?? null;

		setCache(cacheKey, 'deezer', match);
		return match;
	} catch {
		return null;
	}
}

export async function getArtistImage(name: string): Promise<string | null> {
	const cacheKey = `dz:image:${name.toLowerCase()}`;
	const cached = getCached<string | null>(cacheKey);
	if (cached.hit) return cached.value;

	const artist = await searchArtist(name);
	const imageUrl = artist?.picture_medium ?? null;

	setCache(cacheKey, 'deezer', imageUrl);
	return imageUrl;
}

export async function getArtistGenres(name: string): Promise<string[]> {
	// Deezer genre data requires a second API call to the artist endpoint.
	// This is a secondary source — MusicBrainz genres are preferred.
	const artist = await searchArtist(name);
	if (!artist) return [];

	try {
		const data = await jsonp<{ genres?: { data: Array<{ name: string }> } }>(
			`https://api.deezer.com/artist/${artist.id}`
		);
		return data.genres?.data?.map((g) => g.name) ?? [];
	} catch {
		return [];
	}
}
