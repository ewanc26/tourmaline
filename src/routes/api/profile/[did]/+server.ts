import { json } from '@sveltejs/kit';
import { getSession, updateSession } from '$lib/server/session';
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
import { filterScrobbles, presetRange, type DateRangePreset } from '$lib/analysis/date-range';
import type { ListenerProfile, TealScrobble, ArtistInfo } from '$lib/types';
import type { RequestHandler } from './$types';

type RangeKey = 'all' | '7d' | '30d' | '90d' | '365d';
const RANGES: RangeKey[] = ['all', '7d', '30d', '90d', '365d'];

function computeProfile(
	did: string,
	scrobbles: TealScrobble[],
	range: RangeKey,
	artistInfos: Map<string, ArtistInfo>,
	handle?: string
): {
	profile: ListenerProfile;
	sessionStats: ReturnType<typeof buildSessionStats>;
	onThisDay: ReturnType<typeof buildOnThisDay>;
	storyRecap: ReturnType<typeof buildStoryRecap>;
	personality: ReturnType<typeof buildPersonality>;
} {
	const filtered = range === 'all'
		? scrobbles
		: filterScrobbles(scrobbles, presetRange(range));

	const aggregator = new Aggregator();
	aggregator.add(filtered);
	const data = aggregator.snapshot();

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
		handle,
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

	const sessions = deriveSessions(filtered);
	const sessionStats = buildSessionStats(sessions);
	const onThisDay = buildOnThisDay(filtered);
	const storyRecap = buildStoryRecap(profile, '', phases);
	const personality = buildPersonality(profile);

	return { profile, sessionStats, onThisDay, storyRecap, personality };
}

export const GET: RequestHandler = async ({ params, url }) => {
	const did = decodeURIComponent(params.did);
	const session = getSession(did);

	if (!session) {
		return json({ error: 'No session found. Call /api/resolve first.' }, { status: 400 });
	}

	if (!session.fetchDone) {
		return json({ error: 'Scrobbles not fully fetched yet.' }, { status: 400 });
	}

	// Compute profiles for ALL date ranges in one pass
	const profiles: Record<string, ListenerProfile> = {};
	let sessionStats = session.sessionStats;
	let onThisDay = session.onThisDay;
	let storyRecap = session.storyRecap;
	let personality = session.personality;

	for (const range of RANGES) {
		if (session.profiles.has(range)) {
			profiles[range] = session.profiles.get(range)!;
			continue;
		}

		const result = computeProfile(did, session.scrobbles, range, session.enrichment, session.handle);
		profiles[range] = result.profile;

		// Store the "all" range's extra data on the session
		if (range === 'all') {
			sessionStats = result.sessionStats;
			onThisDay = result.onThisDay;
			storyRecap = result.storyRecap;
			personality = result.personality;
		}
	}

	// Cache all profiles on the session
	for (const [range, profile] of Object.entries(profiles)) {
		session.profiles.set(range, profile);
	}

	updateSession(did, {
		profiles: session.profiles,
		sessionStats,
		onThisDay,
		storyRecap,
		personality
	});

	return json({
		profiles,
		sessionStats,
		onThisDay,
		storyRecap,
		personality,
		enrichmentDone: session.enrichQueue.length === 0
	});
};
