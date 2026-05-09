import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('q');
	if (!query) return json(null);

	const res = await fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(query)}`);
	if (!res.ok) return json(null);

	const data = await res.json();
	const artist = data.data?.[0];

	if (!artist) return json(null);

	return json({
		name: artist.name,
		imageUrl: artist.picture_medium ?? null,
		genres: []
	});
};
