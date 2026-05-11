import { json } from '@sveltejs/kit';
import { setEnrichment, setEnrichmentBatch } from '$lib/cache/server';
import type { ArtistInfo } from '$lib/types';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as {
		name?: string;
		data?: ArtistInfo;
	};

	if (!body.name || !body.data) {
		return json({ error: 'name and data required' }, { status: 400 });
	}

	setEnrichment(body.name, body.data);
	return json({ ok: true });
};

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as {
		artists?: Array<{ name: string; data: ArtistInfo }>;
	};

	if (!body.artists || !Array.isArray(body.artists)) {
		return json({ error: 'artists array required' }, { status: 400 });
	}

	setEnrichmentBatch(body.artists);
	return json({ ok: true, count: body.artists.length });
};
