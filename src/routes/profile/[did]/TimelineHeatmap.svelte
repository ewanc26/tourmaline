<script lang="ts">
	import type { DailyScrobble } from '$lib/types';

	let { dailyScrobbles = [] }: { dailyScrobbles: DailyScrobble[] } = $props();

	const days = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
	const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	const countMap = $derived(new Map(dailyScrobbles.map((d) => [d.date, d.count])));
	const maxCount = $derived(Math.max(...dailyScrobbles.map((d) => d.count), 1));

	// Fixed 365-day grid: 53 columns (weeks), 7 rows (days)
	// Today is the bottom-right cell. The grid extends back 365 days.
	interface WeekCell {
		date: string;
		count: number;
		month: number;
	}

	const weeks = $derived.by(() => {
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		// The last column is the week containing today.
		// Go back to the Sunday of this week, then back 52 more weeks.
		const todayDow = today.getDay(); // 0=Sun
		const thisSunday = new Date(today);
		thisSunday.setDate(thisSunday.getDate() - todayDow);

		const startSunday = new Date(thisSunday);
		startSunday.setDate(startSunday.getDate() - 52 * 7);

		const result: WeekCell[][] = [];
		let current = new Date(startSunday);

		for (let w = 0; w < 53; w++) {
			const week: WeekCell[] = [];
			for (let d = 0; d < 7; d++) {
				if (current > today) {
					// Future cells — blank
					week.push({ date: '', count: -1, month: 0 });
				} else {
					const dateStr = current.toISOString().substring(0, 10);
					week.push({
						date: dateStr,
						count: countMap.get(dateStr) ?? 0,
						month: current.getMonth()
					});
				}
				current.setDate(current.getDate() + 1);
			}
			result.push(week);
		}

		return result;
	});

	// Month labels: placed at the first week where a new month starts
	const monthLabels = $derived.by(() => {
		const labels: { weekIndex: number; label: string }[] = [];
		let lastMonth = -1;

		for (let wi = 0; wi < weeks.length; wi++) {
			const week = weeks[wi];
			if (!week || week.length === 0) continue;

			// Check the first non-empty cell's month
			for (const cell of week) {
				if (cell.count >= 0 && cell.month !== lastMonth) {
					labels.push({ weekIndex: wi, label: monthNames[cell.month] });
					lastMonth = cell.month;
					break;
				}
			}
		}

		return labels;
	});

	function cellColour(count: number): string {
		if (count < 0) return 'bg-transparent'; // future
		if (count === 0) return 'bg-gray-800';
		const intensity = count / maxCount;
		if (intensity > 0.75) return 'bg-green-400';
		if (intensity > 0.5) return 'bg-green-500';
		if (intensity > 0.25) return 'bg-green-600';
		return 'bg-green-700';
	}

	function formatDate(dateStr: string): string {
		if (!dateStr) return '';
		const d = new Date(dateStr + 'T00:00:00Z');
		return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
	}
</script>

<div class="overflow-x-auto">
	<div class="inline-block min-w-full">
		<!-- Month labels -->
		<div class="mb-1 flex" style="padding-left: 2rem;">
			{#each weeks as _, wi}
				{@const label = monthLabels.find((l) => l.weekIndex === wi)}
				<div class="text-xs text-gray-400" style="width: 1rem; min-width: 1rem;">
					{label?.label ?? ''}
				</div>
			{/each}
		</div>

		<!-- Day rows -->
		<div class="flex gap-0">
			<!-- Day labels -->
			<div class="mr-1 flex flex-col" style="gap: 2px;">
				{#each days as day}
					<div class="flex h-4 items-center text-xs text-gray-400">
						{day}
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
								title={cell.date ? "{formatDate(cell.date)} — {cell.count} scrobble{cell.count !== 1 ? 's' : ''}" : ''}
							></div>
						{/each}
					</div>
				{/each}
			</div>
		</div>
	</div>
</div>
