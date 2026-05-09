import type { AggregatedData } from './aggregator';
import type { ArtistInfo, GenreEntry } from '$lib/types';

/**
 * Top-level genre categories. Subgenres collapse into these.
 * Order matters for display — listed roughly by commonness.
 */
const CATEGORIES = [
	'Metal',
	'Rock',
	'Pop',
	'Electronic',
	'Hip Hop',
	'Jazz',
	'Classical',
	'Folk',
	'Country',
	'R&B',
	'Blues',
	'Reggae',
	'Latin',
	'World',
	'Soundtrack',
	'New Age',
	'Punk',
	'Singer-Songwriter'
] as const;

type Category = (typeof CATEGORIES)[number];

/**
 * Exact subgenre → category mappings.
 * Checked first — most specific match wins.
 */
const EXACT: Record<string, Category> = {
	// Metal
	'power metal': 'Metal',
	'symphonic metal': 'Metal',
	'heavy metal': 'Metal',
	'death metal': 'Metal',
	'black metal': 'Metal',
	'thrash metal': 'Metal',
	'doom metal': 'Metal',
	'folk metal': 'Metal',
	'gothic metal': 'Metal',
	'progressive metal': 'Metal',
	'melodic metal': 'Metal',
	'nu metal': 'Metal',
	'alternative metal': 'Metal',
	'industrial metal': 'Metal',
	'speed metal': 'Metal',
	'djent': 'Metal',
	'metalcore': 'Metal',
	'deathcore': 'Metal',
	'post-metal': 'Metal',
	'stoner metal': 'Metal',
	'sludge metal': 'Metal',
	'groove metal': 'Metal',
	'melodic death metal': 'Metal',
	'symphonic death metal': 'Metal',
	'neo-classical metal': 'Metal',
	'neoclassical metal': 'Metal',
	'epic metal': 'Metal',
	'viking metal': 'Metal',
	'pagan metal': 'Metal',
	'blackened death metal': 'Metal',
	'technical death metal': 'Metal',
	'brutal death metal': 'Metal',
	'progressive death metal': 'Metal',
	'atmospheric black metal': 'Metal',
	'depressive black metal': 'Metal',
	'dsbm': 'Metal',
	'blackgaze': 'Metal',
	'post-black metal': 'Metal',
	'slam death metal': 'Metal',
	'grindcore': 'Metal',
	'd-beat': 'Metal',
	'crossover thrash': 'Metal',
	'power thrash': 'Metal',
	'us power metal': 'Metal',
	'european power metal': 'Metal',
	'epic doom metal': 'Metal',
	'funeral doom metal': 'Metal',
	'drone metal': 'Metal',
	'drone doom': 'Metal',
	'sludge': 'Metal',
	'stoner': 'Metal',
	'stoner doom': 'Metal',
	'nwobhm': 'Metal',

	// Rock
	'art rock': 'Rock',
	'progressive rock': 'Rock',
	'psychedelic rock': 'Rock',
	'alternative rock': 'Rock',
	'indie rock': 'Rock',
	'hard rock': 'Rock',
	'post-rock': 'Rock',
	'post-punk': 'Rock',
	'punk rock': 'Rock',
	'stoner rock': 'Rock',
	'space rock': 'Rock',
	'krautrock': 'Rock',
	'shoegaze': 'Rock',
	'noise rock': 'Rock',
	'garage rock': 'Rock',
	'surf rock': 'Rock',
	'southern rock': 'Rock',
	'glam rock': 'Rock',
	'grunge': 'Rock',
	'britpop': 'Rock',
	'madchester': 'Rock',
	'new wave': 'Rock',
	'coldwave': 'Rock',
	'emo': 'Rock',
	'screamo': 'Rock',
	'math rock': 'Rock',
	'midwest emo': 'Rock',
	'noise pop': 'Rock',
	'jangle pop': 'Pop',
	'power pop': 'Pop',
	'classic rock': 'Rock',
	'acid rock': 'Rock',
	'rockabilly': 'Rock',
	'psychobilly': 'Rock',
	'soft rock': 'Rock',
	'yacht rock': 'Rock',
	'roots rock': 'Rock',
	'cowpunk': 'Rock',
	'desert rock': 'Rock',
	'symphonic rock': 'Rock',
	'zeuhl': 'Rock',
	'canterbury scene': 'Rock',
	'rutba': 'Rock',
	'proto-punk': 'Punk',
	'proto-metal': 'Metal',
	'crossover prog': 'Rock',

	// Punk
	'punk': 'Punk',
	'hardcore punk': 'Punk',
	'skate punk': 'Punk',
	'street punk': 'Punk',
	'anarcho-punk': 'Punk',
	'crust punk': 'Punk',
	'peace punk': 'Punk',
	'uk82': 'Punk',
	'streetcore': 'Punk',
	'oi': 'Punk',
	'77 punk': 'Punk',

	// Pop
	'art pop': 'Pop',
	'indie pop': 'Pop',
	'synthpop': 'Pop',
	'electropop': 'Pop',
	'dream pop': 'Pop',
	'chamber pop': 'Pop',
	'dance-pop': 'Pop',
	'teen pop': 'Pop',
	'j-pop': 'Pop',
	'k-pop': 'Pop',
	'c-pop': 'Pop',
	'latin pop': 'Pop',
	'pop rock': 'Pop',
	'pop punk': 'Pop',
	'emo pop': 'Pop',
	'baroque pop': 'Pop',
	'sunshine pop': 'Pop',
	'bubblegum pop': 'Pop',
	'chillwave': 'Pop',
	'hyperpop': 'Pop',
	'bedroom pop': 'Pop',
	'sophisti-pop': 'Pop',
	'synth pop': 'Pop',
	'dreampop': 'Pop',

	// Electronic
	'ambient': 'Electronic',
	'techno': 'Electronic',
	'house': 'Electronic',
	'drum and bass': 'Electronic',
	'dubstep': 'Electronic',
	'trance': 'Electronic',
	'idm': 'Electronic',
	'electro': 'Electronic',
	'downtempo': 'Electronic',
	'chillout': 'Electronic',
	'glitch': 'Electronic',
	'industrial': 'Electronic',
	'darkwave': 'Electronic',
	'synthwave': 'Electronic',
	'vaporwave': 'Electronic',
	'uk garage': 'Electronic',
	'deep house': 'Electronic',
	'tech house': 'Electronic',
	'progressive house': 'Electronic',
	'lo-fi': 'Electronic',
	'lo-fi beats': 'Electronic',
	'hardstyle': 'Electronic',
	'gabber': 'Electronic',
	'breakcore': 'Electronic',
	'jungle': 'Electronic',
	'footwork': 'Electronic',
	'uk bass': 'Electronic',
	'ebm': 'Electronic',
	'future bass': 'Electronic',
	'future garage': 'Electronic',
	'witch house': 'Electronic',
	'wave': 'Electronic',
	'hardwave': 'Electronic',
	'electro swing': 'Electronic',
	'glitch hop': 'Electronic',
	'wonky': 'Electronic',
	'minimal techno': 'Electronic',
	'detroit techno': 'Electronic',
	'chicago house': 'Electronic',
	'acid house': 'Electronic',
	'acid techno': 'Electronic',
	'progressive trance': 'Electronic',
	'uplifting trance': 'Electronic',
	'psytrance': 'Electronic',
	'goa trance': 'Electronic',
	'dark techno': 'Electronic',
	'industrial techno': 'Electronic',
	'ambient techno': 'Electronic',
	'bitscape': 'Electronic',

	// Hip Hop
	'hip hop': 'Hip Hop',
	'rap': 'Hip Hop',
	'trap': 'Hip Hop',
	'conscious hip hop': 'Hip Hop',
	'underground hip hop': 'Hip Hop',
	'gangsta rap': 'Hip Hop',
	'jazz rap': 'Hip Hop',
	'abstract hip hop': 'Hip Hop',
	'chillhop': 'Hip Hop',
	'boom bap': 'Hip Hop',
	'lo-fi hip hop': 'Hip Hop',
	'phonk': 'Hip Hop',
	'drill': 'Hip Hop',
	'uk drill': 'Hip Hop',
	'grime': 'Hip Hop',
	'cloud rap': 'Hip Hop',
	'emo rap': 'Hip Hop',
	'mumble rap': 'Hip Hop',
	'chopped and screwed': 'Hip Hop',
	'southern hip hop': 'Hip Hop',
	'west coast hip hop': 'Hip Hop',
	'east coast hip hop': 'Hip Hop',
	'alternative hip hop': 'Hip Hop',
	'experimental hip hop': 'Hip Hop',
	'industrial hip hop': 'Hip Hop',
	'noise rap': 'Hip Hop',

	// Jazz
	'jazz': 'Jazz',
	'fusion': 'Jazz',
	'smooth jazz': 'Jazz',
	'bebop': 'Jazz',
	'cool jazz': 'Jazz',
	'free jazz': 'Jazz',
	'jazz fusion': 'Jazz',
	'swing': 'Jazz',
	'big band': 'Jazz',
	'nu jazz': 'Jazz',
	'acid jazz': 'Jazz',
	'spiritual jazz': 'Jazz',
	'avant-garde jazz': 'Jazz',
	'contemporary jazz': 'Jazz',
	'dixieland': 'Jazz',
	'ragtime': 'Jazz',

	// Classical
	'classical': 'Classical',
	'contemporary classical': 'Classical',
	'neoclassical': 'Classical',
	'orchestral': 'Classical',
	'chamber music': 'Classical',
	'opera': 'Classical',
	'baroque': 'Classical',
	'romantic': 'Classical',
	'minimalism': 'Classical',
	'early music': 'Classical',
	'choral': 'Classical',
	'modern classical': 'Classical',
	'ambient classical': 'Classical',
	'post-classical': 'Classical',
	'neo-classical': 'Classical',
	'neoclassical darkwave': 'Classical',
	'crossover classical': 'Classical',

	// Folk
	'folk': 'Folk',
	'folk rock': 'Folk',
	'folk punk': 'Folk',
	'indie folk': 'Folk',
	'psychedelic folk': 'Folk',
	'appalachian folk': 'Folk',
	'celtic': 'Folk',
	'anti-folk': 'Folk',
	'neofolk': 'Folk',
	'freak folk': 'Folk',
	'chamber folk': 'Folk',
	'traditional folk': 'Folk',
	'world folk': 'Folk',
	'dark folk': 'Folk',
	'apocalyptic folk': 'Folk',
	'folk noir': 'Folk',

	// Country
	'country': 'Country',
	'alt-country': 'Country',
	'country rock': 'Country',
	'outlaw country': 'Country',
	'bluegrass': 'Country',
	'americana': 'Country',
	'country pop': 'Country',
	'new country': 'Country',
	'bro-country': 'Country',
	'texas country': 'Country',
	'country soul': 'Country',
	'bakersfield sound': 'Country',
	'honky-tonk': 'Country',
	'western swing': 'Country',

	// R&B
	'r&b': 'R&B',
	'rhythm and blues': 'R&B',
	'soul': 'R&B',
	'neo-soul': 'R&B',
	'funk': 'R&B',
	'motown': 'R&B',
	'disco': 'R&B',
	'contemporary r&b': 'R&B',
	'alternative r&b': 'R&B',
	'pbr&b': 'R&B',
	'psychedelic soul': 'R&B',
	'northern soul': 'R&B',
	'southern soul': 'R&B',
	'boogie': 'R&B',
	'electro-funk': 'R&B',
	'go-go': 'R&B',

	// Blues
	'blues': 'Blues',
	'blues rock': 'Blues',
	'delta blues': 'Blues',
	'chicago blues': 'Blues',
	'texas blues': 'Blues',
	'electric blues': 'Blues',
	'acoustic blues': 'Blues',
	'country blues': 'Blues',
	'piedmont blues': 'Blues',
	'jump blues': 'Blues',
	'british blues': 'Blues',
	'blues-rock': 'Blues',

	// Reggae
	'reggae': 'Reggae',
	'dub': 'Reggae',
	'ska': 'Reggae',
	'dancehall': 'Reggae',
	'roots reggae': 'Reggae',
	'lovers rock': 'Reggae',
	'ragga': 'Reggae',
	'riddim': 'Reggae',
	'2-tone': 'Reggae',
	'third wave ska': 'Reggae',
	'ska punk': 'Reggae',

	// Latin
	'latin': 'Latin',
	'reggaeton': 'Latin',
	'salsa': 'Latin',
	'bossa nova': 'Latin',
	'cumbia': 'Latin',
	'bachata': 'Latin',
	'merengue': 'Latin',
	'tango': 'Latin',
	'latin jazz': 'Latin',
	'mariachi': 'Latin',
	'norteño': 'Latin',
	'latin trap': 'Latin',
	'latin rock': 'Latin',
	'mpb': 'Latin',
	'tropicália': 'Latin',
	'forró': 'Latin',
	'samba': 'Latin',

	// World
	'world music': 'World',
	'afrobeat': 'World',
	'afropop': 'World',
	'highlife': 'World',
	'fuji': 'World',
	'kwaito': 'World',
	'amapiano': 'World',
	'flamenco': 'World',
	'fado': 'World',
	'raï': 'World',
	'arabic': 'World',
	'middle eastern': 'World',
	'turkish': 'World',
	'indian': 'World',
	'bollywood': 'World',
	'qawwali': 'World',
	'gamelan': 'World',
	'enka': 'World',

	// Soundtrack
	'soundtrack': 'Soundtrack',
	'score': 'Soundtrack',
	'video game music': 'Soundtrack',
	'film score': 'Soundtrack',
	'musical': 'Soundtrack',
	'incidental music': 'Soundtrack',
	'tv soundtrack': 'Soundtrack',
	'game soundtrack': 'Soundtrack',
	'anime': 'Soundtrack',
	'ost': 'Soundtrack',

	// New Age
	'new age': 'New Age',
	'meditation': 'New Age',
	'healing': 'New Age',
	'ambient new age': 'New Age',
	'nature sounds': 'New Age',
	'space music': 'New Age',

	// Singer-Songwriter
	'singer-songwriter': 'Singer-Songwriter',
	'folk singer-songwriter': 'Singer-Songwriter',
	'indie singer-songwriter': 'Singer-Songwriter',
	'lilith': 'Singer-Songwriter',
	'confessional': 'Singer-Songwriter',
	'acoustic': 'Singer-Songwriter'
};

/**
 * Suffix patterns — if a tag ends with one of these, map to the category.
 * Checked after exact match. More specific suffixes first.
 */
const SUFFIX_PATTERNS: Array<{ suffix: string; category: Category }> = [
	// Metal (most specific first)
	{ suffix: 'death metal', category: 'Metal' },
	{ suffix: 'black metal', category: 'Metal' },
	{ suffix: 'doom metal', category: 'Metal' },
	{ suffix: 'thrash metal', category: 'Metal' },
	{ suffix: 'power metal', category: 'Metal' },
	{ suffix: 'folk metal', category: 'Metal' },
	{ suffix: 'groove metal', category: 'Metal' },
	{ suffix: 'speed metal', category: 'Metal' },
	{ suffix: 'sludge metal', category: 'Metal' },
	{ suffix: 'stoner metal', category: 'Metal' },
	{ suffix: 'gothic metal', category: 'Metal' },
	{ suffix: 'symphonic metal', category: 'Metal' },
	{ suffix: 'progressive metal', category: 'Metal' },
	{ suffix: 'melodic metal', category: 'Metal' },
	{ suffix: 'nu metal', category: 'Metal' },
	{ suffix: 'alternative metal', category: 'Metal' },
	{ suffix: 'industrial metal', category: 'Metal' },
	{ suffix: 'epic metal', category: 'Metal' },
	{ suffix: 'metal', category: 'Metal' },
	{ suffix: 'core', category: 'Metal' }, // metalcore, deathcore, grindcore, etc.

	// Rock
	{ suffix: 'rock', category: 'Rock' },
	{ suffix: 'gaze', category: 'Rock' }, // shoegaze, blackgaze, etc.
	{ suffix: 'wave', category: 'Rock' }, // new wave, coldwave, etc. (overrides to Electronic below)
	{ suffix: 'grunge', category: 'Rock' },
	{ suffix: 'punk', category: 'Punk' },
	{ suffix: 'britpop', category: 'Rock' },

	// Pop
	{ suffix: 'pop', category: 'Pop' },

	// Electronic
	{ suffix: 'techno', category: 'Electronic' },
	{ suffix: 'house', category: 'Electronic' },
	{ suffix: 'trance', category: 'Electronic' },
	{ suffix: 'step', category: 'Electronic' }, // dubstep, sidestep
	{ suffix: 'bass', category: 'Electronic' }, // uk bass, future bass
	{ suffix: 'hop', category: 'Hip Hop' }, // hip hop, chillhop, etc.
	{ suffix: 'rap', category: 'Hip Hop' },

	// Jazz
	{ suffix: 'jazz', category: 'Jazz' },

	// Classical
	{ suffix: 'classical', category: 'Classical' },

	// Folk
	{ suffix: 'folk', category: 'Folk' },

	// Country
	{ suffix: 'country', category: 'Country' },
	{ suffix: 'grass', category: 'Country' }, // bluegrass, newgrass

	// Blues
	{ suffix: 'blues', category: 'Blues' },

	// Reggae
	{ suffix: 'reggae', category: 'Reggae' },
	{ suffix: 'dancehall', category: 'Reggae' },

	// Latin
	{ suffix: 'latin', category: 'Latin' },

	// World
	{ suffix: 'african', category: 'World' },
	{ suffix: 'indian', category: 'World' },
	{ suffix: 'japanese', category: 'World' },
	{ suffix: 'korean', category: 'World' },
	{ suffix: 'chinese', category: 'World' },
	{ suffix: 'scandinavian', category: 'World' },

	// Soundtrack
	{ suffix: 'soundtrack', category: 'Soundtrack' },
	{ suffix: 'score', category: 'Soundtrack' },

	// Singer-Songwriter
	{ suffix: 'singer-songwriter', category: 'Singer-Songwriter' }
];

/**
 * Normalise a raw genre/tag string to a top-level category.
 * Returns null if the tag doesn't match any known pattern.
 */
function normaliseGenre(tag: string): Category | null {
	const lower = tag.toLowerCase().trim();

	// 1. Exact match
	if (lower in EXACT) return EXACT[lower];

	// 2. Suffix pattern match
	for (const { suffix, category } of SUFFIX_PATTERNS) {
		if (lower.endsWith(suffix)) return category;
	}

	return null;
}

/**
 * Build the genre profile from aggregated data and enriched artist info.
 * Genres and tags are both normalised to top-level categories.
 */
export function buildGenreProfile(
	data: AggregatedData,
	artistInfos: Map<string, ArtistInfo>
): GenreEntry[] {
	const genreWeights = new Map<Category, number>();

	for (const { name, count } of data.topArtists) {
		const info = artistInfos.get(name);
		if (!info) continue;

		// Normalise both genres and tags
		const allRaw = [...info.genres, ...info.tags];
		const seen = new Set<Category>();

		for (const raw of allRaw) {
			const normalised = normaliseGenre(raw);
			if (!normalised || seen.has(normalised)) continue;
			seen.add(normalised);
			genreWeights.set(normalised, (genreWeights.get(normalised) ?? 0) + count);
		}
	}

	return [...genreWeights.entries()]
		.map(([name, weight]) => ({ name, weight }))
		.sort((a, b) => b.weight - a.weight)
		.slice(0, 20);
}

export { normaliseGenre, CATEGORIES };
export type { Category };
