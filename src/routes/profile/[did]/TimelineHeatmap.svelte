<script lang="ts">
	import type { TimelineBucket } from '$lib/types';

	let { timeline }: { timeline: TimelineBucket[] } = $props();

	const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const maxCount = $derived(Math.max(...timeline.map((b) => b.count), 1));

	function cellColour(count: number): string {
		if (count === 0) return 'bg-gray-800';
		const intensity = count / maxCount;
		if (intensity > 0.75) return 'bg-green-500';
		if (intensity > 0.5) return 'bg-green-600';
		if (intensity > 0.25) return 'bg-green-700';
		return 'bg-green-900';
	}
</script>

<div class="overflow-x-auto">
	<table class="w-full border-collapse text-xs">
		<thead>
			<tr>
				<th class="p-1 text-left text-gray-400"></th>
				{#each Array(24) as _, h}
					<th class="p-1 text-center text-gray-400">
						{h % 3 === 0 ? `${h.toString().padStart(2, '0')}` : ''}
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each days as day, d}
				<tr>
					<td class="p-1 text-gray-400">{day}</td>
					{#each Array(24) as _, h}
						{@const bucket = timeline.find((b) => b.day === d && b.hour === h)}
						<td
							class="h-4 w-4 rounded-sm {cellColour(bucket?.count ?? 0)}"
							title="{day} {h.toString().padStart(2, '0')}:00 — {bucket?.count ?? 0} scrobbles"
						></td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>
