import { resolveIdentifier, fetchScrobbles } from '$lib/atproto/resolve';
import { enrichArtist } from '$lib/enrich/musicbrainz';
import { enrichWithLastfm } from '$lib/enrich/lastfm';
import { getArtistImage } from '$lib/enrich/deezer';
import { aggregate } from '$lib/analysis/aggregator';
import { buildGenreProfile } from '$lib/analysis/genres';
import { buildTimeline } from '$lib/analysis/timeline';
import { buildEraProfile } from '$lib/analysis/era';
import { diversityScore } from '$lib/analysis/diversity';
import { calculateObscurity } from '$lib/analysis/obscurity';
import { buildMoodProfile } from '$lib/analysis/mood';
import type { ArtistInfo, ListenerProfile, TealScrobble } from '$lib/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, setHeaders }) => {
	const identifier = decodeURIComponent(params.did);

	setHeaders({
		'Cache-Control': 'no-cache'
	});

	// 1. Resolve identifier (DID or handle) via Slingshot
	const { did, pdsUrl, handle } = await resolveIdentifier(identifier);

	// 2. Fetch scrobbles
	const scrobbles: TealScrobble[] = [];
	for await (const scrobble of fetchScrobbles(pdsUrl, did)) {
		scrobbles.push(scrobble);
	}

	if (scrobbles.length === 0) {
		return {
			profile: {
				did,
				handle,
				totalScrobbles: 0,
				uniqueArtists: 0,
				uniqueTracks: 0,
				topArtists: [],
				topTracks: [],
				topAlbums: [],
				genres: [],
				timeline: [],
				era: [],
				diversityScore: 0,
				obscurityIndex: 50,
				mood: {}
			} satisfies ListenerProfile
		};
	}

	// 3. Aggregate
	const data = aggregate(scrobbles);

	// 4. Enrich artists (top 50)
	const artistInfos = new Map<string, ArtistInfo>();

	for (const { name } of data.topArtists) {
		if (artistInfos.has(name)) continue;

		let info: ArtistInfo | null = null;

		// Try MusicBrainz first
		try {
			info = await enrichArtist(name);
		} catch {
			// MusicBrainz failed, continue
		}

		// Enrich with Last.fm
		if (process.env.LASTFM_API_KEY) {
			try {
				const lfmData = await enrichWithLastfm(name);
				if (lfmData && info) {
					info = { ...info, ...lfmData };
				} else if (lfmData) {
					info = {
						name,
						genres: [],
						tags: lfmData.tags ?? [],
						similar: lfmData.similar ?? [],
						listenerCount: lfmData.listenerCount,
						playCount: lfmData.playCount,
						imageUrl: lfmData.imageUrl
					};
				}
			} catch {
				// Last.fm failed, continue
			}
		}

		// Try Deezer for image if we still don't have one
		if (info && !info.imageUrl) {
			try {
				const imageUrl = await getArtistImage(name);
				if (imageUrl) info.imageUrl = imageUrl;
			} catch {
				// Deezer failed, continue
			}
		}

		if (info) {
			artistInfos.set(name, info);
		}
	}

	// 5. Build profile
	const genres = buildGenreProfile(data, artistInfos);
	const timeline = buildTimeline(data);
	const era = await buildEraProfile(data);
	const diversity = diversityScore(data);
	const obscurity = calculateObscurity(data, artistInfos);
	const mood = buildMoodProfile(data, artistInfos);

	// Add images to top artists
	const topArtists = data.topArtists.map((a) => ({
		...a,
		imageUrl: artistInfos.get(a.name)?.imageUrl
	}));

	const profile: ListenerProfile = {
		did,
		handle,
		totalScrobbles: data.totalScrobbles,
		uniqueArtists: data.uniqueArtists,
		uniqueTracks: data.uniqueTracks,
		topArtists,
		topTracks: data.topTracks,
		topAlbums: data.topAlbums,
		genres,
		timeline,
		era,
		diversityScore: diversity,
		obscurityIndex: obscurity,
		mood
	};

	return { profile };
};
