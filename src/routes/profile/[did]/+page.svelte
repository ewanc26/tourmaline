<script lang="ts">
	import { onMount } from 'svelte';
	import { resolveIdentifier, fetchScrobblesBatched, fetchBlueskyProfile } from '$lib/atproto/resolve';
	import { Aggregator } from '$lib/analysis/aggregator';
	import { buildGenreProfile } from '$lib/analysis/genres';
	import { buildTimeline } from '$lib/analysis/timeline';
	import { diversityScore } from '$lib/analysis/diversity';
	import { calculateObscurity } from '$lib/analysis/obscurity';
	import { buildMoodProfile } from '$lib/analysis/mood';
	import { enrichArtist } from '$lib/enrich/musicbrainz';
	import { enrichWithLastfm } from '$lib/enrich/lastfm';
	import { getArtistImage } from '$lib/enrich/deezer';
	import { renderNoiseAvatar } from '@ewanc26/noise-avatar';
	import type { ArtistInfo, ListenerProfile } from '$lib/types';
	import GenreChart from './GenreChart.svelte';
	import TimelineHeatmap from './TimelineHeatmap.svelte';
	import MoodRadar from './MoodRadar.svelte';
	import EraBarChart from './EraBarChart.svelte';
	import PersonalityCard from './PersonalityCard.svelte';

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
	let did = $state('');
	let handle = $state<string | undefined>();
	let bskyDisplayName = $state<string | undefined>();
	let bskyAvatar = $state<string | undefined>();
	let loaded = $state(0);
	let enrichProgress = $state({ current: 0, total: 0 });
	let error = $state('');
	let profile = $state<ListenerProfile | null>(null);

	const artistInfos = new Map<string, ArtistInfo>();

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
			topArtists: [],
			topTracks: [],
			topAlbums: [],
			genres: [],
			timeline: [],
			dailyScrobbles: [],
			era: [],
			diversityScore: 0,
			obscurityIndex: 50,
			mood: {}
		};
	}

	function updateProfile(data: ReturnType<Aggregator['snapshot']>) {
		const genres = buildGenreProfile(data, artistInfos);
		const timeline = buildTimeline(data);
		const diversity = diversityScore(data);
		const obscurity = calculateObscurity(data, artistInfos);
		const mood = buildMoodProfile(data, artistInfos);

		profile = {
			did,
			handle,
			totalScrobbles: data.totalScrobbles,
			uniqueArtists: data.uniqueArtists,
			uniqueTracks: data.uniqueTracks,
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
			era: [],
			diversityScore: diversity,
			obscurityIndex: obscurity,
			mood
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

		try {
			// 1. Resolve identity
			phase = 'resolving';
			console.log(`[tourmaline] resolving identity: ${identifier}`);
			const identity = await resolveIdentifier(identifier);
			did = identity.did;
			handle = identity.handle;
			profile = emptyProfile(did, handle);
			console.log(`[tourmaline] resolved → did: ${did}, handle: ${handle ?? '(none)'}, pds: ${identity.pdsUrl}`);

			// Fetch Bluesky profile for display name and avatar
			const bskyProfile = await fetchBlueskyProfile(identity.pdsUrl, did);
			bskyDisplayName = bskyProfile.displayName;
			bskyAvatar = bskyProfile.avatar;
			console.log(`[tourmaline] bsky profile → displayName: ${bskyDisplayName ?? '(none)'}, avatar: ${bskyAvatar ? 'yes' : 'no'}`);

			// 2. Fetch scrobbles
			phase = 'fetching';
			const fetchStart = performance.now();
			await fetchScrobblesBatched(identity.pdsUrl, did, async (batch, totalSoFar) => {
				aggregator.add(batch);
				loaded = totalSoFar;
				updateProfile(aggregator.snapshot());
				await yieldFrame();
			});
			console.log(`[tourmaline] fetched ${loaded} scrobbles in ${((performance.now() - fetchStart) / 1000).toFixed(1)}s`);

			// 3. Enrich top artists — 6 concurrent workers
			// Server-side rate limiting in the proxy routes handles API pacing.
			// MusicBrainz: 1 req/s, Last.fm: 5 req/s, Deezer: no limit.
			// 6 workers means ~6 artists processed in parallel (each hits all 3 APIs).
			phase = 'enriching';
			const topArtists = aggregator.snapshot().topArtists;
			enrichProgress = { current: 0, total: topArtists.length };
			console.log(`[tourmaline] enriching ${topArtists.length} artists (6 concurrent)`);

			await runConcurrent(
				topArtists,
				6,
				async ({ name }) => {
					await enrichOneArtist(name, 0, topArtists.length);
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

<div class="mx-auto max-w-6xl px-4 py-8">
	<header class="mb-8">
		<a href="/" class="text-sm text-gray-400 hover:text-white">&larr; Back</a>
		<div class="mt-2 flex items-center gap-4">
			{#if bskyAvatar}
				<img src={bskyAvatar} alt="" class="h-12 w-12 rounded-full border border-gray-700" />
			{/if}
			<div>
				<h1 class="text-2xl font-bold">
					{bskyDisplayName ?? handle ?? did}
				</h1>
				{#if bskyDisplayName && handle}
					<p class="text-sm text-gray-400">@{handle}</p>
				{/if}
				{#if did}
					<p class="mt-0.5 font-mono text-xs text-gray-500">{did}</p>
				{/if}
			</div>
		</div>
	</header>

	<!-- Loading state -->
	{#if phase !== 'complete' && phase !== 'error'}
		<div class="mb-8 rounded border border-gray-700 bg-gray-800 p-6">
			{#if phase === 'resolving'}
				<div class="flex items-center gap-3">
					<div class="h-2 w-2 animate-pulse rounded-full bg-green-500"></div>
					<span class="text-sm text-gray-300">Resolving identity...</span>
				</div>
			{:else if phase === 'fetching'}
				<div class="flex items-center gap-3">
					<div class="h-2 w-2 animate-pulse rounded-full bg-green-500"></div>
					<span class="text-sm text-gray-300">Fetching scrobbles...</span>
				</div>
				<div class="mt-3 h-2 overflow-hidden rounded-full bg-gray-700">
					<div class="h-full rounded-full bg-green-600 transition-all duration-300" style="width: {loaded > 0 ? '100' : '0'}%"></div>
				</div>
				<p class="mt-2 text-xs text-gray-500">{loaded.toLocaleString()} scrobbles loaded</p>
			{:else if phase === 'enriching'}
				<div class="flex items-center gap-3">
					<div class="h-2 w-2 animate-pulse rounded-full bg-green-500"></div>
					<span class="text-sm text-gray-300">Enriching artist data... ({enrichProgress.current}/{enrichProgress.total})</span>
				</div>
				<div class="mt-3 h-2 overflow-hidden rounded-full bg-gray-700">
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
		<div class="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
			<div class="rounded border border-gray-700 bg-gray-800 p-4">
				<p class="text-xs text-gray-400">Scrobbles</p>
				<p class="text-2xl font-bold">{profile.totalScrobbles.toLocaleString()}</p>
			</div>
			<div class="rounded border border-gray-700 bg-gray-800 p-4">
				<p class="text-xs text-gray-400">Unique Artists</p>
				<p class="text-2xl font-bold">{profile.uniqueArtists.toLocaleString()}</p>
			</div>
			<div class="rounded border border-gray-700 bg-gray-800 p-4">
				<p class="text-xs text-gray-400">Diversity</p>
				<p class="text-2xl font-bold">{profile.diversityScore}<span class="text-sm text-gray-400">/100</span></p>
			</div>
			<div class="rounded border border-gray-700 bg-gray-800 p-4">
				<p class="text-xs text-gray-400">Obscurity</p>
				<p class="text-2xl font-bold">{profile.obscurityIndex}<span class="text-sm text-gray-400">/100</span></p>
			</div>
		</div>

		<!-- Personality card -->
		{#if profile.genres.length > 0}
			<div class="mb-8">
				<PersonalityCard profile={profile} displayName={bskyDisplayName ?? handle ?? did} />
			</div>
		{/if}

		<!-- Charts row -->
		<div class="mb-8 grid gap-8 lg:grid-cols-2">
			{#if profile.genres.length > 0}
				<div class="rounded border border-gray-700 bg-gray-800 p-4">
					<h2 class="mb-4 text-lg font-semibold">Genre Profile</h2>
					<GenreChart genres={profile.genres} />
				</div>
			{/if}

			{#if Object.keys(profile.mood).length > 0}
				<div class="rounded border border-gray-700 bg-gray-800 p-4">
					<h2 class="mb-4 text-lg font-semibold">Mood Profile</h2>
					<MoodRadar mood={profile.mood} />
				</div>
			{/if}
		</div>

		<!-- Timeline -->
		{#if profile.timeline.length > 0}
			<div class="mb-8 rounded border border-gray-700 bg-gray-800 p-4">
				<h2 class="mb-4 text-lg font-semibold">Listening Timeline</h2>
				<TimelineHeatmap dailyScrobbles={profile.dailyScrobbles} />
			</div>
		{/if}

		<!-- Era -->
		{#if profile.era.length > 0}
			<div class="mb-8 rounded border border-gray-700 bg-gray-800 p-4">
				<h2 class="mb-4 text-lg font-semibold">Era Preference</h2>
				<EraBarChart era={profile.era} />
			</div>
		{/if}

		<!-- Top artists -->
		<div class="mb-8 rounded border border-gray-700 bg-gray-800 p-4">
			<h2 class="mb-4 text-lg font-semibold">Top Artists</h2>
			<ol class="space-y-2">
				{#each profile.topArtists.slice(0, 25) as artist, i (artist.name)}
					<li class="flex items-center gap-3">
						<span class="w-6 text-right text-sm text-gray-400">{i + 1}</span>
						{#if artist.imageUrl}
							<img src={artist.imageUrl} alt={artist.name} class="h-8 w-8 rounded" />
						{:else}
							<canvas use:noiseAvatar={artist.name} class="h-8 w-8 rounded"></canvas>
						{/if}
						<span class="flex-1 truncate">{artist.name}</span>
						<span class="font-mono text-sm text-gray-400">{artist.count.toLocaleString()}</span>
					</li>
				{/each}
			</ol>
		</div>

		<!-- Top tracks + albums side by side -->
		<div class="grid gap-8 lg:grid-cols-2">
			<div class="rounded border border-gray-700 bg-gray-800 p-4">
				<h2 class="mb-4 text-lg font-semibold">Top Tracks</h2>
				<ol class="space-y-2">
					{#each profile.topTracks.slice(0, 25) as track, i (i)}
						<li class="flex items-center gap-3">
							<span class="w-6 text-right text-sm text-gray-400">{i + 1}</span>
							<span class="flex-1 truncate">
								<span class="font-medium">{track.name}</span>
								<span class="text-sm text-gray-400"> — {track.artist}</span>
							</span>
							<span class="font-mono text-sm text-gray-400">{track.count.toLocaleString()}</span>
						</li>
					{/each}
				</ol>
			</div>

			<div class="rounded border border-gray-700 bg-gray-800 p-4">
				<h2 class="mb-4 text-lg font-semibold">Top Albums</h2>
				<ol class="space-y-2">
					{#each profile.topAlbums.slice(0, 25) as album, i (i)}
						<li class="flex items-center gap-3">
							<span class="w-6 text-right text-sm text-gray-400">{i + 1}</span>
							<span class="flex-1 truncate">
								<span class="font-medium">{album.name}</span>
								<span class="text-sm text-gray-400"> — {album.artist}</span>
							</span>
							<span class="font-mono text-sm text-gray-400">{album.count.toLocaleString()}</span>
						</li>
					{/each}
				</ol>
			</div>
		</div>
	{/if}
</div>
