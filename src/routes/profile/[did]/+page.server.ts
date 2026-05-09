import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return {
		lastfmApiKey: process.env.LASTFM_API_KEY ?? null
	};
};
