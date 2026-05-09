import type { TealScrobble } from '$lib/types';

export interface AggregatedData {
	totalScrobbles: number;
	uniqueArtists: number;
	uniqueTracks: number;
	topArtists: Array<{ name: string; count: number }>;
	topTracks: Array<{ name: string; artist: string; count: number }>;
	topAlbums: Array<{ name: string; artist: string; count: number }>;
	artistPlayCounts: Map<string, number>;
	trackPlayCounts: Map<string, number>;
	albumPlayCounts: Map<string, { name: string; artist: string; count: number }>;
	scrobblesByHour: number[];
	scrobblesByDay: number[];
	scrobblesByHourDay: number[][];
	serviceOrigins: Map<string, number>;
}

const TRACK_KEY = (s: TealScrobble) =>
	`${s.trackName}|||${s.artists.map((a) => a.name).join(',')}`;
const ALBUM_KEY = (s: TealScrobble) =>
	s.releaseName ? `${s.releaseName}|||${s.artists.map((a) => a.name).join(',')}` : null;

export function aggregate(scrobbles: TealScrobble[]): AggregatedData {
	const artistCounts = new Map<string, number>();
	const trackCounts = new Map<string, { name: string; artist: string; count: number }>();
	const albumCounts = new Map<string, { name: string; artist: string; count: number }>();
	const serviceOrigins = new Map<string, number>();

	const byHour = new Array(24).fill(0);
	const byDay = new Array(7).fill(0);
	const byHourDay = Array.from({ length: 7 }, () => new Array(24).fill(0));

	for (const scrobble of scrobbles) {
		// Artist counts
		const artistName = scrobble.artists[0]?.name ?? 'Unknown';
		artistCounts.set(artistName, (artistCounts.get(artistName) ?? 0) + 1);

		// Track counts
		const trackKey = TRACK_KEY(scrobble);
		const existing = trackCounts.get(trackKey);
		if (existing) {
			existing.count++;
		} else {
			trackCounts.set(trackKey, {
				name: scrobble.trackName,
				artist: artistName,
				count: 1
			});
		}

		// Album counts
		const albumKey = ALBUM_KEY(scrobble);
		if (albumKey) {
			const albumExisting = albumCounts.get(albumKey);
			if (albumExisting) {
				albumExisting.count++;
			} else {
				albumCounts.set(albumKey, {
					name: scrobble.releaseName!,
					artist: artistName,
					count: 1
				});
			}
		}

		// Timeline
		const date = new Date(scrobble.playedTime);
		const hour = date.getHours();
		const day = date.getDay();
		byHour[hour]++;
		byDay[day]++;
		byHourDay[day][hour]++;

		// Service origins
		if (scrobble.musicServiceBaseDomain) {
			const domain = scrobble.musicServiceBaseDomain;
			serviceOrigins.set(domain, (serviceOrigins.get(domain) ?? 0) + 1);
		}
	}

	const topArtists = [...artistCounts.entries()]
		.map(([name, count]) => ({ name, count }))
		.sort((a, b) => b.count - a.count)
		.slice(0, 50);

	const topTracks = [...trackCounts.values()]
		.sort((a, b) => b.count - a.count)
		.slice(0, 50);

	const topAlbums = [...albumCounts.values()]
		.sort((a, b) => b.count - a.count)
		.slice(0, 50);

	return {
		totalScrobbles: scrobbles.length,
		uniqueArtists: artistCounts.size,
		uniqueTracks: trackCounts.size,
		topArtists,
		topTracks,
		topAlbums,
		artistPlayCounts: artistCounts,
		trackPlayCounts: new Map([...trackCounts.values()].map((t) => [t.name, t.count])),
		albumPlayCounts: albumCounts,
		scrobblesByHour: byHour,
		scrobblesByDay: byDay,
		scrobblesByHourDay: byHourDay,
		serviceOrigins
	};
}
