<script lang="ts">
	import type { ListenerProfile } from '$lib/types';
	import GenreChart from './GenreChart.svelte';
	import TimelineHeatmap from './TimelineHeatmap.svelte';
	import MoodRadar from './MoodRadar.svelte';
	import EraBarChart from './EraBarChart.svelte';

	let { data }: { data: { profile: ListenerProfile } } = $props();
	const profile = $derived(data.profile);
</script>

<svelte:head>
	<title>{profile.handle ?? profile.did} — Tourmaline</title>
	<meta name="description" content="Listening profile for {profile.handle ?? profile.did}" />
</svelte:head>

<div class="mx-auto max-w-6xl px-4 py-8">
	<header class="mb-8">
		<a href="/" class="text-sm text-gray-400 hover:text-white">&larr; Back</a>
		<h1 class="mt-2 text-2xl font-bold">
			{profile.handle ?? profile.did}
		</h1>
		<p class="mt-1 font-mono text-xs text-gray-500">{profile.did}</p>
	</header>

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
</div>
