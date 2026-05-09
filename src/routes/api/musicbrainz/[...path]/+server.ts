import type { RequestHandler } from './$types';

const BASE_URL = 'https://musicbrainz.org/ws/2';
const USER_AGENT = 'Tourmaline/0.1.0 (https://github.com/ewanc26/tourmaline)';

export const GET: RequestHandler = async ({ url, fetch: serverFetch }) => {
	// The proxy receives the MusicBrainz path + query after /api/musicbrainz/
	// e.g. /api/musicbrainz/artist?query=...&fmt=json
	// We strip /api/musicbrainz from the pathname and forward to MusicBrainz
	const path = url.pathname.replace('/api/musicbrainz', '');
	const targetUrl = `${BASE_URL}${path}${url.search}`;

	const res = await serverFetch(targetUrl, {
		headers: {
			'User-Agent': USER_AGENT,
			Accept: 'application/json'
		}
	});

	const data = await res.text();
	return new Response(data, {
		status: res.status,
		headers: {
			'Content-Type': 'application/json',
			'Cache-Control': 'public, max-age=86400'
		}
	});
};
