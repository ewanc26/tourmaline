import type { TealScrobble } from '$lib/types';

interface DidDocument {
	id: string;
	alsoKnownAs?: string[];
	service?: Array<{ id: string; type: string; serviceEndpoint: string }>;
}

export async function resolveDid(did: string): Promise<{ pdsUrl: string; handle?: string }> {
	let doc: DidDocument;

	if (did.startsWith('did:plc:')) {
		const res = await fetch(`https://plc.directory/${did}`);
		if (!res.ok) throw new Error(`Failed to resolve DID: ${res.status}`);
		doc = await res.json();
	} else if (did.startsWith('did:web:')) {
		const domain = did.replace('did:web:', '');
		const res = await fetch(`https://${domain}/.well-known/did.json`);
		if (!res.ok) throw new Error(`Failed to resolve DID: ${res.status}`);
		doc = await res.json();
	} else {
		throw new Error(`Unsupported DID method: ${did}`);
	}

	const handle = doc.alsoKnownAs?.find((h) => h.startsWith('at://'))?.replace('at://', '');
	const pdsService = doc.service?.find((s) => s.id === '#atproto_pds');
	const pdsUrl = pdsService?.serviceEndpoint;

	if (!pdsUrl) throw new Error('No PDS endpoint found in DID document');

	return { pdsUrl, handle };
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
