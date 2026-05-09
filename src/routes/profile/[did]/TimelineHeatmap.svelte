<script lang="ts">
	import type { DailyScrobble } from '$lib/types';

	let { dailyScrobbles = [] }: { dailyScrobbles: DailyScrobble[] } = $props();

	const days = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
	const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	const countMap = $derived(new Map(dailyScrobbles.map((d) => [d.date, d.count])));
	const maxCount = $derived(Math.max(...dailyScrobbles.map((d) => d.count), 1));

	interface WeekCell {
		date: string;
		count: number;
		month: number;
	}

	const weeks = $derived.by(() => {
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		const todayDow = today.getDay();
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

	const monthLabels = $derived.by(() => {
		const labels: { weekIndex: number; label: string }[] = [];
		let lastMonth = -1;

		for (let wi = 0; wi < weeks.length; wi++) {
			const week = weeks[wi];
			if (!week || week.length === 0) continue;

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
		if (count < 0) return 'bg-transparent';
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

<div class="w-full">
	<!-- Month labels -->
	<div class="mb-1 grid" style="grid-template-columns: 2rem repeat(53, 1fr); gap: 0 2px;">
		<div></div>
		{#each weeks as _, wi}
			{@const label = monthLabels.find((l) => l.weekIndex === wi)}
			<div class="text-xs text-gray-400 truncate">
				{label?.label ?? ''}
			</div>
		{/each}
	</div>

	<!-- Day rows -->
	<div class="grid" style="grid-template-columns: 2rem repeat(53, 1fr); grid-template-rows: repeat(7, 1fr); gap: 2px;">
		<!-- Day labels column -->
		{#each days as day}
			<div class="flex items-center text-xs text-gray-400">
				{day}
			</div>
		{/each}

		<!-- Cell grid: 53 columns × 7 rows -->
		{#each weeks as week}
			{#each week as cell}
				<div
					class="aspect-square rounded-sm {cellColour(cell.count)}"
					title={cell.date ? "{formatDate(cell.date)} — {cell.count} scrobble{cell.count !== 1 ? 's' : ''}" : ''}
				></div>
			{/each}
		{/each}
	</div>
</div>
