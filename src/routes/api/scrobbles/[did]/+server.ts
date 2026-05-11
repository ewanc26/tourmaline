import { json } from '@sveltejs/kit';
import { getSession, updateSession } from '$lib/server/session';
import { fetchScrobbleBatch } from '$lib/server/scrobbles';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url }) => {
	const did = decodeURIComponent(params.did);
	const continueFetch = url.searchParams.get('continue') === 'true';

	const session = getSession(did);

	// Cold start: session doesn't exist (serverless function restarted)
	if (!session) {
		if (continueFetch) {
			return json({ coldStart: true });
		}
		// Fresh start without a session — caller needs to resolve first
		return json({ error: 'No session found. Call /api/resolve first.' }, { status: 400 });
	}

	// Already done
	if (session.fetchDone) {
		return json({ loaded: session.scrobbles.length, done: true });
	}

	// Fetch next batch
	try {
		const result = await fetchScrobbleBatch(session.pdsUrl, did, session.cursor);

		session.scrobbles.push(...result.scrobbles);
		session.cursor = result.cursor;
		session.fetchDone = result.done;

		updateSession(did, {
			scrobbles: session.scrobbles,
			cursor: session.cursor,
			fetchDone: session.fetchDone
		});

		return json({
			loaded: session.scrobbles.length,
			done: session.fetchDone
		});
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Failed to fetch scrobbles';
		return json({ error: message }, { status: 500 });
	}
};
