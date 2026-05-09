import type { ArtistInfo } from '$lib/types';
import type { AggregatedData } from './aggregator';

/**
 * Map genre/tag names to mood categories.
 * MusicBrainz and Last.fm tags are predominantly genre names
 * (metal, rock, electronic) rather than mood descriptors
 * (aggressive, happy). This mapping bridges that gap.
 */
const GENRE_MOOD_MAP: Record<string, Record<string, number>> = {
	// Metal subgenres → moods
	metal: { Aggressive: 3, Energetic: 2, Dark: 1 },
	'power metal': { Energetic: 3, Happy: 1, Aggressive: 1 },
	'heavy metal': { Aggressive: 3, Energetic: 2, Dark: 1 },
	'thrash metal': { Aggressive: 4, Energetic: 3 },
	'death metal': { Aggressive: 4, Dark: 3 },
	'black metal': { Dark: 4, Aggressive: 3, Atmospheric: 1 },
	'doom metal': { Dark: 4, Melancholic: 2, Atmospheric: 1 },
	'gothic metal': { Dark: 3, Atmospheric: 2, Melancholic: 1 },
	'symphonic metal': { Atmospheric: 3, Energetic: 1, Dark: 1 },
	'folk metal': { Energetic: 2, Nostalgic: 1, Happy: 1 },
	'progressive metal': { Atmospheric: 2, Energetic: 1, Dark: 1 },
	'nu metal': { Aggressive: 3, Energetic: 1 },
	'industrial metal': { Aggressive: 3, Dark: 2, Energetic: 1 },
	'stoner metal': { Chill: 2, Dark: 1 },
	'sludge metal': { Aggressive: 3, Dark: 2 },
	'groove metal': { Energetic: 3, Aggressive: 2 },
	'melodic death metal': { Dark: 2, Aggressive: 2, Melancholic: 1 },
	'melodic metal': { Energetic: 2, Atmospheric: 1, Dark: 1 },
	'speed metal': { Energetic: 4, Aggressive: 2 },
	'alternative metal': { Aggressive: 2, Dark: 1 },

	// Rock
	rock: { Energetic: 2, Aggressive: 1 },
	'hard rock': { Energetic: 3, Aggressive: 1 },
	'classic rock': { Nostalgic: 3, Energetic: 1 },
	'progressive rock': { Atmospheric: 3, Nostalgic: 1 },
	'alternative rock': { Melancholic: 1, Energetic: 1, Dark: 1 },
	'indie rock': { Melancholic: 1, Chill: 1, Nostalgic: 1 },
	'post-rock': { Atmospheric: 4, Chill: 1, Melancholic: 1 },
	'psychedelic rock': { Atmospheric: 3, Chill: 2, Nostalgic: 1 },
	'garage rock': { Energetic: 3, Aggressive: 1 },
	'stoner rock': { Chill: 2, Energetic: 1, Dark: 1 },
	'surf rock': { Happy: 3, Energetic: 2 },
	'post-punk': { Dark: 3, Atmospheric: 1, Melancholic: 1 },
	'punk rock': { Aggressive: 3, Energetic: 3 },
	'punk': { Aggressive: 3, Energetic: 3 },
	'grunge': { Aggressive: 2, Dark: 2, Melancholic: 1 },
	'shoegaze': { Atmospheric: 4, Chill: 2, Melancholic: 1 },
	'dream pop': { Atmospheric: 3, Chill: 3, Melancholic: 1 },
	'noise rock': { Aggressive: 3, Energetic: 2 },
	'space rock': { Atmospheric: 4, Chill: 2 },
	'krautrock': { Atmospheric: 2, Chill: 1, Energetic: 1 },

	// Electronic
	electronic: { Energetic: 2, Chill: 1 },
	techno: { Energetic: 4, Aggressive: 1 },
	house: { Energetic: 3, Happy: 2 },
	trance: { Energetic: 3, Atmospheric: 2, Happy: 1 },
	dubstep: { Aggressive: 3, Energetic: 2, Dark: 1 },
	'drum and bass': { Energetic: 4, Aggressive: 1 },
	ambient: { Atmospheric: 4, Chill: 4 },
	'downtempo': { Chill: 4, Atmospheric: 1 },
	idm: { Atmospheric: 2, Chill: 2 },
	synthwave: { Nostalgic: 3, Atmospheric: 2, Energetic: 1 },
	'vaporwave': { Nostalgic: 4, Chill: 2, Atmospheric: 1 },
	industrial: { Aggressive: 4, Dark: 2, Energetic: 1 },
	'ebm': { Aggressive: 3, Energetic: 2, Dark: 1 },
	darkwave: { Dark: 3, Atmospheric: 2, Melancholic: 1 },
	'chillwave': { Chill: 4, Nostalgic: 2, Atmospheric: 1 },
	'glitch': { Atmospheric: 2, Dark: 1 },
	'hardstyle': { Energetic: 4, Aggressive: 2 },
	'minimal': { Chill: 2, Atmospheric: 1 },
	'deep house': { Chill: 3, Energetic: 1, Happy: 1 },
	'progressive house': { Atmospheric: 2, Energetic: 2, Happy: 1 },

	// Pop
	pop: { Happy: 2, Energetic: 1 },
	'synth pop': { Energetic: 2, Nostalgic: 2, Happy: 1 },
	'indie pop': { Happy: 1, Melancholic: 1, Chill: 1 },
	'art pop': { Atmospheric: 2, Melancholic: 1 },
	'electropop': { Energetic: 2, Happy: 1, Nostalgic: 1 },
	'chamber pop': { Atmospheric: 2, Nostalgic: 1 },
	'dance pop': { Energetic: 3, Happy: 3 },
	'teen pop': { Happy: 3, Energetic: 2 },
	'power pop': { Energetic: 3, Happy: 2 },
	'k-pop': { Energetic: 3, Happy: 2 },
	'j-pop': { Happy: 2, Energetic: 2 },

	// Hip hop
	'hip hop': { Energetic: 2, Aggressive: 1 },
	rap: { Energetic: 2, Aggressive: 1 },
	'trap': { Aggressive: 3, Dark: 1, Energetic: 2 },
	'conscious hip hop': { Melancholic: 1, Atmospheric: 1 },
	'gangsta rap': { Aggressive: 4, Dark: 1 },
	'lo-fi hip hop': { Chill: 4, Nostalgic: 2, Atmospheric: 1 },
	'chillhop': { Chill: 4, Happy: 1, Nostalgic: 1 },
	'boom bap': { Nostalgic: 2, Energetic: 1, Chill: 1 },

	// Jazz
	jazz: { Chill: 2, Atmospheric: 2, Nostalgic: 1 },
	'smooth jazz': { Chill: 4, Happy: 1 },
	'free jazz': { Energetic: 2, Aggressive: 1 },
	'jazz fusion': { Energetic: 2, Atmospheric: 1 },
	'cool jazz': { Chill: 4, Atmospheric: 1 },
	'bebop': { Energetic: 3, Happy: 1 },
	'nu jazz': { Chill: 2, Atmospheric: 2 },

	// Classical
	classical: { Atmospheric: 3, Chill: 2, Nostalgic: 2 },
	'neoclassical': { Atmospheric: 3, Dark: 1, Nostalgic: 1 },
	'orchestral': { Atmospheric: 4, Energetic: 1 },
	'film score': { Atmospheric: 4, Nostalgic: 1 },
	'ambient classical': { Atmospheric: 4, Chill: 3 },

	// Folk/Country
	folk: { Nostalgic: 3, Melancholic: 1, Chill: 1 },
	'indie folk': { Melancholic: 2, Nostalgic: 2, Chill: 1 },
	'neofolk': { Dark: 2, Nostalgic: 2, Atmospheric: 1 },
	'folk rock': { Nostalgic: 2, Energetic: 1 },
	country: { Nostalgic: 2, Happy: 1, Chill: 1 },
	'bluegrass': { Happy: 2, Energetic: 2, Nostalgic: 1 },
	'americana': { Nostalgic: 3, Chill: 1 },

	// R&B / Soul
	soul: { Happy: 2, Chill: 2, Nostalgic: 1 },
	'neo soul': { Chill: 3, Atmospheric: 1, Happy: 1 },
	'r&b': { Chill: 2, Happy: 1, Energetic: 1 },
	'funk': { Energetic: 4, Happy: 3 },
	'motown': { Happy: 3, Nostalgic: 2, Energetic: 1 },

	// Reggae
	reggae: { Chill: 4, Happy: 2 },
	dub: { Chill: 4, Atmospheric: 2 },
	'dancehall': { Energetic: 3, Happy: 1 },

	// Latin
	'reggaton': { Energetic: 3, Happy: 2 },
	'salsa': { Energetic: 3, Happy: 3 },
	'bossa nova': { Chill: 4, Nostalgic: 2, Happy: 1 },
	'latin pop': { Happy: 3, Energetic: 2 },

	// Blues
	blues: { Melancholic: 3, Nostalgic: 2, Chill: 1 },

	// World
	'world music': { Atmospheric: 2, Nostalgic: 1, Chill: 1 },

	// Soundtrack/other
	soundtrack: { Atmospheric: 4, Nostalgic: 1 },
	'score': { Atmospheric: 4, Nostalgic: 1 },
	'musical': { Happy: 2, Energetic: 1, Theatrical: 1 },
	'new age': { Chill: 4, Atmospheric: 3 },
	'meditation': { Chill: 4, Atmospheric: 3 },
	'spoken word': { Atmospheric: 2, Chill: 1 },

	// Direct mood tags (from Last.fm user tags)
	energetic: { Energetic: 5 },
	upbeat: { Energetic: 3, Happy: 2 },
	powerful: { Energetic: 3, Aggressive: 1 },
	intense: { Energetic: 2, Aggressive: 2 },
	driving: { Energetic: 3, Aggressive: 1 },
	fierce: { Energetic: 2, Aggressive: 3 },
	melancholic: { Melancholic: 5 },
	sad: { Melancholic: 5 },
	somber: { Melancholic: 4, Dark: 1 },
	brooding: { Melancholic: 3, Dark: 2 },
	haunting: { Melancholic: 2, Atmospheric: 2, Dark: 1 },
	chill: { Chill: 5 },
	relaxed: { Chill: 5 },
	mellow: { Chill: 4 },
	calm: { Chill: 4 },
	peaceful: { Chill: 4 },
	dreamy: { Chill: 3, Atmospheric: 2 },
	tranquil: { Chill: 5 },
	happy: { Happy: 5 },
	joyful: { Happy: 5 },
	cheerful: { Happy: 4, Energetic: 1 },
	uplifting: { Happy: 4, Energetic: 1 },
	'feel-good': { Happy: 4 },
	bright: { Happy: 3, Energetic: 1 },
	aggressive: { Aggressive: 5 },
	heavy: { Aggressive: 3, Dark: 1 },
	brutal: { Aggressive: 5, Dark: 1 },
	harsh: { Aggressive: 4, Dark: 1 },
	violent: { Aggressive: 5, Dark: 1 },
	angry: { Aggressive: 5, Energetic: 1 },
	atmospheric: { Atmospheric: 5 },
	cinematic: { Atmospheric: 4, Nostalgic: 1 },
	epic: { Atmospheric: 3, Energetic: 2 },
	ethereal: { Atmospheric: 4, Chill: 2 },
	nostalgic: { Nostalgic: 5 },
	retro: { Nostalgic: 4 },
	vintage: { Nostalgic: 4 },
	'classic': { Nostalgic: 3 },
	'old-school': { Nostalgic: 4 },
	timeless: { Nostalgic: 3 },
	sentimental: { Nostalgic: 3, Melancholic: 2 },
	dark: { Dark: 5 },
	gothic: { Dark: 4, Atmospheric: 1 },
	doom: { Dark: 4, Melancholic: 1 },
	death: { Dark: 4, Aggressive: 2 },
	sinister: { Dark: 4, Aggressive: 1 },
	occult: { Dark: 4, Atmospheric: 1 },
	horror: { Dark: 4, Aggressive: 1 },
	evil: { Dark: 4, Aggressive: 1 }
};

const MOOD_KEYS = ['Energetic', 'Melancholic', 'Chill', 'Happy', 'Aggressive', 'Atmospheric', 'Nostalgic', 'Dark'];

export function buildMoodProfile(
	data: AggregatedData,
	artistInfos: Map<string, ArtistInfo>
): Record<string, number> {
	const moodScores: Record<string, number> = {};
	for (const mood of MOOD_KEYS) {
		moodScores[mood] = 0;
	}

	let totalWeight = 0;

	for (const { name, count } of data.topArtists) {
		const info = artistInfos.get(name);
		if (!info) continue;

		const allTags = [...info.tags, ...info.genres].map((t) => t.toLowerCase());
		const matchedTags = allTags.filter((t) => GENRE_MOOD_MAP[t]);
		if (matchedTags.length > 0) {
			console.log(`[tourmaline] mood: ${name} → tags=${allTags.join(',')}, matched=${matchedTags.join(',')}`);
		}

		for (const tag of allTags) {
			const mapping = GENRE_MOOD_MAP[tag];
			if (!mapping) continue;

			for (const [mood, weight] of Object.entries(mapping)) {
				if (mood in moodScores) {
					moodScores[mood] += count * weight;
				}
			}
		}

		totalWeight += count;
	}

	if (totalWeight === 0) return moodScores;

	// Normalise to 0-100
	const maxScore = Math.max(...Object.values(moodScores));
	if (maxScore === 0) return moodScores;

	for (const mood of MOOD_KEYS) {
		moodScores[mood] = Math.round((moodScores[mood] / maxScore) * 100);
	}

	return moodScores;
}
