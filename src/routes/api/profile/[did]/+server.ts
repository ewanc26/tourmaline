import { json } from '@sveltejs/kit';
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
import type { ArtistInfo, ListenerProfile, TealScrobble } from '$lib/types';
import type { RequestHandler } from './$types';

/**
 * POST: Compute a full listener profile from scrobbles sent in the request body.
 * This is the primary path — no persistent server cache needed.
 */
export const POST: RequestHandler = async ({ params, request, url }) => {
	const did = decodeURIComponent(params.did);
	const rangeParam = (url.searchParams.get('range') ?? 'all') as DateRangePreset;

	const body = await request.json() as {
		scrobbles?: TealScrobble[];
		enrichment?: Record<string, ArtistInfo>;
	};

	if (!body.scrobbles || body.scrobbles.length === 0) {
		return json({ error: 'scrobbles required' }, { status: 400 });
	}

	// Filter scrobbles by date range if requested
	const scrobbles = rangeParam === 'all'
		? body.scrobbles
		: filterScrobbles(body.scrobbles, presetRange(rangeParam));

	// Aggregate
	const aggregator = new Aggregator();
	aggregator.add(scrobbles);
	const data = aggregator.snapshot();

	// Build artist info map from enrichment data
	const artistInfos = new Map<string, ArtistInfo>();
	if (body.enrichment) {
		for (const [name, info] of Object.entries(body.enrichment)) {
			artistInfos.set(name, info);
		}
	}

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

	// Derive extra data
	const sessions = deriveSessions(scrobbles);
	const sessionStats = buildSessionStats(sessions);
	const onThisDayEntries = buildOnThisDay(scrobbles);
	const storyRecap = buildStoryRecap(profile, '', phases);
	const personality = buildPersonality(profile);

	return json({
		profile,
		sessionStats,
		onThisDay: onThisDayEntries,
		storyRecap,
		personality
	});
};
