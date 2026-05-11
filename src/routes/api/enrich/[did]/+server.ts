import { json } from '@sveltejs/kit';
import { getSession, updateSession } from '$lib/server/session';
import { enrichArtistBatch } from '$lib/server/enrich';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url }) => {
	const did = decodeURIComponent(params.did);
	const continueEnrich = url.searchParams.get('continue') === 'true';

	const session = getSession(did);

	// Cold start detection
	if (!session) {
		if (continueEnrich) {
			return json({ coldStart: true });
		}
		return json({ error: 'No session found. Call /api/resolve first.' }, { status: 400 });
	}

	// Nothing left to enrich
	if (session.enrichQueue.length === 0) {
		return json({
			current: session.enrichment.size,
			total: session.enrichment.size,
			done: true
		});
	}

	// Initialise the enrich queue from the profile's top artists (first call)
	if (!continueEnrich && session.enrichQueue.length === 0 && session.profiles.has('all')) {
		const profile = session.profiles.get('all')!;
		session.enrichQueue = profile.topArtists.map((a) => a.name);
	}

	// Enrich a batch
	try {
		const result = await enrichArtistBatch(session.enrichQueue, session.enrichment);

		// Merge enriched data into the session
		for (const { name, info } of result.enriched) {
			session.enrichment.set(name, info);
		}

		// Update the enrich queue with remaining artists
		session.enrichQueue = result.remaining;

		updateSession(did, {
			enrichQueue: session.enrichQueue,
			enrichment: session.enrichment
		});

		return json({
			current: session.enrichment.size,
			total: session.enrichment.size + session.enrichQueue.length,
			done: session.enrichQueue.length === 0
		});
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Enrichment failed';
		return json({ error: message }, { status: 500 });
	}
};
