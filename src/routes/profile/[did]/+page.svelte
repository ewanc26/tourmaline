<script lang="ts">
	import { onMount } from 'svelte';
	import { resolveIdentifier, fetchScrobblesBatched, fetchBlueskyProfile } from '$lib/atproto/resolve';
	import { Aggregator } from '$lib/analysis/aggregator';
	import { buildGenreProfile, buildMonthlyGenres } from '$lib/analysis/genres';
	import { buildTimeline } from '$lib/analysis/timeline';
	import { diversityScore, calculateGini } from '$lib/analysis/diversity';
	import { calculateObscurity } from '$lib/analysis/obscurity';
	import { buildMoodProfile } from '$lib/analysis/mood';
	import { buildEraProfile } from '$lib/analysis/era';
	import { buildRemarkableDays } from '$lib/analysis/remarkable-days';
	import { buildDiscoveredArtists } from '$lib/analysis/discovery';
	import { enrichArtist } from '$lib/enrich/musicbrainz';
	import { enrichWithLastfm } from '$lib/enrich/lastfm';
	import { getArtistImage } from '$lib/enrich/deezer';
	import { renderNoiseAvatar } from '@ewanc26/noise-avatar';
	import type { ArtistInfo, ListenerProfile, TealScrobble } from '$lib/types';
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
		// MusicBrainz
		try {
			const info = await enrichArtist(name);
			if (info) {
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
					artistInfos.set(name, { ...existing, ...lfmData });
				} else {
					artistInfos.set(name, {
						name,
						genres: [],
						tags: lfmData.tags ?? [],
						similar: lfmData.similar ?? [],
						listenerCount: lfmData.listenerCount,
						playCount: lfmData.playCount,
						imageUrl: lfmData.imageUrl
					});
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
						artistInfos.set(name, { ...existing, imageUrl });
					} else {
						artistInfos.set(name, { name, genres: [], tags: [], similar: [], imageUrl });
					}
					console.log(`[tourmaline] [${i + 1}/${total}] ${name} → Deezer image: ${imageUrl}`);
				} else {
					console.log(`[tourmaline] [${i + 1}/${total}] ${name} → Deezer: no image`);
				}
			} catch (e) {
				console.warn(`[tourmaline] [${i + 1}/${total}] ${name} → Deezer failed:`, e);
			}
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
			serviceOrigins: new Map(),
			monthlyGenres: [],
			remarkableDays: [],
			discoveredArtists: []
		};
	}

	function updateProfile(data: ReturnType<Aggregator['snapshot']>) {
		const genres = buildGenreProfile(data, artistInfos);
		const timeline = buildTimeline(data);
		const diversity = diversityScore(data);
		const gini = calculateGini(data);
		const obscurity = calculateObscurity(data, artistInfos);
		const mood = buildMoodProfile(data, artistInfos);
		const era = buildEraProfile(data, artistInfos);
		const monthlyGenres = buildMonthlyGenres(data, artistInfos);
		const remarkableDays = buildRemarkableDays(data);
		const discoveredArtists = buildDiscoveredArtists(data, artistInfos);

		profile = {
			did,
			handle,
			totalScrobbles: data.totalScrobbles,
			uniqueArtists: data.uniqueArtists,
			uniqueTracks: data.uniqueTracks,
			totalMinutes: data.totalMinutes,
			topArtists: data.topArtists.map((a) => ({
				...a,
				imageUrl: artistInfos.get(a.name)?.imageUrl
			})),
			topTracks: data.topTracks,
			topAlbums: data.topAlbums,
			genres,
			timeline,
			dailyScrobbles: [...data.dailyScrobbles.entries()]
				.map(([date, count]) => ({ date, count }))
				.sort((a, b) => a.date.localeCompare(b.date)),
			era,
			diversityScore: diversity,
			giniCoefficient: gini,
			obscurityIndex: obscurity,
			mood,
			scrobblesByHour: data.scrobblesByHour,
			serviceOrigins: data.serviceOrigins,
			monthlyGenres,
			remarkableDays,
			discoveredArtists
		};
	}

	onMount(async () => {
		const identifier = decodeURIComponent(window.location.pathname.split('/').pop() ?? '');

		// Expose Last.fm API key to client-side enrichment
		if (data.lastfmApiKey) {
			(window as unknown as Record<string, string>).__LASTFM_API_KEY = data.lastfmApiKey;
		}

		const aggregator = new Aggregator();
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
				aggregator.add(cached.scrobbles);
				loaded = cached.scrobbles.length;
				cursor = cached.cursor;
				updateProfile(aggregator.snapshot());
				phase = 'complete';
				console.log(`[tourmaline] loaded ${cached.scrobbles.length} scrobbles from cache (cursor: ${cursor})`);
			}

			// 3. Fetch scrobbles from PDS (incremental if cache hit)
			phase = 'fetching';
			const fetchStart = performance.now();
			const newScrobbles = await fetchScrobblesBatched(
				pdsUrl,
				did,
				async (batch, totalSoFar) => {
					aggregator.add(batch);
					loaded = totalSoFar;
					updateProfile(aggregator.snapshot());
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
				? [...newScrobbles, ...cached.scrobbles.filter(
						(s) => !newScrobbles.some((n) => n.playedTime === s.playedTime && n.trackName === s.trackName)
					)]
				: [...newScrobbles];
			if (allScrobbles.length > 0 && cursor) {
				await writeCache(did, allScrobbles, cursor);
			}

			// 4. Enrich ALL artists, sorted by play count — 6 concurrent workers
			phase = 'enriching';
			const snap = aggregator.snapshot();
			const allArtists = [...snap.artistPlayCounts.entries()]
				.sort((a, b) => b[1] - a[1])
				.map(([name]) => name);
			enrichProgress = { current: 0, total: allArtists.length };
			console.log(`[tourmaline] enriching ${allArtists.length} artists (6 concurrent)`);

			await runConcurrent(
				allArtists,
				6,
				async (name) => {
					await enrichOneArtist(name, enrichProgress.current, allArtists.length);
				},
				async () => {
					enrichProgress.current++;
					updateProfile(aggregator.snapshot());
					await yieldFrame();
				}
			);

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

	<!-- Profile content — live updates as data streams in -->
	{#if profile && profile.totalScrobbles > 0}
		<!-- Stats row -->
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

		<!-- Minutes listened hero -->
		{#if profile.totalMinutes > 0}
			<div class="mb-6 sm:mb-8">
				<MinutesListened minutes={profile.totalMinutes} />
			</div>
		{/if}

		<!-- Listening stats (streaks, biggest day) -->
		{#if profile.dailyScrobbles.length > 0}
			<div class="mb-6 sm:mb-8">
				<ListeningStats dailyScrobbles={profile.dailyScrobbles} totalScrobbles={profile.totalScrobbles} />
			</div>
		{/if}

		<!-- Service origins -->
		{#if profile.serviceOrigins.size > 0}
			<div class="mb-6 sm:mb-8">
				<p class="mb-2 font-mono text-xs uppercase tracking-wide text-[var(--text-dim)]">Scrobble sources</p>
				<ServiceOrigins origins={profile.serviceOrigins} />
			</div>
		{/if}

		<!-- Personality card -->
		{#if profile.genres.length > 0}
			<div class="mb-8">
				<PersonalityCard profile={profile} displayName={bskyDisplayName ?? handle ?? did} />
			</div>
		{/if}

		<!-- Charts row -->
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

		<!-- Listening clock -->
		{#if profile.scrobblesByHour.some((n) => n > 0)}
			<div class="mb-6 rounded border border-[var(--border)] bg-[var(--surface)] p-3 sm:mb-8 sm:p-4">
				<h2 class="mb-3 text-base font-semibold sm:mb-4 sm:text-lg">Listening Clock</h2>
				<ListeningClock scrobblesByHour={profile.scrobblesByHour} />
			</div>
		{/if}

		<!-- Timeline -->
		{#if profile.timeline.length > 0}
			<div class="mb-6 rounded border border-[var(--border)] bg-[var(--surface)] p-3 sm:mb-8 sm:p-4">
				<h2 class="mb-3 text-base font-semibold sm:mb-4 sm:text-lg">Listening Timeline</h2>
				<TimelineHeatmap dailyScrobbles={profile.dailyScrobbles} />
			</div>
		{/if}

		<!-- Era -->
		{#if profile.era.length > 0}
			<div class="mb-6 rounded border border-[var(--border)] bg-[var(--surface)] p-3 sm:mb-8 sm:p-4">
				<h2 class="mb-3 text-base font-semibold sm:mb-4 sm:text-lg">Era Preference</h2>
				<EraBarChart era={profile.era} />
			</div>
		{/if}

		<!-- Remarkable days -->
		{#if profile.remarkableDays.length > 0}
			<div class="mb-6 sm:mb-8">
				<RemarkableDays days={profile.remarkableDays} />
			</div>
		{/if}

		<!-- Music evolution -->
		{#if profile.monthlyGenres.length >= 3}
			<div class="mb-6 sm:mb-8">
				<MusicEvolution monthlyGenres={profile.monthlyGenres} />
			</div>
		{/if}

		<!-- Discovery -->
		{#if profile.discoveredArtists.length > 0}
			<div class="mb-6 sm:mb-8">
				<Discovery artists={profile.discoveredArtists} />
			</div>
		{/if}

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

		<!-- Yearly wrapped card -->
		<div class="mt-8">
			<YearlyWrapped profile={profile} displayName={bskyDisplayName ?? handle ?? did} />
		</div>
	{/if}
</div>
