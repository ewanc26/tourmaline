import type { ArtistInfo } from '$lib/types';
import type { AggregatedData } from './aggregator';

const MOOD_KEYWORDS: Record<string, string[]> = {
	Energetic: [
		'energetic',
		'upbeat',
		'high energy',
		'powerful',
		'intense',
		'driving',
		'fast',
		'aggressive',
		'fierce',
		'explosive'
	],
	Melancholic: [
		'melancholic',
		'sad',
		'somber',
		'melancholy',
		'dark',
		'brooding',
		'mournful',
		'downbeat',
		'wistful',
		'haunting'
	],
	Chill: [
		'chill',
		'relaxed',
		'mellow',
		'calm',
		'peaceful',
		'ambient',
		'dreamy',
		'soothing',
		'laid-back',
		'tranquil'
	],
	Happy: [
		'happy',
		'joyful',
		'cheerful',
		'uplifting',
		'feel-good',
		'bright',
		'sunny',
		'fun',
		'playful',
		'optimistic'
	],
	Aggressive: [
		'aggressive',
		'heavy',
		'brutal',
		'harsh',
		'violent',
		'crushing',
		'savage',
		'brutal',
		'destructive',
		'angry'
	],
	Atmospheric: [
		'atmospheric',
		'cinematic',
		'epic',
		'ethereal',
		'spacious',
		'ambient',
		'immersive',
		'evocative',
		'moody',
		'nostalgic'
	],
	Nostalgic: [
		'nostalgic',
		'retro',
		'vintage',
		'classic',
		'throwback',
		'old-school',
		'timeless',
		'wistful',
		'sentimental',
		'yearning'
	],
	Dark: [
		'dark',
		'gothic',
		'black',
		'doom',
		'death',
		'evil',
		'sinister',
		'occult',
		'horror',
		'dread'
	]
};

export function buildMoodProfile(
	data: AggregatedData,
	artistInfos: Map<string, ArtistInfo>
): Record<string, number> {
	const moodScores: Record<string, number> = {};
	for (const mood of Object.keys(MOOD_KEYWORDS)) {
		moodScores[mood] = 0;
	}

	let totalWeight = 0;

	for (const { name, count } of data.topArtists) {
		const info = artistInfos.get(name);
		if (!info) continue;

		const allTags = [...info.tags, ...info.genres].map((t) => t.toLowerCase());

		for (const [mood, keywords] of Object.entries(MOOD_KEYWORDS)) {
			const matchCount = keywords.filter((kw) =>
				allTags.some((tag) => tag.includes(kw))
			).length;

			if (matchCount > 0) {
				moodScores[mood] += count * matchCount;
			}
		}

		totalWeight += count;
	}

	if (totalWeight === 0) return moodScores;

	// Normalise to 0-100
	const maxScore = Math.max(...Object.values(moodScores));
	if (maxScore === 0) return moodScores;

	for (const mood of Object.keys(moodScores)) {
		moodScores[mood] = Math.round((moodScores[mood] / maxScore) * 100);
	}

	return moodScores;
}
