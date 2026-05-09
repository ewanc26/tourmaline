import type { RequestHandler } from './$types';

const BASE_URL = 'https://ws.audioscrobbler.com/2.0/';

export const GET: RequestHandler = async ({ url, fetch }) => {
	const params = url.search.replace(/^\?/, '');
	const targetUrl = `${BASE_URL}?${params}`;

	const res = await fetch(targetUrl);

	const data = await res.text();
	return new Response(data, {
		status: res.status,
		headers: {
			'Content-Type': 'application/json',
			'Cache-Control': 'public, max-age=86400'
		}
	});
};
