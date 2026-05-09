import type { TealScrobble } from '$lib/types';

const SLINGSHOT_URL = 'https://slingshot.microcosm.blue';

interface DidDocument {
	id: string;
	alsoKnownAs?: string[];
	service?: Array<{ id: string; type: string; serviceEndpoint: string }>;
}

/**
 * Resolve an identifier (DID or handle) to a DID and PDS URL.
 * Uses Slingshot for handle → DID resolution, then PLC/did:web for DID document.
 */
export async function resolveIdentifier(
	identifier: string
): Promise<{ did: string; pdsUrl: string; handle?: string }> {
	let did: string;
	let handle: string | undefined;

	// If it's already a DID, use it directly
	if (identifier.startsWith('did:')) {
		did = identifier;
	} else {
		// It's a handle — resolve via Slingshot
		const res = await fetch(
			`${SLINGSHOT_URL}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(identifier)}`
		);
		if (!res.ok) {
			throw new Error(`Failed to resolve handle "${identifier}": ${res.status}`);
		}
		const data = (await res.json()) as { did: string };
		did = data.did;
		handle = identifier;
	}

	// Resolve DID document to get PDS URL
	const doc = await resolveDidDocument(did);

	// Extract handle from DID document if we didn't already have it
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

export async function* fetchScrobbles(
	pdsUrl: string,
	did: string,
	options?: { limit?: number; signal?: AbortSignal }
): AsyncGenerator<TealScrobble> {
	const limit = options?.limit ?? 100;
	let cursor: string | undefined;

	while (true) {
		const params = new URLSearchParams({
			repo: did,
			collection: 'fm.teal.alpha.feed.play',
			limit: String(limit)
		});
		if (cursor) params.set('cursor', cursor);

		const url = `${pdsUrl}/xrpc/com.atproto.repo.listRecords?${params}`;
		const res = await fetch(url, { signal: options?.signal });

		if (!res.ok) {
			const body = await res.text();
			throw new Error(`listRecords failed: ${res.status} ${body}`);
		}

		const data: ListRecordsResponse = await res.json();

		for (const record of data.records) {
			const v = record.value;
			yield {
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

		cursor = data.cursor;
		if (!cursor || data.records.length === 0) break;
	}
}
