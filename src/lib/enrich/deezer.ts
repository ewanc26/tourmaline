import { getCached, setCache } from './cache';

const BASE_URL = 'https://api.deezer.com';

interface DeezerArtist {
	id: number;
	name: string;
	picture_medium?: string;
	nb_fan?: number;
	type: 'artist';
}

interface DeezerSearchResult {
	data: Array<DeezerArtist>;
}

interface DeezerGenre {
	id: number;
	name: string;
	picture?: string;
}

export async function searchArtist(name: string): Promise<DeezerArtist | null> {
	const cacheKey = `dz:search:${name.toLowerCase()}`;
	const cached = getCached<DeezerArtist>(cacheKey);
	if (cached !== null) return cached;

	const url = `${BASE_URL}/search/artist?q=${encodeURIComponent(name)}`;
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Deezer API error: ${res.status}`);

	const data: DeezerSearchResult = await res.json();
	const match = data.data?.[0] ?? null;

	setCache(cacheKey, 'deezer', match);
	return match;
}

export async function getArtistGenres(deezerId: number): Promise<string[]> {
	const cacheKey = `dz:genres:${deezerId}`;
	const cached = getCached<string[]>(cacheKey);
	if (cached) return cached;

	const url = `${BASE_URL}/artist/${deezerId}`;
	const res = await fetch(url);
	if (!res.ok) return [];

	const data = (await res.json()) as DeezerArtist & { genres?: { data: DeezerGenre[] } };
	const genres = data.genres?.data?.map((g) => g.name) ?? [];

	setCache(cacheKey, 'deezer', genres);
	return genres;
}

export async function getArtistImage(name: string): Promise<string | null> {
	const artist = await searchArtist(name);
	return artist?.picture_medium ?? null;
}
