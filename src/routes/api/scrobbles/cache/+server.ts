import { json } from '@sveltejs/kit';
import { getCached, setCached } from '$lib/cache/server';
import type { TealScrobble } from '$lib/types';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const did = url.searchParams.get('did');
	if (!did) return json({ error: 'did parameter required' }, { status: 400 });

	const row = getCached(did);
	if (!row) return json({ cached: false });

	return json({
		cached: true,
		cursor: row.cursor,
		scrobbles: row.scrobbles,
		fetchedAt: row.fetchedAt
	});
};

export const PUT: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as {
		did?: string;
		cursor?: string;
		scrobbles?: TealScrobble[];
	};

	if (!body.did || !body.cursor || !body.scrobbles) {
		return json({ error: 'did, cursor, and scrobbles required' }, { status: 400 });
	}

	setCached(body.did, body.cursor, body.scrobbles);
	return json({ ok: true });
};
