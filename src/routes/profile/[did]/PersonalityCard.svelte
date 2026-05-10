<script lang="ts">
	import { buildPersonality } from '$lib/analysis/personality';
	import type { ListenerProfile } from '$lib/types';

	let { profile, displayName }: { profile: ListenerProfile; displayName: string } = $props();

	const personality = $derived(buildPersonality(profile));
</script>

<div class="rounded border border-gray-700 bg-gray-800 p-4 sm:p-6">
	<!-- Header -->
	<p class="font-mono text-xs text-green-500">
		<span class="text-gray-500">tourmaline</span><span class="text-gray-600">@</span><span class="text-gray-500">profile</span><span class="text-gray-600">:~$</span>
		<span class="ml-1 text-gray-400">identify</span>
	</p>
	<h2 class="mt-2 text-base font-semibold text-gray-100 sm:text-lg">
		<span class="text-gray-400">{displayName} is a</span>
		<span class="ml-1 text-green-400">{personality.archetype}</span>
	</h2>
	<p class="mt-1 text-sm leading-relaxed text-gray-400">{personality.archetypeBlurb}</p>
	<p class="mt-3 text-sm leading-relaxed text-gray-400">{personality.summary}</p>

	<!-- Traits grid -->
	<ul class="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
		{#each personality.traits as trait (trait.label)}
			<li class="rounded border border-gray-700 bg-gray-900 px-4 py-3">
				<p class="font-mono text-xs uppercase tracking-wide text-green-500/60">{trait.label}</p>
				<p class="mt-0.5 font-semibold text-gray-100">{trait.value}</p>
				<p class="mt-0.5 text-xs text-gray-400">{trait.detail}</p>
			</li>
		{/each}
	</ul>
</div>
