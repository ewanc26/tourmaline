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

/**
 * Incremental aggregator. Maintains running totals so it can be updated
 * as each batch of scrobbles arrives without reprocessing everything.
 */
export class Aggregator {
	private artistCounts = new Map<string, number>();
	private trackCounts = new Map<string, { name: string; artist: string; count: number }>();
	private albumCounts = new Map<string, { name: string; artist: string; count: number }>();
	private serviceOrigins = new Map<string, number>();
	private byHour = new Array(24).fill(0) as number[];
	private byDay = new Array(7).fill(0) as number[];
	private byHourDay = Array.from({ length: 7 }, () => new Array(24).fill(0) as number[]);
	private total = 0;

	add(scrobbles: TealScrobble[]): void {
		for (const scrobble of scrobbles) {
			this.total++;

			const artistName = scrobble.artists[0]?.name ?? 'Unknown';
			this.artistCounts.set(artistName, (this.artistCounts.get(artistName) ?? 0) + 1);

			const trackKey = TRACK_KEY(scrobble);
			const existing = this.trackCounts.get(trackKey);
			if (existing) {
				existing.count++;
			} else {
				this.trackCounts.set(trackKey, {
					name: scrobble.trackName,
					artist: artistName,
					count: 1
				});
			}

			const albumKey = ALBUM_KEY(scrobble);
			if (albumKey) {
				const albumExisting = this.albumCounts.get(albumKey);
				if (albumExisting) {
					albumExisting.count++;
				} else {
					this.albumCounts.set(albumKey, {
						name: scrobble.releaseName!,
						artist: artistName,
						count: 1
					});
				}
			}

			const date = new Date(scrobble.playedTime);
			const hour = date.getHours();
			const day = date.getDay();
			this.byHour[hour]++;
			this.byDay[day]++;
			this.byHourDay[day][hour]++;

			if (scrobble.musicServiceBaseDomain) {
				const domain = scrobble.musicServiceBaseDomain;
				this.serviceOrigins.set(domain, (this.serviceOrigins.get(domain) ?? 0) + 1);
			}
		}
	}

	snapshot(): AggregatedData {
		const topArtists = [...this.artistCounts.entries()]
			.map(([name, count]) => ({ name, count }))
			.sort((a, b) => b.count - a.count)
			.slice(0, 50);

		const topTracks = [...this.trackCounts.values()]
			.sort((a, b) => b.count - a.count)
			.slice(0, 50);

		const topAlbums = [...this.albumCounts.values()]
			.sort((a, b) => b.count - a.count)
			.slice(0, 50);

		return {
			totalScrobbles: this.total,
			uniqueArtists: this.artistCounts.size,
			uniqueTracks: this.trackCounts.size,
			topArtists,
			topTracks,
			topAlbums,
			artistPlayCounts: this.artistCounts,
			trackPlayCounts: new Map([...this.trackCounts.values()].map((t) => [t.name, t.count])),
			albumPlayCounts: this.albumCounts,
			scrobblesByHour: [...this.byHour],
			scrobblesByDay: [...this.byDay],
			scrobblesByHourDay: this.byHourDay.map((d) => [...d]),
			serviceOrigins: this.serviceOrigins
		};
	}
}

/** One-shot aggregation for when you have all scrobbles already. */
export function aggregate(scrobbles: TealScrobble[]): AggregatedData {
	const agg = new Aggregator();
	agg.add(scrobbles);
	return agg.snapshot();
}
