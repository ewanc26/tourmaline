import { getCached, setCache } from './cache';
import type { ArtistInfo } from '$lib/types';

const BASE_URL = 'https://musicbrainz.org/ws/2';
const USER_AGENT = 'Tourmaline/0.1.0 (https://github.com/ewanc26/tourmaline)';

let lastRequestTime = 0;

async function rateLimitedFetch(url: string): Promise<Response> {
	const now = Date.now();
	const wait = Math.max(0, 1100 - (now - lastRequestTime));
	if (wait > 0) await new Promise((r) => setTimeout(r, wait));
	lastRequestTime = Date.now();

	const res = await fetch(url, {
		headers: {
			'User-Agent': USER_AGENT,
			Accept: 'application/json'
		}
	});

	if (!res.ok) throw new Error(`MusicBrainz API error: ${res.status}`);
	return res;
}

interface MBArtist {
	id: string;
	name: string;
	tags?: Array<{ name: string; count: number }>;
	genres?: Array<{ name: string; count: number }>;
	rating?: { value?: number };
}

interface MBReleaseGroup {
	id: string;
	title: string;
	'first-release-date'?: string;
	'primary-type'?: string;
	genres?: Array<{ name: string; count: number }>;
}

interface MBSearchResult {
	artists: Array<{ id: string; name: string; score: number }>;
}

export async function searchArtist(name: string): Promise<string | null> {
	const cacheKey = `mb:search:${name.toLowerCase()}`;
	const cached = getCached<string>(cacheKey);
	if (cached !== null) return cached;

	const url = `${BASE_URL}/artist?query=artist:${encodeURIComponent(name)}&limit=1&fmt=json`;
	const res = await rateLimitedFetch(url);
	const data: MBSearchResult = await res.json();

	const match = data.artists?.[0]?.id ?? null;
	setCache(cacheKey, 'musicbrainz', match);
	return match;
}

export async function getArtistInfo(mbId: string): Promise<ArtistInfo | null> {
	const cacheKey = `mb:artist:${mbId}`;
	const cached = getCached<ArtistInfo>(cacheKey);
	if (cached) return cached;

	const url = `${BASE_URL}/artist/${mbId}?inc=tags+genres+ratings&fmt=json`;
	const res = await rateLimitedFetch(url);
	const data: MBArtist = await res.json();

	const info: ArtistInfo = {
		name: data.name,
		mbId: data.id,
		genres: (data.genres ?? []).sort((a, b) => b.count - a.count).map((g) => g.name),
		tags: (data.tags ?? []).sort((a, b) => b.count - a.count).map((t) => t.name),
		similar: [],
		listenerCount: undefined,
		playCount: undefined
	};

	setCache(cacheKey, 'musicbrainz', info);
	return info;
}

export async function getReleaseGroupDecade(mbId: string): Promise<string | null> {
	const cacheKey = `mb:release-group:${mbId}`;
	const cached = getCached<string>(cacheKey);
	if (cached !== null) return cached;

	const url = `${BASE_URL}/release-group/${mbId}?inc=&fmt=json`;
	const res = await rateLimitedFetch(url);
	const data: MBReleaseGroup = await res.json();

	const date = data['first-release-date'];
	const decade = date ? `${date.substring(0, 3)}0s` : null;

	setCache(cacheKey, 'musicbrainz', decade);
	return decade;
}

export async function enrichArtist(name: string, mbId?: string): Promise<ArtistInfo | null> {
	const resolvedMbId = mbId ?? (await searchArtist(name));
	if (!resolvedMbId) return null;
	return getArtistInfo(resolvedMbId);
}
