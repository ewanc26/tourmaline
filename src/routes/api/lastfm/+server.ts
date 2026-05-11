import type { RequestHandler } from './$types';

const BASE_URL = 'https://ws.audioscrobbler.com/2.0/';

// Last.fm: no strict documented limit, but be polite — 5 req/s
let lastRequestTime = 0;
const MIN_INTERVAL = 200; // 5 per second
const queue: Array<{ resolve: () => void }> = [];

function scheduleNext() {
	if (queue.length === 0) return;
	const now = Date.now();
	const wait = Math.max(0, MIN_INTERVAL - (now - lastRequestTime));
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

export const GET: RequestHandler = async ({ url, fetch }) => {
	const params = url.search.replace(/^\?/, '');
	const targetUrl = `${BASE_URL}?${params}`;

	await waitForRateLimit();

	const res = await fetch(targetUrl);

	if (res.status === 429) {
		// Retry after 5 seconds if rate limited
		await new Promise((r) => setTimeout(r, 5000));
		const retry = await fetch(targetUrl);
		const data = await retry.text();
		return new Response(data, {
			status: retry.status,
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': retry.ok ? 'public, max-age=86400' : 'no-store'
			}
		});
	}

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
