import { getCached, setCache } from './cache';
import type { ArtistInfo } from '$lib/types';

const BASE_URL = 'https://ws.audioscrobbler.com/2.0/';

let lastRequestTime = 0;

function getApiKey(): string {
	const key = process.env.LASTFM_API_KEY;
	if (!key) throw new Error('LASTFM_API_KEY environment variable is not set');
	return key;
}

async function rateLimitedFetch(url: string): Promise<Response> {
	const now = Date.now();
	const wait = Math.max(0, 250 - (now - lastRequestTime));
	if (wait > 0) await new Promise((r) => setTimeout(r, wait));
	lastRequestTime = Date.now();

	const res = await fetch(url);
	if (res.status === 429) {
		await new Promise((r) => setTimeout(r, 5000));
		return rateLimitedFetch(url);
	}
	if (!res.ok) throw new Error(`Last.fm API error: ${res.status}`);
	return res;
}

interface LFMArtist {
	name: string;
	mbid?: string;
	listeners?: string;
	playcount?: string;
	tags?: { tag: Array<{ name: string; count: string }> };
	similar?: { artist: Array<{ name: string; mbid?: string }> };
	image?: Array<{ '#text': string; size: string }>;
}

export async function getArtistInfo(name: string): Promise<ArtistInfo | null> {
	const cacheKey = `lfm:artist:${name.toLowerCase()}`;
	const cached = getCached<ArtistInfo>(cacheKey);
	if (cached) return cached;

	const params = new URLSearchParams({
		method: 'artist.getinfo',
		artist: name,
		api_key: getApiKey(),
		format: 'json',
	 autocorrect: '1'
	});

	const res = await rateLimitedFetch(`${BASE_URL}?${params}`);
	const data = (await res.json()) as { artist?: LFMArtist };

	if (!data.artist) return null;

	const a = data.artist;
	const info: ArtistInfo = {
		name: a.name,
		mbId: a.mbid || undefined,
		genres: [],
		tags: (a.tags?.tag ?? []).map((t) => t.name),
		similar: (a.similar?.artist ?? []).map((s) => ({
			name: s.name,
			mbId: s.mbid || undefined
		})),
		listenerCount: a.listeners ? parseInt(a.listeners) : undefined,
		playCount: a.playcount ? parseInt(a.playcount) : undefined,
		imageUrl: a.image?.find((i) => i.size === 'large')?.['#text'] || undefined
	};

	setCache(cacheKey, 'lastfm', info);
	return info;
}

export async function getArtistTags(name: string): Promise<string[]> {
	const info = await getArtistInfo(name);
	return info?.tags ?? [];
}

export async function enrichWithLastfm(name: string): Promise<Partial<ArtistInfo> | null> {
	const cacheKey = `lfm:enrich:${name.toLowerCase()}`;
	const cached = getCached<Partial<ArtistInfo>>(cacheKey);
	if (cached) return cached;

	try {
		const info = await getArtistInfo(name);
		if (!info) return null;

		const partial: Partial<ArtistInfo> = {
			tags: info.tags,
			similar: info.similar,
			listenerCount: info.listenerCount,
			playCount: info.playCount,
			imageUrl: info.imageUrl
		};

		setCache(cacheKey, 'lastfm', partial);
		return partial;
	} catch {
		return null;
	}
}
