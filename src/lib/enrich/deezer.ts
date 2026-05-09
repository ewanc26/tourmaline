import { getCached, setCache } from './cache';

interface DeezerArtist {
	name: string;
	imageUrl: string | null;
	genres: string[];
}

const isBrowser = typeof window !== 'undefined';

export async function getArtistImage(name: string): Promise<string | null> {
	const cacheKey = `dz:image:${name.toLowerCase()}`;
	const cached = getCached<string | null>(cacheKey);
	if (cached !== null) return cached;

	if (isBrowser) {
		// Use SvelteKit API proxy to avoid CORS
		const res = await fetch(`/api/deezer/artist?q=${encodeURIComponent(name)}`);
		if (!res.ok) return null;
		const data: DeezerArtist = await res.json();
		const imageUrl = data.imageUrl;
		setCache(cacheKey, 'deezer', imageUrl);
		return imageUrl;
	}

	// Server-side: call Deezer directly
	const url = `https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}`;
	const res = await fetch(url);
	if (!res.ok) return null;

	const data = (await res.json()) as { data?: Array<{ picture_medium?: string }> };
	const imageUrl = data.data?.[0]?.picture_medium ?? null;
	setCache(cacheKey, 'deezer', imageUrl);
	return imageUrl;
}

export async function getArtistGenres(name: string): Promise<string[]> {
	// Genres via Deezer are also blocked by CORS in the browser.
	// This is a secondary source — MusicBrainz genres are preferred.
	if (isBrowser) {
		const res = await fetch(`/api/deezer/artist?q=${encodeURIComponent(name)}`);
		if (!res.ok) return [];
		const data: DeezerArtist = await res.json();
		return data.genres ?? [];
	}

	const url = `https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}`;
	const res = await fetch(url);
	if (!res.ok) return [];

	const data = (await res.json()) as {
		data?: Array<{ id: number }>;
	};
	if (!data.data?.[0]) return [];

	const detailRes = await fetch(`https://api.deezer.com/artist/${data.data[0].id}`);
	if (!detailRes.ok) return [];
	const detail = (await detailRes.json()) as { genres?: { data: Array<{ name: string }> } };
	return detail.genres?.data?.map((g) => g.name) ?? [];
}
