import type { AggregatedData } from './aggregator';

/**
 * Shannon entropy measures how uniform the distribution is.
 * Higher = more diverse taste. Lower = concentrated on fewer artists.
 * Range: 0 (all plays go to one artist) to ln(N) (perfectly uniform across N artists).
 */
export function calculateDiversity(data: AggregatedData): number {
	const total = data.totalScrobbles;
	if (total === 0) return 0;

	let entropy = 0;
	for (const count of data.artistPlayCounts.values()) {
		if (count === 0) continue;
		const p = count / total;
		entropy -= p * Math.log(p);
	}

	// Normalise to 0-100 scale
	// Max entropy is ln(uniqueArtists). Normalise against that.
	const maxEntropy = Math.log(data.uniqueArtists);
	if (maxEntropy === 0) return 0;

	return Math.round((entropy / maxEntropy) * 100);
}

/**
 * Gini coefficient — measures inequality.
 * 0 = perfectly equal distribution, 1 = all plays go to one artist.
 * Lower = more diverse.
 */
export function calculateGini(data: AggregatedData): number {
	const counts = [...data.artistPlayCounts.values()].sort((a, b) => a - b);
	const n = counts.length;
	if (n === 0) return 0;

	let sumOfAbsDiffs = 0;
	for (let i = 0; i < n; i++) {
		for (let j = 0; j < n; j++) {
			sumOfAbsDiffs += Math.abs(counts[i] - counts[j]);
		}
	}

	const mean = counts.reduce((a, b) => a + b, 0) / n;
	if (mean === 0) return 0;

	return sumOfAbsDiffs / (2 * n * n * mean);
}

/**
 * Combine diversity metrics into a single score.
 * Returns 0-100 where 100 = maximally diverse.
 */
export function diversityScore(data: AggregatedData): number {
	const shannon = calculateDiversity(data);
	const gini = calculateGini(data);

	// Shannon is already 0-100 (higher = more diverse)
	// Gini is 0-1 (lower = more diverse), invert and scale
	const giniInverted = (1 - gini) * 100;

	// Weight Shannon more (it's more informative)
	return Math.round(shannon * 0.7 + giniInverted * 0.3);
}
