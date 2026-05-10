<script lang="ts">
	import { Share2 } from '@lucide/svelte';
	import { buildPersonality } from '$lib/analysis/personality';
	import type { ListenerProfile } from '$lib/types';

	let { profile, displayName }: { profile: ListenerProfile; displayName: string } = $props();

	const personality = $derived(buildPersonality(profile));

	const STORAGE_KEY = 'tourmaline:share';

	function share() {
		sessionStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				archetype: personality.archetype,
				archetypeBlurb: personality.archetypeBlurb,
				traits: personality.traits
			})
		);
		const params = new URLSearchParams({ handle: profile.handle ?? '', did: profile.did });
		window.location.href = `/share?${params}`;
	}
</script>

<div class="rounded border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6">
	<!-- Header -->
	<h2 class="mt-2 text-base font-semibold text-[var(--text)] sm:text-lg">
		<span class="text-[var(--text-muted)]">{displayName} is a</span>
		<span class="ml-1 text-[var(--accent)]">{personality.archetype}</span>
	</h2>
	<p class="mt-1 text-sm leading-relaxed text-[var(--text-muted)]">{personality.archetypeBlurb}</p>
	<p class="mt-3 text-sm leading-relaxed text-[var(--text-muted)]">{personality.summary}</p>

	<!-- Traits grid -->
	<ul class="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
		{#each personality.traits as trait (trait.label)}
			<li class="rounded border border-[var(--border)] bg-[var(--bg)] px-4 py-3">
				<p class="font-mono text-xs uppercase tracking-wide text-[var(--accent-dim)]/60">{trait.label}</p>
				<p class="mt-0.5 font-semibold text-[var(--text)]">{trait.value}</p>
				<p class="mt-0.5 text-xs text-[var(--text-muted)]">{trait.detail}</p>
			</li>
		{/each}
	</ul>

	<!-- Share button -->
	<button
		class="mt-6 flex w-full items-center justify-center gap-2 rounded border border-[var(--border)] bg-[var(--bg)] px-4 py-2.5 text-sm font-medium text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
		onclick={share}
	>
		<Share2 size={15} />
		Share to Bluesky
	</button>
</div>
