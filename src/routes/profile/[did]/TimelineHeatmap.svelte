<script lang="ts">
	import type { DailyScrobble } from '$lib/types';

	let { dailyScrobbles = [] }: { dailyScrobbles: DailyScrobble[] } = $props();

	const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

	// Build a lookup map for quick count access
	const countMap = $derived(new Map(dailyScrobbles.map((d) => [d.date, d.count])));
	const maxCount = $derived(Math.max(...dailyScrobbles.map((d) => d.count), 1));

	// Calculate the week grid from the data range
	interface WeekCell {
		date: string;
		count: number;
		month: number;
	}

	const weeks = $derived.by(() => {
		if (dailyScrobbles.length === 0) return [];

		const sorted = [...dailyScrobbles].sort((a, b) => a.date.localeCompare(b.date));
		const firstDate = new Date(sorted[0].date + 'T00:00:00Z');
		const lastDate = new Date(sorted[sorted.length - 1].date + 'T00:00:00Z');

		// Start from the Sunday before (or on) the first date
		const startSunday = new Date(firstDate);
		startSunday.setUTCDate(startSunday.getUTCDate() - startSunday.getUTCDay());

		const result: WeekCell[][] = [];
		let current = new Date(startSunday);
		let currentWeek: WeekCell[] = [];

		while (current <= lastDate || currentWeek.length > 0) {
			const dateStr = current.toISOString().substring(0, 10);
			const count = countMap.get(dateStr) ?? 0;
			currentWeek.push({ date: dateStr, count, month: current.getUTCMonth() });

			if (current.getUTCDay() === 6) {
				result.push(currentWeek);
				currentWeek = [];
			}

			current.setUTCDate(current.getUTCDate() + 1);

			// Safety: stop after 2 years of weeks
			if (result.length > 104) break;
		}

		if (currentWeek.length > 0) {
			result.push(currentWeek);
		}

		return result;
	});

	// Month labels — placed at the first week where a new month starts
	const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	function cellColour(count: number): string {
		if (count === 0) return 'bg-gray-800';
		const intensity = count / maxCount;
		if (intensity > 0.75) return 'bg-green-400';
		if (intensity > 0.5) return 'bg-green-500';
		if (intensity > 0.25) return 'bg-green-600';
		return 'bg-green-700';
	}

	function formatDate(dateStr: string): string {
		const d = new Date(dateStr + 'T00:00:00Z');
		return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
	}
</script>

<div class="overflow-x-auto">
	<div class="inline-block min-w-full">
		<!-- Month labels -->
		<div class="mb-1 flex" style="padding-left: 2rem;">
			{#each weeks as week, wi}
				{@const firstInWeek = week[0]}
				{#if wi === 0 || (firstInWeek && firstInWeek.month !== weeks[wi - 1]?.[0]?.month)}
					<div class="text-xs text-gray-400" style="width: 1rem; min-width: 1rem;">
						{monthNames[firstInWeek?.month ?? 0]}
					</div>
				{:else}
					<div style="width: 1rem; min-width: 1rem;"></div>
				{/if}
			{/each}
		</div>

		<!-- Day rows -->
		<div class="flex gap-0">
			<!-- Day labels -->
			<div class="mr-1 flex flex-col" style="gap: 2px;">
				{#each days as day, di}
					<div class="flex h-4 items-center text-xs text-gray-400">
						{#if di % 2 === 1}
							{day}
						{/if}
					</div>
				{/each}
			</div>

			<!-- Cell grid -->
			<div class="flex" style="gap: 2px;">
				{#each weeks as week}
					<div class="flex flex-col" style="gap: 2px;">
						{#each week as cell}
							<div
								class="h-4 w-4 rounded-sm {cellColour(cell.count)}"
								title="{formatDate(cell.date)} — {cell.count} scrobble{cell.count !== 1 ? 's' : ''}"
							></div>
						{/each}
					</div>
				{/each}
			</div>
		</div>
	</div>
</div>
