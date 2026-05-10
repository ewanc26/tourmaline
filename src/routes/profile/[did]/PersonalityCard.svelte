<script lang="ts">
	import { buildPersonality } from '$lib/analysis/personality';
	import type { ListenerProfile } from '$lib/types';

	let { profile, displayName }: { profile: ListenerProfile; displayName: string } = $props();

	const personality = $derived(buildPersonality(profile));
</script>

<div class="rounded border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6">
	<!-- Header -->
	<p class="font-mono text-xs text-[var(--accent-dim)]">
		<span class="text-[var(--text-dim)]">tourmaline</span><span class="text-[var(--border)]">@</span><span class="text-[var(--text-dim)]">profile</span><span class="text-[var(--border)]">:~$</span>
		<span class="ml-1 text-[var(--text-muted)]">identify</span>
	</p>
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
</div>
