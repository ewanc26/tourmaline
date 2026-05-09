import type { ArtistInfo } from '$lib/types';
import type { AggregatedData } from './aggregator';

/**
 * Obscurity index: ratio of niche artists to mainstream.
 * Uses Last.fm listener counts as a proxy for popularity.
 * Returns 0-100 where 100 = all artists are obscure.
 */
export function calculateObscurity(
	data: AggregatedData,
	artistInfos: Map<string, ArtistInfo>
): number {
	let totalWeight = 0;
	let totalObscurityWeight = 0;

	for (const { name, count } of data.topArtists) {
		const info = artistInfos.get(name);
		if (!info?.listenerCount) continue;

		// Logarithmic scale: more listeners = less obscure
		const listeners = info.listenerCount;
		const logListeners = Math.log10(listeners);

		// Most popular artists have ~10M listeners (log10 = 7)
		// Niche artists might have ~100 listeners (log10 = 2)
		// Normalise to 0-1 range where 0 = most popular, 1 = most obscure
		const obscurity = Math.max(0, Math.min(1, 1 - (logListeners - 1) / 7));

		totalWeight += count;
		totalObscurityWeight += obscurity * count;
	}

	if (totalWeight === 0) return 50;

	return Math.round((totalObscurityWeight / totalWeight) * 100);
}

export function getObscurityLabel(index: number): string {
	if (index >= 80) return 'Deep cuts';
	if (index >= 60) return 'Underground';
	if (index >= 40) return 'Eclectic';
	if (index >= 20) return 'Mainstream';
	return 'Top 40';
}
