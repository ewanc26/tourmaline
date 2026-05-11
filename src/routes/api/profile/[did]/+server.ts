import { json } from '@sveltejs/kit';
import { getCached, getAllEnrichments } from '$lib/cache/server';
import { Aggregator } from '$lib/analysis/aggregator';
import { buildGenreProfile, buildMonthlyGenres } from '$lib/analysis/genres';
import { buildTimeline } from '$lib/analysis/timeline';
import { diversityScore, calculateGini } from '$lib/analysis/diversity';
import { calculateObscurity } from '$lib/analysis/obscurity';
import { buildMoodProfile } from '$lib/analysis/mood';
import { buildEraProfile } from '$lib/analysis/era';
import { buildRemarkableDays } from '$lib/analysis/remarkable-days';
import { buildDiscoveredArtists } from '$lib/analysis/discovery';
import { buildListeningPhases } from '$lib/analysis/phases';
import { deriveSessions, buildSessionStats } from '$lib/analysis/sessions';
import { buildOnThisDay } from '$lib/analysis/on-this-day';
import { buildStoryRecap } from '$lib/analysis/story-recap';
import { buildPersonality } from '$lib/analysis/personality';
import { presetRange, filterScrobbles, type DateRangePreset } from '$lib/analysis/date-range';
import type { ListenerProfile } from '$lib/types';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url }) => {
	const did = decodeURIComponent(params.did);
	const rangeParam = (url.searchParams.get('range') ?? 'all') as DateRangePreset;

	const row = getCached(did);
	if (!row) {
		return json({ cached: false });
	}

	// Filter scrobbles by date range if requested
	const scrobbles = rangeParam === 'all'
		? row.scrobbles
		: filterScrobbles(row.scrobbles, presetRange(rangeParam));

	// Aggregate
	const aggregator = new Aggregator();
	aggregator.add(scrobbles);
	const data = aggregator.snapshot();

	// Load enrichment data
	const artistInfos = getAllEnrichments();

	// Run all analysis
	const genres = buildGenreProfile(data, artistInfos);
	const timeline = buildTimeline(data);
	const diversity = diversityScore(data);
	const gini = calculateGini(data);
	const obscurity = calculateObscurity(data, artistInfos);
	const mood = buildMoodProfile(data, artistInfos);
	const era = buildEraProfile(data, artistInfos);
	const monthlyGenres = buildMonthlyGenres(data, artistInfos);
	const remarkableDays = buildRemarkableDays(data);
	const discoveredArtists = buildDiscoveredArtists(data, artistInfos);
	const phases = buildListeningPhases(data, monthlyGenres, artistInfos);

	const profile: ListenerProfile = {
		did,
		totalScrobbles: data.totalScrobbles,
		uniqueArtists: data.uniqueArtists,
		uniqueTracks: data.uniqueTracks,
		totalMinutes: data.totalMinutes,
		topArtists: data.topArtists.map((a) => ({
			...a,
			imageUrl: artistInfos.get(a.name)?.imageUrl
		})),
		topTracks: data.topTracks,
		topAlbums: data.topAlbums,
		genres,
		timeline,
		dailyScrobbles: [...data.dailyScrobbles.entries()]
			.map(([date, count]) => ({ date, count }))
			.sort((a, b) => a.date.localeCompare(b.date)),
		era,
		diversityScore: diversity,
		giniCoefficient: gini,
		obscurityIndex: obscurity,
		mood,
		scrobblesByHour: data.scrobblesByHour,
		serviceOrigins: Object.fromEntries(data.serviceOrigins),
		monthlyGenres,
		remarkableDays,
		discoveredArtists,
		phases
	};

	// Derive extra data that the client previously computed inline
	const sessions = deriveSessions(scrobbles);
	const sessionStats = buildSessionStats(sessions);
	const onThisDayEntries = buildOnThisDay(scrobbles);
	const storyRecap = buildStoryRecap(profile, '', phases);
	const personality = buildPersonality(profile);

	return json({
		cached: true,
		profile,
		sessionStats,
		onThisDay: onThisDayEntries,
		storyRecap,
		personality
	});
};
