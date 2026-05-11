<script lang="ts">
	import { onMount } from 'svelte';
	import { renderNoiseAvatar } from '@ewanc26/noise-avatar';
	import type { ListenerProfile } from '$lib/types';
	import type { SessionStats } from '$lib/analysis/sessions';
	import type { OnThisDayEntry } from '$lib/analysis/on-this-day';
	import type { StoryRecap as StoryRecapData } from '$lib/analysis/story-recap';
	import type { PersonalityProfile } from '$lib/analysis/personality';
	import type { DateRangePreset } from '$lib/analysis/date-range';
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

	function formatTime(seconds: number): string {
		if (seconds < 60) return `${seconds}s`;
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}m ${secs}s`;
	}

	function estimateRemaining(current: number, total: number, elapsedSec: number): string {
		if (current === 0 || elapsedSec === 0) return '—';
		const rate = current / elapsedSec;
		const remaining = Math.ceil((total - current) / rate);
		return formatTime(remaining);
	}

	let { data }: { data: { did: string; handle?: string; displayName?: string; avatar?: string; error?: string } } = $props();

	// Identity from server load (already resolved)
	let did = $state(data.did);
	let handle = $state(data.handle);
	let bskyDisplayName = $state(data.displayName);
	let bskyAvatar = $state(data.avatar);

	// Loading phases
	let phase = $state<'idle' | 'fetching' | 'computing' | 'enriching' | 'complete' | 'error'>('idle');
	let loaded = $state(0);
	let enrichProgress = $state({ current: 0, total: 0 });
	let error = $state(data.error ?? '');

	// Timing
	let fetchStartTime = $state(0);
	let enrichStartTime = $state(0);
	let elapsed = $state(0);
	let enrichElapsed = $state(0);

	// Profile data
	let profiles = $state<Record<string, ListenerProfile>>({});
	let profile = $state<ListenerProfile | null>(null);
	let sessionStats = $state<SessionStats | null>(null);
	let onThisDayEntries = $state<OnThisDayEntry[]>([]);
	let storyRecap_ = $state<StoryRecapData | null>(null);
	let personality = $state<PersonalityProfile | null>(null);

	type Tab = 'overview' | 'taste' | 'habits' | 'catalogue';
	let activeTab = $state<Tab>('overview');

	// Read tab from URL on mount
	const urlTab = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tab') : null;
	if (urlTab === 'taste' || urlTab === 'habits' || urlTab === 'catalogue') {
		activeTab = urlTab;
	}

	let dateRange = $state<DateRangePreset>('all');

	// Switch profile when date range changes (all profiles pre-computed server-side)
	$effect(() => {
		if (profiles[dateRange]) {
			profile = profiles[dateRange];
		}
	});

	onMount(async () => {
		if (error || !did) return;

		const t0 = performance.now();

		try {
			// 1. Fetch scrobbles in batches
			phase = 'fetching';
			fetchStartTime = Date.now();
			let batch = 0;
			let fetchDone = false;

			// Update elapsed time every second
			const fetchTimer = setInterval(() => {
				elapsed = Math.floor((Date.now() - fetchStartTime) / 1000);
			}, 1000);

			while (!fetchDone) {
				const res = await fetch(`/api/scrobbles/${encodeURIComponent(did)}?continue=${batch > 0}`);
				const data = await res.json();

				if (data.coldStart) {
					// Server restarted — start fresh
					batch = 0;
					continue;
				}

				if (data.error) {
					throw new Error(data.error);
				}

				loaded = data.loaded;
				fetchDone = data.done;
				batch++;
			}

			clearInterval(fetchTimer);
			elapsed = Math.floor((Date.now() - fetchStartTime) / 1000);

			// 2. Compute profile (all date ranges at once)
			phase = 'computing';
			const profileRes = await fetch(`/api/profile/${encodeURIComponent(did)}`);
			const profileData = await profileRes.json();

			if (profileData.error) {
				throw new Error(profileData.error);
			}

			profiles = profileData.profiles;
			profile = profiles[dateRange];
			sessionStats = profileData.sessionStats;
			onThisDayEntries = profileData.onThisDay ?? [];
			storyRecap_ = profileData.storyRecap ?? null;
			personality = profileData.personality ?? null;

			// 3. Enrich artists in batches
			if (profile && !profileData.enrichmentDone) {
				phase = 'enriching';
				enrichStartTime = Date.now();
				let enrichBatch = 0;
				let enrichDone = false;

				const enrichTimer = setInterval(() => {
					enrichElapsed = Math.floor((Date.now() - enrichStartTime) / 1000);
				}, 1000);

				while (!enrichDone) {
					const res = await fetch(`/api/enrich/${encodeURIComponent(did)}?continue=${enrichBatch > 0}`);
					const data = await res.json();

					if (data.coldStart) {
						enrichBatch = 0;
						continue;
					}

					if (data.error) {
						console.warn('[tourmaline] enrichment error:', data.error);
						break;
					}

					enrichProgress = { current: data.current, total: data.total };
					enrichDone = data.done;
					enrichBatch++;
				}

				clearInterval(enrichTimer);
				enrichElapsed = Math.floor((Date.now() - enrichStartTime) / 1000);

				// Re-fetch profile with enrichment applied
				const enrichedRes = await fetch(`/api/profile/${encodeURIComponent(did)}`);
				const enrichedData = await enrichedRes.json();
				if (!enrichedData.error) {
					profiles = enrichedData.profiles;
					profile = profiles[dateRange];
					sessionStats = enrichedData.sessionStats;
					onThisDayEntries = enrichedData.onThisDay ?? [];
					storyRecap_ = enrichedData.storyRecap ?? null;
					personality = enrichedData.personality ?? null;
				}
			}

			phase = 'complete';
			console.log(`[tourmaline] complete in ${((performance.now() - t0) / 1000).toFixed(1)}s — ${loaded} scrobbles`);
		} catch (e) {
			phase = 'error';
			error = e instanceof Error ? e.message : String(e);
			console.error('[tourmaline] error:', e);
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
			{#if phase === 'fetching'}
				<div class="flex items-center gap-3">
					<div class="h-2 w-2 animate-pulse rounded-full bg-green-500"></div>
					<span class="text-sm text-[var(--text)]">Fetching scrobbles...</span>
				</div>
				<div class="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
					<div class="h-full w-1/3 animate-indeterminate rounded-full bg-green-600"></div>
				</div>
				<p class="mt-2 text-xs text-[var(--text-dim)]">
					{loaded.toLocaleString()} scrobbles loaded
					{#if elapsed > 0}
						· {formatTime(elapsed)} elapsed
						· {loaded > 0 ? (loaded / elapsed).toFixed(0) : '—'} scrobbles/sec
					{/if}
				</p>
			{:else if phase === 'computing'}
				<div class="flex items-center gap-3">
					<div class="h-2 w-2 animate-pulse rounded-full bg-green-500"></div>
					<span class="text-sm text-[var(--text)]">Computing profile...</span>
				</div>
			{:else if phase === 'enriching'}
				<div class="flex items-center gap-3">
					<div class="h-2 w-2 animate-pulse rounded-full bg-green-500"></div>
					<span class="text-sm text-[var(--text)]">Enriching artist data... ({enrichProgress.current}/{enrichProgress.total})</span>
				</div>
				<div class="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
					<div class="h-full rounded-full bg-green-600 transition-all duration-300" style="width: {enrichProgress.total > 0 ? (enrichProgress.current / enrichProgress.total * 100) : 0}%"></div>
				</div>
				<p class="mt-2 text-xs text-[var(--text-dim)]">
					{#if enrichElapsed > 0}
						{formatTime(enrichElapsed)} elapsed
						· {enrichProgress.current > 0 ? estimateRemaining(enrichProgress.current, enrichProgress.total, enrichElapsed) + ' remaining' : '—'}
					{/if}
				</p>
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
