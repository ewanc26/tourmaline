import { searchArtist, getReleaseGroupDecade } from '$lib/enrich/musicbrainz';
import { getCached, setCache } from '$lib/enrich/cache';
import type { AggregatedData } from './aggregator';
import type { EraEntry } from '$lib/types';

export async function buildEraProfile(data: AggregatedData): Promise<EraEntry[]> {
	const decadeCounts = new Map<string, number>();

	// Use top albums to estimate era. We need their MusicBrainz release group IDs.
	// Since we don't have album MBIDs from scrobbles in most cases, we skip era
	// analysis for now and rely on artist start year as a proxy.
	// This is a future enhancement — needs album-level MBID data from scrobbles.

	return [...decadeCounts.entries()]
		.map(([decade, count]) => ({ decade, count }))
		.sort((a, b) => a.decade.localeCompare(b.decade));
}
