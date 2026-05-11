<script lang="ts">
	import { onMount } from 'svelte';
	import { resolveIdentifier, fetchScrobblesBatched, fetchBlueskyProfile } from '$lib/atproto/resolve';
	import { enrichArtist } from '$lib/enrich/musicbrainz';
	import { enrichWithLastfm } from '$lib/enrich/lastfm';
	import { getArtistImage } from '$lib/enrich/deezer';
	import { renderNoiseAvatar } from '@ewanc26/noise-avatar';
	import type { ArtistInfo, ListenerProfile, TealScrobble } from '$lib/types';
	import type { SessionStats } from '$lib/analysis/sessions';
	import type { OnThisDayEntry } from '$lib/analysis/on-this-day';
	import type { StoryRecap as StoryRecapData } from '$lib/analysis/story-recap';
	import type { PersonalityProfile } from '$lib/analysis/personality';
	import type { DateRangePreset } from '$lib/analysis/date-range';
	import { getCached as getIdbCache, setCached as setIdbCache } from '$lib/cache/client';
	import GenreChart from './GenreChart.svelte';
	import TimelineHeatmap from './TimelineHeatmap.svelte';
	import MoodRadar from './MoodRadar.svelte';
	import EraBarChart from './EraBarChart.svelte';
	import PersonalityCard from './PersonalityCard.svelte';
	import ListeningClock from './ListeningClock.svelte';
	import ListeningStats from './ListeningStats.svelte';
	import ServiceOrigins from './ServiceOrigins.svelte';
	import MinutesListened from './MinutesListened.svelte';
	import MusicEvolution from './MusicEvolution.svelte';
	import RemarkableDays from './RemarkableDays.svelte';
	import Discovery from './Discovery.svelte';
	import YearlyWrapped from './YearlyWrapped.svelte';
	import ProfileTabs from './ProfileTabs.svelte';
	import ListeningSessions from './ListeningSessions.svelte';
	import OnThisDay from './OnThisDay.svelte';
	import DateRangePicker from './DateRangePicker.svelte';
	import ListeningPhases from './ListeningPhases.svelte';
	import StoryRecap from './StoryRecap.svelte';

	function noiseAvatar(canvas: HTMLCanvasElement, seed: string) {
		renderNoiseAvatar(canvas, seed, { displaySize: 32, gridSize: 5 });
		return {
			update(newSeed: string) {
				renderNoiseAvatar(canvas, newSeed, { displaySize: 32, gridSize: 5 });
			}
		};
	}

	let { data }: { data: { lastfmApiKey: string | null } } = $props();

	let phase = $state<'idle' | 'resolving' | 'fetching' | 'enriching' | 'complete' | 'error'>('idle');
	let fromCache = $state(false);
	let did = $state('');
	let handle = $state<string | undefined>();
	let bskyDisplayName = $state<string | undefined>();
	let bskyAvatar = $state<string | undefined>();
	let loaded = $state(0);
	let enrichProgress = $state({ current: 0, total: 0 });
	let error = $state('');
	let profile = $state<ListenerProfile | null>(null);
	let sessionStats = $state<SessionStats | null>(null);
	let onThisDayEntries = $state<OnThisDayEntry[]>([]);
	let storyRecap_ = $state<StoryRecapData | null>(null);
	let personality = $state<PersonalityProfile | null>(null);
	let rawScrobbles = $state<TealScrobble[]>([]);

	type Tab = 'overview' | 'taste' | 'habits' | 'catalogue';
	let activeTab = $state<Tab>('overview');

	// Read tab from URL on mount
	const urlTab = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tab') : null;
	if (urlTab === 'taste' || urlTab === 'habits' || urlTab === 'catalogue') {
		activeTab = urlTab;
	}

	let dateRange = $state<DateRangePreset>('all');
	let recomputing = $state(false);

	const artistInfos = new Map<string, ArtistInfo>();

	/** Write scrobbles + cursor to both IndexedDB and server cache. */
	async function writeCache(did: string, scrobbles: TealScrobble[], cursor: string): Promise<void> {
		// IndexedDB (client-side)
		await setIdbCache(did, { cursor, scrobbles, fetchedAt: Date.now() });

		// Server SQLite
		try {
			await fetch('/api/scrobbles/cache', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ did, scrobbles, cursor })
			});
		} catch {
			// server cache write is non-critical
		}
	}

	/** Fetch the computed profile from the server endpoint. */
	async function fetchServerProfile(range?: DateRangePreset): Promise<void> {
		if (!did) return;
		const rangeParam = range ?? dateRange;
		const url = `/api/profile/${encodeURIComponent(did)}?range=${rangeParam}`;
		try {
			const res = await fetch(url);
			if (!res.ok) return;
			const body = await res.json();
			if (body.cached && body.profile) {
				profile = body.profile;
				sessionStats = body.sessionStats ?? null;
				onThisDayEntries = body.onThisDay ?? [];
				storyRecap_ = body.storyRecap ?? null;
				personality = body.personality ?? null;
			}
		} catch {
			// server profile fetch failure — keep existing profile
		}
	}

	/** Push enrichment data to the server in batches. */
	let enrichmentBatch: Array<{ name: string; data: ArtistInfo }> = [];
	let enrichmentBatchTimer: ReturnType<typeof setTimeout> | null = null;

	function pushEnrichment(name: string, info: ArtistInfo): void {
		enrichmentBatch.push({ name, data: info });
		if (!enrichmentBatchTimer) {
			enrichmentBatchTimer = setTimeout(flushEnrichment, 500);
		}
		if (enrichmentBatch.length >= 5) {
			flushEnrichment();
		}
	}

	async function flushEnrichment(): Promise<void> {
		if (enrichmentBatch.length === 0) return;
		const batch = enrichmentBatch;
		enrichmentBatch = [];
		if (enrichmentBatchTimer) {
			clearTimeout(enrichmentBatchTimer);
			enrichmentBatchTimer = null;
		}
		try {
			await fetch('/api/enrichment', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ artists: batch })
			});
		} catch {
			// enrichment push is non-critical
		}
	}

	/** Yield to the browser so it can paint before we continue. */
	function yieldFrame(): Promise<void> {
		return new Promise((resolve) => requestAnimationFrame(() => resolve()));
	}

	/**
	 * Run tasks from a queue with N concurrent workers.
	 * Each worker picks the next item, calls `process(item)`, then
	 * calls `onDone()` (which can update UI and yield). Workers
	 * keep pulling until the queue is drained.
	 */
	async function runConcurrent<T>(
		items: T[],
		concurrency: number,
		process: (item: T) => Promise<void>,
		onDone: () => Promise<void>
	): Promise<void> {
		let next = 0;
		async function worker() {
			while (next < items.length) {
				const item = items[next++];
				await process(item);
				await onDone();
			}
		}
		await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
	}

	/** Enrich a single artist with MusicBrainz, Last.fm, and Deezer data. */
	async function enrichOneArtist(name: string, i: number, total: number): Promise<void> {
		let info: ArtistInfo | undefined;

		// MusicBrainz
		try {
			const mbInfo = await enrichArtist(name);
			if (mbInfo) {
				info = mbInfo;
				artistInfos.set(name, info);
				console.log(`[tourmaline] [${i + 1}/${total}] ${name} → MusicBrainz (genres: ${info.genres.length}, tags: ${info.tags.length})`);
			} else {
				console.log(`[tourmaline] [${i + 1}/${total}] ${name} → MusicBrainz: no match`);
			}
		} catch (e) {
			console.warn(`[tourmaline] [${i + 1}/${total}] ${name} → MusicBrainz failed:`, e);
		}

		// Last.fm
		try {
			const lfmData = await enrichWithLastfm(name);
			if (lfmData) {
				const existing = artistInfos.get(name);
				if (existing) {
					info = { ...existing, ...lfmData };
					artistInfos.set(name, info);
				} else {
					info = {
						name,
						genres: [],
						tags: lfmData.tags ?? [],
						similar: lfmData.similar ?? [],
						listenerCount: lfmData.listenerCount,
						playCount: lfmData.playCount,
						imageUrl: lfmData.imageUrl
					};
					artistInfos.set(name, info);
				}
				console.log(`[tourmaline] [${i + 1}/${total}] ${name} → Last.fm (listeners: ${lfmData.listenerCount ?? '?'}, image: ${lfmData.imageUrl ? 'yes' : 'no'})`);
			}
		} catch (e) {
			console.warn(`[tourmaline] [${i + 1}/${total}] ${name} → Last.fm failed:`, e);
		}

		// Deezer image fallback
		const existing = artistInfos.get(name);
		if (!existing?.imageUrl) {
			try {
				const imageUrl = await getArtistImage(name);
				if (imageUrl) {
					if (existing) {
						info = { ...existing, imageUrl };
						artistInfos.set(name, info);
					} else {
						info = { name, genres: [], tags: [], similar: [], imageUrl };
						artistInfos.set(name, info);
					}
					console.log(`[tourmaline] [${i + 1}/${total}] ${name} → Deezer image: ${imageUrl}`);
				} else {
					console.log(`[tourmaline] [${i + 1}/${total}] ${name} → Deezer: no image`);
				}
			} catch (e) {
				console.warn(`[tourmaline] [${i + 1}/${total}] ${name} → Deezer failed:`, e);
			}
		}

		// Push enrichment data to server
		if (info) {
			pushEnrichment(name, info);
		}
	}

	function emptyProfile(did: string, handle?: string): ListenerProfile {
		return {
			did,
			handle,
			totalScrobbles: 0,
			uniqueArtists: 0,
			uniqueTracks: 0,
			totalMinutes: 0,
			topArtists: [],
			topTracks: [],
			topAlbums: [],
			genres: [],
			timeline: [],
			dailyScrobbles: [],
			era: [],
			diversityScore: 0,
			giniCoefficient: 0,
			obscurityIndex: 50,
			mood: {},
			scrobblesByHour: new Array(24).fill(0),
			serviceOrigins: {},
			monthlyGenres: [],
			remarkableDays: [],
			discoveredArtists: [],
			phases: []
		};
	}

	// React to date range changes — fetch from server
	let profileReady = $state(false);

	$effect(() => {
		const range = dateRange; // explicit dependency
		if (profileReady && did && profile && profile.totalScrobbles > 0) {
			recomputing = true;
			fetchServerProfile(range).finally(() => { recomputing = false; });
		}
	});

	// Re-fetch profile periodically during enrichment
	let enrichProfileTimer: ReturnType<typeof setInterval> | null = null;

	onMount(async () => {
		const identifier = decodeURIComponent(window.location.pathname.split('/').pop() ?? '');

		// Expose Last.fm API key to client-side enrichment
		if (data.lastfmApiKey) {
			(window as unknown as Record<string, string>).__LASTFM_API_KEY = data.lastfmApiKey;
		}

		const t0 = performance.now();
		let pdsUrl = '';
		let cursor: string | undefined;

		try {
			// 1. Resolve identity
			phase = 'resolving';
			console.log(`[tourmaline] resolving identity: ${identifier}`);
			const identity = await resolveIdentifier(identifier);
			did = identity.did;
			handle = identity.handle;
			pdsUrl = identity.pdsUrl;
			profile = emptyProfile(did, handle);
			console.log(`[tourmaline] resolved → did: ${did}, handle: ${handle ?? '(none)'}, pds: ${pdsUrl}`);

			// Fetch Bluesky profile for display name and avatar
			const bskyProfile = await fetchBlueskyProfile(pdsUrl, did);
			bskyDisplayName = bskyProfile.displayName;
			bskyAvatar = bskyProfile.avatar;
			console.log(`[tourmaline] bsky profile → displayName: ${bskyDisplayName ?? '(none)'}, avatar: ${bskyAvatar ? 'yes' : 'no'}`);

			// 2. Check client-side cache
			const cached = await getIdbCache(did);
			if (cached && cached.scrobbles.length > 0) {
				fromCache = true;
				loaded = cached.scrobbles.length;
				cursor = cached.cursor;
				rawScrobbles = cached.scrobbles;
			}

			// 3. Fetch scrobbles from PDS (incremental if cache hit)
			phase = 'fetching';
			const fetchStart = performance.now();
			const newScrobbles = await fetchScrobblesBatched(
				pdsUrl,
				did,
				async (batch, totalSoFar) => {
					loaded = totalSoFar;
					await yieldFrame();
				},
				undefined,
				cursor
			);
			console.log(`[tourmaline] fetched ${newScrobbles.length} new scrobbles in ${((performance.now() - fetchStart) / 1000).toFixed(1)}s`);

			// Update the cursor to the most recent scrobble
			if (newScrobbles.length > 0) {
				cursor = newScrobbles[0].playedTime;
			}

			// Write back to both caches (deduplicate — scrobbles at the
			// cursor timestamp may appear in both old and new sets)
			const allScrobbles = cached
				? (() => {
						const newKeys = new Set(
							newScrobbles.map((s) => `${s.playedTime}|||${s.trackName}`)
						);
						return [...newScrobbles, ...cached.scrobbles.filter(
							(s) => !newKeys.has(`${s.playedTime}|||${s.trackName}`)
						)];
					})()
				: [...newScrobbles];
			if (allScrobbles.length > 0 && cursor) {
				await writeCache(did, allScrobbles, cursor);
			}
			rawScrobbles = allScrobbles;

			// 4. Fetch profile from server (server runs all analysis)
			await fetchServerProfile();
			phase = 'complete';
			profileReady = true;
			console.log(`[tourmaline] loaded ${loaded} scrobbles, profile fetched from server`);

			// 5. Enrich ALL artists, sorted by play count — 6 concurrent workers
			if (profile && profile.topArtists.length > 0) {
				phase = 'enriching';
				const allArtists = [...profile.topArtists]
					.sort((a, b) => b.count - a.count)
					.map((a) => a.name);
				enrichProgress = { current: 0, total: allArtists.length };
				console.log(`[tourmaline] enriching ${allArtists.length} artists (6 concurrent)`);

				// Re-fetch profile from server every 2 seconds during enrichment
				enrichProfileTimer = setInterval(() => {
					fetchServerProfile();
				}, 2000);

				await runConcurrent(
					allArtists,
					6,
					async (name) => {
						await enrichOneArtist(name, enrichProgress.current, allArtists.length);
					},
					async () => {
						enrichProgress.current++;
						await yieldFrame();
					}
				);

				// Flush remaining enrichment data and fetch final profile
				await flushEnrichment();
				if (enrichProfileTimer) {
					clearInterval(enrichProfileTimer);
					enrichProfileTimer = null;
				}
				await fetchServerProfile();
			}

			phase = 'complete';
			console.log(`[tourmaline] complete in ${((performance.now() - t0) / 1000).toFixed(1)}s — ${loaded} scrobbles, ${artistInfos.size} artists enriched`);
		} catch (e) {
			phase = 'error';
			error = e instanceof Error ? e.message : String(e);
			console.error(`[tourmaline] error:`, e);
		}
	});
</script>

<svelte:head>
	<title>{bskyDisplayName ?? handle ?? did} — Tourmaline</title>
	<meta name="description" content="Listening profile for {bskyDisplayName ?? handle ?? did}" />
</svelte:head>

<div class="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-8">
	<header class="mb-6 sm:mb-8">
		<div class="flex items-center gap-3 sm:gap-4">
			{#if bskyAvatar}
				<img src={bskyAvatar} alt="" class="h-10 w-10 shrink-0 rounded-full border border-[var(--border)] sm:h-12 sm:w-12" />
			{/if}
			<div class="min-w-0">
				<h1 class="truncate text-xl font-bold sm:text-2xl">
					{bskyDisplayName ?? handle ?? did}
				</h1>
				{#if bskyDisplayName && handle}
					<p class="truncate text-sm text-[var(--text-muted)]">@{handle}</p>
				{/if}
				{#if did}
					<p class="mt-0.5 truncate font-mono text-xs text-[var(--text-dim)]">{did}</p>
				{/if}
			</div>
		</div>
	</header>

	<!-- Loading state -->
	{#if phase !== 'complete' && phase !== 'error'}
		<div class="mb-8 rounded border border-[var(--border)] bg-[var(--surface)] p-6">
			{#if phase === 'resolving'}
				<div class="flex items-center gap-3">
					<div class="h-2 w-2 animate-pulse rounded-full bg-green-500"></div>
					<span class="text-sm text-[var(--text)]">Resolving identity...</span>
				</div>
			{:else if phase === 'fetching'}
				<div class="flex items-center gap-3">
					<div class="h-2 w-2 animate-pulse rounded-full bg-green-500"></div>
					<span class="text-sm text-[var(--text)]">
						{fromCache ? 'Checking for new scrobbles...' : 'Fetching scrobbles...'}
					</span>
				</div>
				{#if !fromCache}
					<div class="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
						<div class="h-full rounded-full bg-green-600 transition-all duration-300" style="width: {loaded > 0 ? '100' : '0'}%"></div>
					</div>
					<p class="mt-2 text-xs text-[var(--text-dim)]">{loaded.toLocaleString()} scrobbles loaded</p>
				{/if}
			{:else if phase === 'enriching'}
				<div class="flex items-center gap-3">
					<div class="h-2 w-2 animate-pulse rounded-full bg-green-500"></div>
					<span class="text-sm text-[var(--text)]">Enriching artist data... ({enrichProgress.current}/{enrichProgress.total})</span>
				</div>
				<div class="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
					<div class="h-full rounded-full bg-green-600 transition-all duration-300" style="width: {enrichProgress.total > 0 ? (enrichProgress.current / enrichProgress.total * 100) : 0}%"></div>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Error state -->
	{#if phase === 'error'}
		<div class="mb-8 rounded border border-red-800 bg-red-900/30 p-6">
			<p class="text-red-400">{error}</p>
		</div>
	{/if}

	<!-- Profile content -->
	{#if profile && profile.totalScrobbles > 0}
		<!-- Stats row (always visible) -->
		<div class="mb-6 grid grid-cols-2 gap-3 sm:mb-8 sm:gap-4 sm:grid-cols-4">
			<div class="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-3 sm:p-4">
				<p class="text-xs text-[var(--text-muted)]">Scrobbles</p>
				<p class="text-xl font-bold sm:text-2xl">{profile.totalScrobbles.toLocaleString()}</p>
			</div>
			<div class="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-3 sm:p-4">
				<p class="text-xs text-[var(--text-muted)]">Unique Artists</p>
				<p class="text-xl font-bold sm:text-2xl">{profile.uniqueArtists.toLocaleString()}</p>
			</div>
			<div class="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-3 sm:p-4">
				<p class="text-xs text-[var(--text-muted)]">Diversity</p>
				<p class="text-xl font-bold sm:text-2xl">{profile.diversityScore}<span class="text-sm text-[var(--text-muted)]">/100</span></p>
			</div>
			<div class="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-3 sm:p-4">
				<p class="text-xs text-[var(--text-muted)]">Obscurity</p>
				<p class="text-xl font-bold sm:text-2xl">{profile.obscurityIndex}<span class="text-sm text-[var(--text-muted)]">/100</span></p>
			</div>
		</div>

		<!-- Date range picker -->
		<div class="mb-4 flex items-center gap-3 sm:mb-6">
			<DateRangePicker bind:value={dateRange} />
			{#if recomputing}
				<span class="text-xs text-[var(--text-dim)] animate-pulse">Recalculating…</span>
			{/if}
		</div>

		<!-- Tab navigation -->
		<ProfileTabs bind:activeTab />

		<!-- ── Overview tab ─────────────────────────────── -->
		{#if activeTab === 'overview'}
			<!-- Story recap -->
			{#if storyRecap_}
				<div class="mb-6 sm:mb-8">
					<StoryRecap recap={storyRecap_} />
				</div>
			{/if}

			{#if profile.totalMinutes > 0}
				<div class="mb-6 sm:mb-8">
					<MinutesListened minutes={profile.totalMinutes} />
				</div>
			{/if}

			{#if profile.dailyScrobbles.length > 0}
				<div class="mb-6 sm:mb-8">
					<ListeningStats dailyScrobbles={profile.dailyScrobbles} totalScrobbles={profile.totalScrobbles} />
				</div>
			{/if}

			{#if personality}
				<div class="mb-8">
					<PersonalityCard profile={profile} displayName={bskyDisplayName ?? handle ?? did} {personality} />
				</div>
			{/if}

			<div class="mt-8">
				<YearlyWrapped profile={profile} displayName={bskyDisplayName ?? handle ?? did} />
			</div>

		<!-- ── Taste tab ─────────────────────────────────── -->
		{:else if activeTab === 'taste'}
			<div class="mb-6 grid gap-4 sm:mb-8 sm:gap-8 lg:grid-cols-2">
				{#if profile.genres.length > 0}
					<div class="rounded border border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4">
						<h2 class="mb-3 text-base font-semibold sm:mb-4 sm:text-lg">Genre Profile</h2>
						<GenreChart genres={profile.genres} />
					</div>
				{/if}

				{#if Object.keys(profile.mood).length > 0}
					<div class="rounded border border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4">
						<h2 class="mb-3 text-base font-semibold sm:mb-4 sm:text-lg">Mood Profile</h2>
						<MoodRadar mood={profile.mood} />
					</div>
				{/if}
			</div>

			{#if profile.era.length > 0}
				<div class="mb-6 rounded border border-[var(--border)] bg-[var(--surface)] p-3 sm:mb-8 sm:p-4">
					<h2 class="mb-3 text-base font-semibold sm:mb-4 sm:text-lg">Era Preference</h2>
					<EraBarChart era={profile.era} />
				</div>
			{/if}

			{#if profile.monthlyGenres.length >= 3}
				<div class="mb-6 sm:mb-8">
					<MusicEvolution monthlyGenres={profile.monthlyGenres} />
				</div>
			{/if}

			{#if profile.phases.length >= 2}
				<div class="mb-6 sm:mb-8">
					<ListeningPhases phases={profile.phases} />
				</div>
			{/if}

			{#if profile.remarkableDays.length > 0}
				<div class="mb-6 sm:mb-8">
					<RemarkableDays days={profile.remarkableDays} />
				</div>
			{/if}

		<!-- ── Habits tab ────────────────────────────────── -->
		{:else if activeTab === 'habits'}
			{#if profile.scrobblesByHour.some((n) => n > 0)}
				<div class="mb-6 rounded border border-[var(--border)] bg-[var(--surface)] p-3 sm:mb-8 sm:p-4">
					<h2 class="mb-3 text-base font-semibold sm:mb-4 sm:text-lg">Listening Clock</h2>
					<ListeningClock scrobblesByHour={profile.scrobblesByHour} />
				</div>
			{/if}

			{#if profile.timeline.length > 0}
				<div class="mb-6 rounded border border-[var(--border)] bg-[var(--surface)] p-3 sm:mb-8 sm:p-4">
					<h2 class="mb-3 text-base font-semibold sm:mb-4 sm:text-lg">Listening Timeline</h2>
					<TimelineHeatmap dailyScrobbles={profile.dailyScrobbles} />
				</div>
			{/if}

			{#if Object.keys(profile.serviceOrigins).length > 0}
				<div class="mb-6 sm:mb-8">
					<p class="mb-2 font-mono text-xs uppercase tracking-wide text-[var(--text-dim)]">Scrobble sources</p>
					<ServiceOrigins origins={profile.serviceOrigins} />
				</div>
			{/if}

			{#if sessionStats}
				<div class="mb-6 sm:mb-8">
					<ListeningSessions stats={sessionStats} />
				</div>
			{/if}

		<!-- ── Catalogue tab ─────────────────────────────── -->
		{:else if activeTab === 'catalogue'}
			<!-- Top artists -->
			<div class="mb-6 overflow-hidden rounded border border-[var(--border)] bg-[var(--surface)] p-3 sm:mb-8 sm:p-4">
				<h2 class="mb-3 text-base font-semibold sm:mb-4 sm:text-lg">Top Artists</h2>
				<ol class="space-y-2">
					{#each profile.topArtists.slice(0, 25) as artist, i (artist.name)}
						<li class="flex items-center gap-2 overflow-hidden sm:gap-3">
							<span class="w-5 shrink-0 text-right text-xs text-[var(--text-muted)] sm:w-6 sm:text-sm">{i + 1}</span>
							{#if artist.imageUrl}
								<img src={artist.imageUrl} alt={artist.name} class="h-7 w-7 shrink-0 rounded sm:h-8 sm:w-8" />
							{:else}
								<canvas use:noiseAvatar={artist.name} class="h-7 w-7 shrink-0 rounded sm:h-8 sm:w-8"></canvas>
							{/if}
							<span class="min-w-0 shrink truncate">{artist.name}</span>
							<span class="shrink-0 font-mono text-xs text-[var(--text-muted)] sm:text-sm">{artist.count.toLocaleString()}</span>
						</li>
					{/each}
				</ol>
			</div>

			<!-- Top tracks + albums side by side -->
			<div class="grid gap-4 sm:gap-8 lg:grid-cols-2">
				<div class="overflow-hidden rounded border border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4">
					<h2 class="mb-3 text-base font-semibold sm:mb-4 sm:text-lg">Top Tracks</h2>
					<ol class="space-y-2">
						{#each profile.topTracks.slice(0, 25) as track, i (i)}
							<li class="flex items-center gap-2 overflow-hidden sm:gap-3">
								<span class="w-5 shrink-0 text-right text-xs text-[var(--text-muted)] sm:w-6 sm:text-sm">{i + 1}</span>
								<span class="min-w-0 shrink truncate">
									<span class="font-medium">{track.name}</span>
									<span class="text-xs text-[var(--text-muted)] sm:text-sm"> — {track.artist}</span>
								</span>
								<span class="shrink-0 font-mono text-xs text-[var(--text-muted)] sm:text-sm">{track.count.toLocaleString()}</span>
							</li>
						{/each}
					</ol>
				</div>

				<div class="overflow-hidden rounded border border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4">
					<h2 class="mb-3 text-base font-semibold sm:mb-4 sm:text-lg">Top Albums</h2>
					<ol class="space-y-2">
						{#each profile.topAlbums.slice(0, 25) as album, i (i)}
							<li class="flex items-center gap-2 overflow-hidden sm:gap-3">
								<span class="w-5 shrink-0 text-right text-xs text-[var(--text-muted)] sm:w-6 sm:text-sm">{i + 1}</span>
								<span class="min-w-0 shrink truncate">
									<span class="font-medium">{album.name}</span>
									<span class="text-xs text-[var(--text-muted)] sm:text-sm"> — {album.artist}</span>
								</span>
								<span class="shrink-0 font-mono text-xs text-[var(--text-muted)] sm:text-sm">{album.count.toLocaleString()}</span>
							</li>
						{/each}
					</ol>
				</div>
			</div>

			{#if profile.discoveredArtists.length > 0}
				<div class="mb-6 sm:mb-8">
					<Discovery artists={profile.discoveredArtists} />
				</div>
			{/if}

			{#if onThisDayEntries.length > 0}
				<div class="mb-6 sm:mb-8">
					<OnThisDay entries={onThisDayEntries} />
				</div>
			{/if}
		{/if}
	{/if}
</div>
