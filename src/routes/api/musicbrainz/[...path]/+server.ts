import type { RequestHandler } from './$types';

const BASE_URL = 'https://musicbrainz.org/ws/2';
const USER_AGENT = 'Tourmaline/0.3.0 (https://github.com/ewanc26/tourmaline)';

// MusicBrainz rate limit: 1 request per second per IP
let lastRequestTime = 0;
const queue: Array<{ resolve: () => void }> = [];

function scheduleNext() {
	if (queue.length === 0) return;
	const now = Date.now();
	const wait = Math.max(0, 1100 - (now - lastRequestTime));
	if (wait > 0) {
		setTimeout(() => {
			lastRequestTime = Date.now();
			queue.shift()!.resolve();
			scheduleNext();
		}, wait);
	} else {
		lastRequestTime = Date.now();
		queue.shift()!.resolve();
		scheduleNext();
	}
}

function waitForRateLimit(): Promise<void> {
	return new Promise((resolve) => {
		queue.push({ resolve });
		if (queue.length === 1) scheduleNext();
	});
}

export const GET: RequestHandler = async ({ url, fetch: serverFetch }) => {
	const path = url.pathname.replace('/api/musicbrainz', '');
	const targetUrl = `${BASE_URL}${path}${url.search}`;

	await waitForRateLimit();

	const res = await serverFetch(targetUrl, {
		headers: {
			'User-Agent': USER_AGENT,
			Accept: 'application/json'
		}
	});

	const data = await res.text();
	const cacheControl = res.ok
		? 'public, max-age=86400'
		: 'no-store';
	return new Response(data, {
		status: res.status,
		headers: {
			'Content-Type': 'application/json',
			'Cache-Control': cacheControl
		}
	});
};
