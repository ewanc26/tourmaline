import { resolveIdentifier, fetchBlueskyProfile } from '$lib/server/resolve';
import { createSession } from '$lib/server/session';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const identifier = decodeURIComponent(params.did);

	try {
		const identity = await resolveIdentifier(identifier);
		const bskyProfile = await fetchBlueskyProfile(identity.pdsUrl, identity.did);

		// Create a session for subsequent API calls
		createSession(identity.did, identity.pdsUrl, identity.handle);

		return {
			did: identity.did,
			handle: identity.handle,
			displayName: bskyProfile.displayName,
			avatar: bskyProfile.avatar
		};
	} catch (e) {
		return {
			did: '',
			handle: undefined,
			displayName: undefined,
			avatar: undefined,
			error: e instanceof Error ? e.message : 'Failed to resolve identifier'
		};
	}
};
