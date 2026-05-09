import type { TealScrobble } from '$lib/types';

const SLINGSHOT_URL = 'https://slingshot.microcosm.blue';

interface DidDocument {
	id: string;
	alsoKnownAs?: string[];
	service?: Array<{ id: string; type: string; serviceEndpoint: string }>;
}

export interface IdentityResult {
	did: string;
	pdsUrl: string;
	handle?: string;
}

export async function resolveIdentifier(identifier: string): Promise<IdentityResult> {
	let did: string;
	let handle: string | undefined;

	if (identifier.startsWith('did:')) {
		did = identifier;
	} else {
		const res = await fetch(
			`${SLINGSHOT_URL}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(identifier)}`
		);
		if (!res.ok) throw new Error(`Failed to resolve handle "${identifier}": ${res.status}`);
		const data = (await res.json()) as { did: string };
		did = data.did;
		handle = identifier;
	}

	const doc = await resolveDidDocument(did);

	if (!handle) {
		handle = doc.alsoKnownAs?.find((h) => h.startsWith('at://'))?.replace('at://', '');
	}

	const pdsService = doc.service?.find((s) => s.id === '#atproto_pds');
	const pdsUrl = pdsService?.serviceEndpoint;

	if (!pdsUrl) throw new Error('No PDS endpoint found in DID document');

	return { did, pdsUrl, handle };
}

async function resolveDidDocument(did: string): Promise<DidDocument> {
	if (did.startsWith('did:plc:')) {
		const res = await fetch(`https://plc.directory/${did}`);
		if (!res.ok) throw new Error(`Failed to resolve DID: ${res.status}`);
		return await res.json();
	}

	if (did.startsWith('did:web:')) {
		const domain = did.replace('did:web:', '');
		const res = await fetch(`https://${domain}/.well-known/did.json`);
		if (!res.ok) throw new Error(`Failed to resolve DID: ${res.status}`);
		return await res.json();
	}

	throw new Error(`Unsupported DID method: ${did}`);
}

interface ListRecordsResponse {
	records: Array<{
		uri: string;
		cid: string;
		value: Record<string, unknown>;
	}>;
	cursor?: string;
}

function parseScrobble(v: Record<string, unknown>): TealScrobble {
	return {
		trackName: v.trackName as string,
		artists: (v.artists as Array<Record<string, unknown>>)?.map((a) => ({
			name: a.name as string,
			mbId: a.mbId as string | undefined
		})) ?? [],
		releaseName: v.releaseName as string | undefined,
		trackMbId: v.trackMbId as string | undefined,
		recordingMbId: v.recordingMbId as string | undefined,
		releaseMbId: v.releaseMbId as string | undefined,
		duration: v.duration as number | undefined,
		originUrl: v.originUrl as string | undefined,
		playedTime: v.playedTime as string,
		submissionClientAgent: v.submissionClientAgent as string | undefined,
		musicServiceBaseDomain: v.musicServiceBaseDomain as string | undefined,
		trackDiscriminant: v.trackDiscriminant as string | undefined,
		releaseDiscriminant: v.releaseDiscriminant as string | undefined
	};
}

/**
 * Fetch scrobbles page by page, calling onBatch after each page.
 * Returns the complete list. The onBatch callback receives the newly
 * fetched scrobbles and the running total so far.
 */
export async function fetchScrobblesBatched(
	pdsUrl: string,
	did: string,
	onBatch: (batch: TealScrobble[], totalSoFar: number) => void,
	signal?: AbortSignal
): Promise<TealScrobble[]> {
	const limit = 100;
	let cursor: string | undefined;
	const allScrobbles: TealScrobble[] = [];

	while (true) {
		const params = new URLSearchParams({
			repo: did,
			collection: 'fm.teal.alpha.feed.play',
			limit: String(limit)
		});
		if (cursor) params.set('cursor', cursor);

		const url = `${pdsUrl}/xrpc/com.atproto.repo.listRecords?${params}`;
		const res = await fetch(url, { signal });

		if (!res.ok) {
			const body = await res.text();
			throw new Error(`listRecords failed: ${res.status} ${body}`);
		}

		const data: ListRecordsResponse = await res.json();
		const batch: TealScrobble[] = [];

		for (const record of data.records) {
			const scrobble = parseScrobble(record.value);
			batch.push(scrobble);
			allScrobbles.push(scrobble);
		}

		if (batch.length > 0) {
			onBatch(batch, allScrobbles.length);
		}

		cursor = data.cursor;
		if (!cursor || data.records.length === 0) break;
	}

	return allScrobbles;
}
