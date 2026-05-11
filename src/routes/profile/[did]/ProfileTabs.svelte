<script lang="ts">
	import { BarChart3, Palette, Clock, ListMusic } from '@lucide/svelte';

	type Tab = 'overview' | 'taste' | 'habits' | 'catalogue';

	let { activeTab = $bindable('overview') }: { activeTab: Tab } = $props();

	const TABS: Array<{ id: Tab; label: string; icon: typeof BarChart3 }> = [
		{ id: 'overview', label: 'Overview', icon: BarChart3 },
		{ id: 'taste', label: 'Taste', icon: Palette },
		{ id: 'habits', label: 'Habits', icon: Clock },
		{ id: 'catalogue', label: 'Catalogue', icon: ListMusic }
	];

	function switchTab(tab: Tab) {
		if (tab === activeTab) return;
		activeTab = tab;

		// Sync URL without scroll jump
		const url = new URL(window.location.href);
		if (tab === 'overview') {
			url.searchParams.delete('tab');
		} else {
			url.searchParams.set('tab', tab);
		}
		history.replaceState(null, '', url);
	}
</script>

<nav class="mb-6 flex gap-1 border-b border-[var(--border)] sm:mb-8 sm:gap-2" aria-label="Profile sections">
	{#each TABS as tab (tab.id)}
		<button
			class="flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors sm:px-4 sm:text-base {activeTab === tab.id
				? 'border-[var(--accent)] text-[var(--text)]'
				: 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'}"
			onclick={() => switchTab(tab.id)}
			role="tab"
			aria-selected={activeTab === tab.id}
		>
			<tab.icon size={14} class="hidden sm:block" />
			{tab.label}
		</button>
	{/each}
</nav>
