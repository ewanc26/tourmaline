import type { TealScrobble, ArtistInfo, ListenerProfile } from '$lib/types';
import type { SessionStats } from '$lib/analysis/sessions';
import type { OnThisDayEntry } from '$lib/analysis/on-this-day';
import type { StoryRecap as StoryRecapData } from '$lib/analysis/story-recap';
import type { PersonalityProfile } from '$lib/analysis/personality';

const SESSION_TTL = 10 * 60 * 1000; // 10 minutes

export interface Session {
	did: string;
	pdsUrl: string;
	handle?: string;
	scrobbles: TealScrobble[];
	cursor: string | null; // PDS pagination cursor (null = fetch done)
	fetchDone: boolean;
	profiles: Map<string, ListenerProfile>; // keyed by date range preset
	sessionStats: SessionStats | null;
	onThisDay: OnThisDayEntry[];
	storyRecap: StoryRecapData | null;
	personality: PersonalityProfile | null;
	enrichQueue: string[]; // remaining artists to enrich
	enrichment: Map<string, ArtistInfo>;
	createdAt: number;
}

const sessions = new Map<string, Session>();

/** Clean up expired sessions. */
function cleanup() {
	const now = Date.now();
	for (const [key, session] of sessions) {
		if (now - session.createdAt > SESSION_TTL) {
			sessions.delete(key);
		}
	}
}

export function getSession(did: string): Session | null {
	cleanup();
	return sessions.get(did) ?? null;
}

export function createSession(did: string, pdsUrl: string, handle?: string): Session {
	const session: Session = {
		did,
		pdsUrl,
		handle,
		scrobbles: [],
		cursor: null,
		fetchDone: false,
		profiles: new Map(),
		sessionStats: null,
		onThisDay: [],
		storyRecap: null,
		personality: null,
		enrichQueue: [],
		enrichment: new Map(),
		createdAt: Date.now()
	};
	sessions.set(did, session);
	return session;
}

export function updateSession(did: string, partial: Partial<Session>): Session | null {
	const session = sessions.get(did);
	if (!session) return null;
	Object.assign(session, partial);
	return session;
}
