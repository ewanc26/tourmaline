import { getCached, setCache } from './cache';
import type { ArtistInfo } from '$lib/types';

const USER_AGENT = 'Tourmaline/0.3.0 (https://github.com/ewanc26/tourmaline)';

// Rate limiting is handled server-side by the /api/musicbrainz proxy.
// Client just fires requests — the server queues them at 1 req/s.

interface MBArtist {
	id: string;
	name: string;
	tags?: Array<{ name: string; count: number }>;
	genres?: Array<{ name: string; count: number }>;
	rating?: { value?: number };
	'life-span'?: { begin?: string; end?: string; ended?: boolean };
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

	const path = `/artist?query=artist:${encodeURIComponent(name)}&limit=1&fmt=json&client=${encodeURIComponent(USER_AGENT)}`;
	const res = await fetch(`/api/musicbrainz${path}`);
	if (!res.ok) throw new Error(`MusicBrainz API error: ${res.status}`);

	const data: MBSearchResult = await res.json();
	const match = data.artists?.[0]?.id ?? null;
	setCache(cacheKey, 'musicbrainz', match);
	return match;
}

export async function getArtistInfo(mbId: string): Promise<ArtistInfo | null> {
	const cacheKey = `mb:artist:${mbId}`;
	const cached = getCached<ArtistInfo>(cacheKey);
	if (cached) return cached;

	const path = `/artist/${mbId}?inc=tags+genres+ratings&fmt=json&client=${encodeURIComponent(USER_AGENT)}`;
	const res = await fetch(`/api/musicbrainz${path}`);
	if (!res.ok) throw new Error(`MusicBrainz API error: ${res.status}`);

	const data: MBArtist = await res.json();
	const beginDate = data['life-span']?.begin;
	const startYear = beginDate ? parseInt(beginDate.substring(0, 4), 10) : undefined;
	const info: ArtistInfo = {
		name: data.name,
		mbId: data.id,
		genres: (data.genres ?? []).sort((a, b) => b.count - a.count).map((g) => g.name),
		tags: (data.tags ?? []).sort((a, b) => b.count - a.count).map((t) => t.name),
		similar: [],
		listenerCount: undefined,
		playCount: undefined,
		startYear: isNaN(startYear!) ? undefined : startYear
	};

	setCache(cacheKey, 'musicbrainz', info);
	return info;
}

export async function getReleaseGroupDecade(mbId: string): Promise<string | null> {
	const cacheKey = `mb:release-group:${mbId}`;
	const cached = getCached<string>(cacheKey);
	if (cached !== null) return cached;

	const path = `/release-group/${mbId}?inc=&fmt=json&client=${encodeURIComponent(USER_AGENT)}`;
	const res = await fetch(`/api/musicbrainz${path}`);
	if (!res.ok) throw new Error(`MusicBrainz API error: ${res.status}`);

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
