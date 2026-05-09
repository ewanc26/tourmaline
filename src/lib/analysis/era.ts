import { enrichArtist } from '$lib/enrich/musicbrainz';
import { getCached, setCache } from '$lib/enrich/cache';
import type { AggregatedData } from './aggregator';
import type { EraEntry } from '$lib/types';

export async function buildEraProfile(data: AggregatedData): Promise<EraEntry[]> {
	const decadeCounts = new Map<string, number>();

	// Use top albums (which have release info) to estimate era
	for (const album of data.topAlbums.slice(0, 50)) {
		const cacheKey = `era:album:${album.name.toLowerCase()}|||${album.artist.toLowerCase()}`;
		const cached = getCached<string>(cacheKey);

		if (cached) {
			if (cached !== 'unknown') {
				decadeCounts.set(cached, (decadeCounts.get(cached) ?? 0) + album.count);
			}
			continue;
		}

		// Try to find release via MusicBrainz search
		try {
			const mbRes = await fetch(
				`https://musicbrainz.org/ws/2/release-group?query=releasegroup:${encodeURIComponent(album.name)}%20AND%20artist:${encodeURIComponent(album.artist)}&limit=1&fmt=json`,
				{ headers: { 'User-Agent': 'Tourmaline/0.1.0 (https://github.com/ewanc26/tourmaline)' } }
			);

			if (mbRes.ok) {
				const mbData = (await mbRes.json()) as {
					'release-groups'?: Array<{ id: string; 'first-release-date'?: string }>;
				};
				const rg = mbData['release-groups']?.[0];
				if (rg?.['first-release-date']) {
					const decade = `${rg['first-release-date'].substring(0, 3)}0s`;
					setCache(cacheKey, 'musicbrainz', decade);
					decadeCounts.set(decade, (decadeCounts.get(decade) ?? 0) + album.count);

					// Rate limit MusicBrainz
					await new Promise((r) => setTimeout(r, 1100));
					continue;
				}
			}
		} catch {
			// MusicBrainz lookup failed, skip
		}

		setCache(cacheKey, 'musicbrainz', 'unknown');

		// Rate limit
		await new Promise((r) => setTimeout(r, 1100));
	}

	return [...decadeCounts.entries()]
		.map(([decade, count]) => ({ decade, count }))
		.sort((a, b) => a.decade.localeCompare(b.decade));
}
