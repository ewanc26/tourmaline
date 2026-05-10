export interface TealScrobble {
	trackName: string;
	artists: Array<{ name: string; mbId?: string }>;
	releaseName?: string;
	trackMbId?: string;
	recordingMbId?: string;
	releaseMbId?: string;
	duration?: number;
	originUrl?: string;
	playedTime: string;
	submissionClientAgent?: string;
	musicServiceBaseDomain?: string;
	trackDiscriminant?: string;
	releaseDiscriminant?: string;
}

export interface ArtistInfo {
	name: string;
	mbId?: string;
	genres: string[];
	tags: string[];
	similar: Array<{ name: string; mbId?: string }>;
	listenerCount?: number;
	playCount?: number;
	imageUrl?: string;
	startYear?: number;
}

export interface GenreEntry {
	name: string;
	weight: number;
}

export interface TimelineBucket {
	hour: number;
	day: number;
	count: number;
}

export interface DailyScrobble {
	date: string; // YYYY-MM-DD
	count: number;
}

export interface EraEntry {
	decade: string;
	count: number;
}

export interface ListenerProfile {
	did: string;
	handle?: string;
	totalScrobbles: number;
	uniqueArtists: number;
	uniqueTracks: number;
	topArtists: Array<{ name: string; count: number; imageUrl?: string }>;
	topTracks: Array<{ name: string; artist: string; count: number }>;
	topAlbums: Array<{ name: string; artist: string; count: number }>;
	genres: GenreEntry[];
	timeline: TimelineBucket[];
	dailyScrobbles: DailyScrobble[];
	era: EraEntry[];
	diversityScore: number;
	giniCoefficient: number;
	obscurityIndex: number;
	mood: Record<string, number>;
	scrobblesByHour: number[];
	serviceOrigins: Map<string, number>;
}

export interface CacheEntry {
	key: string;
	source: string;
	data: string;
	createdAt: number;
	expiresAt: number;
}
