<script lang="ts">
	import { onMount } from 'svelte';
	import { resolveIdentifier, fetchScrobblesBatched } from '$lib/atproto/resolve';
	import { Aggregator } from '$lib/analysis/aggregator';
	import { buildGenreProfile } from '$lib/analysis/genres';
	import { buildTimeline } from '$lib/analysis/timeline';
	import { diversityScore } from '$lib/analysis/diversity';
	import { calculateObscurity } from '$lib/analysis/obscurity';
	import { buildMoodProfile } from '$lib/analysis/mood';
	import { enrichArtist } from '$lib/enrich/musicbrainz';
	import { enrichWithLastfm } from '$lib/enrich/lastfm';
	import { getArtistImage } from '$lib/enrich/deezer';
	import type { ArtistInfo, ListenerProfile, TealScrobble } from '$lib/types';
	import GenreChart from './GenreChart.svelte';
	import TimelineHeatmap from './TimelineHeatmap.svelte';
	import MoodRadar from './MoodRadar.svelte';
	import EraBarChart from './EraBarChart.svelte';

	import { page } from '$app/stores';
	import { get } from 'svelte/store';

	let { data }: { data: { lastfmApiKey: string | null } } = $props();
	const identifier = decodeURIComponent(get(page).params.did as string);

	// Expose Last.fm API key to client-side enrichment
	onMount(() => {
		if (data.lastfmApiKey) {
			(window as unknown as Record<string, string>).__LASTFM_API_KEY = data.lastfmApiKey;
		}
	});

	let phase = $state<'idle' | 'resolving' | 'fetching' | 'enriching' | 'complete' | 'error'>('idle');
	let did = $state('');
	let handle = $state<string | undefined>();
	let loaded = $state(0);
	let enrichProgress = $state({ current: 0, total: 0 });
	let error = $state('');
	let profile = $state<ListenerProfile | null>(null);

	const artistInfos = new Map<string, ArtistInfo>();

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
			era: [],
			diversityScore: diversity,
			obscurityIndex: obscurity,
			mood
		};
	}

	onMount(async () => {
		const aggregator = new Aggregator();

		try {
			// 1. Resolve identity
			phase = 'resolving';
			const identity = await resolveIdentifier(identifier);
			did = identity.did;
			handle = identity.handle;
			profile = emptyProfile(did, handle);

			// 2. Fetch scrobbles — update profile after each page
			phase = 'fetching';
			await fetchScrobblesBatched(identity.pdsUrl, did, (batch, totalSoFar) => {
				aggregator.add(batch);
				loaded = totalSoFar;
				updateProfile(aggregator.snapshot());
			});

			// 3. Enrich artists — update profile after each artist
			phase = 'enriching';
			const topArtists = aggregator.snapshot().topArtists;
			enrichProgress = { current: 0, total: topArtists.length };

			for (let i = 0; i < topArtists.length; i++) {
				const { name } = topArtists[i];
				if (artistInfos.has(name)) {
					enrichProgress.current = i + 1;
					continue;
				}

				// MusicBrainz
				try {
					const info = await enrichArtist(name);
					if (info) artistInfos.set(name, info);
				} catch { /* continue */ }

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
					}
				} catch { /* continue */ }

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
						}
					} catch { /* continue */ }
				}

				enrichProgress.current = i + 1;
				updateProfile(aggregator.snapshot());
			}

			phase = 'complete';
		} catch (e) {
			phase = 'error';
			error = e instanceof Error ? e.message : String(e);
		}
	});
</script>

<svelte:head>
	<title>{handle ?? identifier} — Tourmaline</title>
	<meta name="description" content="Listening profile for {handle ?? identifier}" />
</svelte:head>

<div class="mx-auto max-w-6xl px-4 py-8">
	<header class="mb-8">
		<a href="/" class="text-sm text-gray-400 hover:text-white">&larr; Back</a>
		<h1 class="mt-2 text-2xl font-bold">
			{handle ?? identifier}
		</h1>
		{#if did}
			<p class="mt-1 font-mono text-xs text-gray-500">{did}</p>
		{/if}
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
				<TimelineHeatmap timeline={profile.timeline} />
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
				{#each profile.topArtists.slice(0, 25) as artist, i}
					<li class="flex items-center gap-3">
						<span class="w-6 text-right text-sm text-gray-400">{i + 1}</span>
						{#if artist.imageUrl}
							<img src={artist.imageUrl} alt={artist.name} class="h-8 w-8 rounded" />
						{:else}
							<div class="flex h-8 w-8 items-center justify-center rounded bg-gray-700 text-xs text-gray-400">
								?
							</div>
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
					{#each profile.topTracks.slice(0, 25) as track, i}
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
					{#each profile.topAlbums.slice(0, 25) as album, i}
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
