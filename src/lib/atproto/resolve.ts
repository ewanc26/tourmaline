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

export interface ProfileRecord {
	displayName?: string;
	avatar?: string;
}

/**
 * Extract the CID from an avatar/banner blob reference.
 * Raw profile records store blobs as { ref: { $link: 'cid...' } } objects,
 * not as URLs. This pulls the CID out so we can build a fetchable URL.
 */
function extractBlobCid(blob: unknown): string | null {
	if (!blob) return null;
	if (typeof blob === 'string') return blob;
	const obj = blob as Record<string, unknown>;
	if (obj.ref && typeof obj.ref === 'object' && (obj.ref as Record<string, unknown>).$link) {
		return (obj.ref as Record<string, unknown>).$link as string;
	}
	if (obj.cid) return obj.cid as string;
	return null;
}

export async function fetchBlueskyProfile(pdsUrl: string, did: string): Promise<ProfileRecord> {
	const url = `${pdsUrl}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(did)}&collection=app.bsky.actor.profile&rkey=self`;
	try {
		const res = await fetch(url);
		if (!res.ok) return {};
		const data = (await res.json()) as { value?: { displayName?: string; avatar?: unknown } };

		const avatarCid = extractBlobCid(data.value?.avatar);
		const avatar = avatarCid
			? `https://cdn.bsky.app/img/avatar/plain/${did}/${avatarCid}@jpeg`
			: undefined;

		return {
			displayName: data.value?.displayName,
			avatar
		};
	} catch {
		return {};
	}
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
			name: (a.artistName ?? a.name) as string,
			mbId: (a.artistMbId ?? a.mbId) as string | undefined
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
 * The callback may be async — it is awaited before fetching the next page,
 * so callers can tick() or otherwise flush the UI between batches.
 *
 * If `since` is provided, fetching stops once a scrobble with
 * playedTime <= since is encountered (records come in reverse chronological
 * order from the PDS, so this is the natural boundary).
 */
export async function fetchScrobblesBatched(
	pdsUrl: string,
	did: string,
	onBatch: (batch: TealScrobble[], totalSoFar: number) => void | Promise<void>,
	signal?: AbortSignal,
	since?: string
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
		let hitCursor = false;

		for (const record of data.records) {
			const scrobble = parseScrobble(record.value);

			// Stop if we've reached scrobbles we already have
			if (since && scrobble.playedTime <= since) {
				hitCursor = true;
				break;
			}

			batch.push(scrobble);
			allScrobbles.push(scrobble);
		}

		if (batch.length > 0) {
			await onBatch(batch, allScrobbles.length);
		}

		cursor = data.cursor;
		if (!cursor || data.records.length === 0 || hitCursor) break;
	}

	return allScrobbles;
}
