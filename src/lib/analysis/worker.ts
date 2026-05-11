import { Aggregator } from './aggregator';
import { buildGenreProfile, buildMonthlyGenres } from './genres';
import { buildTimeline } from './timeline';
import { diversityScore, calculateGini } from './diversity';
import { calculateObscurity } from './obscurity';
import { buildMoodProfile } from './mood';
import { buildEraProfile } from './era';
import { buildRemarkableDays } from './remarkable-days';
import { buildDiscoveredArtists } from './discovery';
import { buildListeningPhases } from './phases';
import { deriveSessions, buildSessionStats } from './sessions';
import { buildOnThisDay } from './on-this-day';
import { buildStoryRecap } from './story-recap';
import { buildPersonality } from './personality';
import { presetRange, filterScrobbles, type DateRangePreset } from './date-range';
import type { ArtistInfo, ListenerProfile, TealScrobble } from '$lib/types';

interface WorkerInput {
	scrobbles: TealScrobble[];
	enrichment?: Record<string, ArtistInfo>;
	range: DateRangePreset;
	did: string;
	handle?: string;
}

interface WorkerOutput {
	profile: ListenerProfile;
	sessionStats: ReturnType<typeof buildSessionStats>;
	onThisDay: ReturnType<typeof buildOnThisDay>;
	storyRecap: ReturnType<typeof buildStoryRecap>;
	personality: ReturnType<typeof buildPersonality>;
}

self.onmessage = (e: MessageEvent<WorkerInput>) => {
	const { scrobbles, enrichment, range, did, handle } = e.data;

	// Filter by date range
	const filtered = range === 'all'
		? scrobbles
		: filterScrobbles(scrobbles, presetRange(range));

	// Aggregate
	const aggregator = new Aggregator();
	aggregator.add(filtered);
	const data = aggregator.snapshot();

	// Build artist info map from enrichment
	const artistInfos = new Map<string, ArtistInfo>();
	if (enrichment) {
		for (const [name, info] of Object.entries(enrichment)) {
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

	// Derive extra data
	const sessions = deriveSessions(filtered);
	const sessionStats = buildSessionStats(sessions);
	const onThisDayEntries = buildOnThisDay(filtered);
	const storyRecap = buildStoryRecap(profile, '', phases);
	const personality = buildPersonality(profile);

	const output: WorkerOutput = {
		profile,
		sessionStats,
		onThisDay: onThisDayEntries,
		storyRecap,
		personality
	};

	self.postMessage(output);
};
