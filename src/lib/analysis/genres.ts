import type { AggregatedData } from './aggregator';
import type { ArtistInfo, GenreEntry } from '$lib/types';

const GENRE_MAPPINGS: Record<string, string> = {
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
	'noise pop': 'Rock',
	'jangle pop': 'Rock',
	'power pop': 'Rock',
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
	'hip hop': 'Hip Hop',
	'rap': 'Hip Hop',
	'trap': 'Hip Hop',
	'conscious hip hop': 'Hip Hop',
	'underground hip hop': 'Hip Hop',
	'gangsta rap': 'Hip Hop',
	'jazz rap': 'Hip Hop',
	'abstract hip hop': 'Hip Hop',
	'chillhop': 'Hip Hop',
	'jazz': 'Jazz',
	'fusion': 'Jazz',
	'smooth jazz': 'Jazz',
	'bebop': 'Jazz',
	'cool jazz': 'Jazz',
	'free jazz': 'Jazz',
	'jazz fusion': 'Jazz',
	'swing': 'Jazz',
	'big band': 'Jazz',
	'classical': 'Classical',
	'contemporary classical': 'Classical',
	'neoclassical': 'Classical',
	'orchestral': 'Classical',
	'chamber music': 'Classical',
	'opera': 'Classical',
	'baroque': 'Classical',
	'romantic': 'Classical',
	'minimalism': 'Classical',
	'folk': 'Folk',
	'folk rock': 'Folk',
	'folk punk': 'Folk',
	'neofolk': 'Folk',
	'indie folk': 'Folk',
	'psychedelic folk': 'Folk',
	'appalachian folk': 'Folk',
	'celtic': 'Folk',
	'country': 'Country',
	'alt-country': 'Country',
	'country rock': 'Country',
	'outlaw country': 'Country',
	'bluegrass': 'Country',
	'r&b': 'R&B',
	'soul': 'R&B',
	'neo-soul': 'R&B',
	'funk': 'R&B',
	'motown': 'R&B',
	'disco': 'R&B',
	'blues': 'Blues',
	'blues rock': 'Blues',
	'delta blues': 'Blues',
	'chicago blues': 'Blues',
	'reggae': 'Reggae',
	'dub': 'Reggae',
	'ska': 'Reggae',
	'dancehall': 'Reggae',
	'soundtrack': 'Soundtrack',
	'score': 'Soundtrack',
	'video game music': 'Soundtrack',
	'film score': 'Soundtrack',
	'musical': 'Soundtrack',
	'new age': 'New Age',
	'world music': 'World',
	'afrobeat': 'World',
	'latin': 'World',
	'bossa nova': 'World',
	'flamenco': 'World',
	'fado': 'World',
	'cumbia': 'World',
	'salsa': 'World'
};

function normaliseGenre(tag: string): string | null {
	const lower = tag.toLowerCase().trim();
	return GENRE_MAPPINGS[lower] ?? null;
}

export function buildGenreProfile(
	data: AggregatedData,
	artistInfos: Map<string, ArtistInfo>
): GenreEntry[] {
	const genreWeights = new Map<string, number>();

	for (const { name, count } of data.topArtists) {
		const info = artistInfos.get(name);
		if (!info) continue;

		for (const genre of info.genres) {
			const normalised = normaliseGenre(genre) ?? genre;
			genreWeights.set(normalised, (genreWeights.get(normalised) ?? 0) + count);
		}

		if (info.genres.length === 0) {
			for (const tag of info.tags.slice(0, 5)) {
				const normalised = normaliseGenre(tag);
				if (normalised) {
					genreWeights.set(normalised, (genreWeights.get(normalised) ?? 0) + count);
				}
			}
		}
	}

	return [...genreWeights.entries()]
		.map(([name, weight]) => ({ name, weight }))
		.sort((a, b) => b.weight - a.weight)
		.slice(0, 20);
}
