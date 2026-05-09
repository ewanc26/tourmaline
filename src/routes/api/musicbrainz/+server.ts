import type { RequestHandler } from './$types';

const USER_AGENT = 'Tourmaline/0.1.0 (https://github.com/ewanc26/tourmaline)';

export const GET: RequestHandler = async ({ url }) => {
	const targetUrl = url.search.replace(/^\?/, '');

	if (!targetUrl || !targetUrl.startsWith('https://musicbrainz.org/ws/2/')) {
		return new Response('Invalid URL', { status: 400 });
	}

	const res = await fetch(targetUrl, {
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
