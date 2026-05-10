<script lang="ts">
	import { Chart, registerables } from 'chart.js';
	import type { EraEntry } from '$lib/types';

	Chart.register(...registerables);

	let { era = [] }: { era: EraEntry[] } = $props();

	let canvas: HTMLCanvasElement;
	let chart: Chart | null = $state(null);

	// Tourmaline palette: green → pink gradient across decades
	function eraColour(index: number, total: number): string {
		const t = total > 1 ? index / (total - 1) : 0;
		const h = 142 - t * 108;
		const s = 60 + t * 10;
		const l = 50 + t * 5;
		return `hsl(${h}, ${s}%, ${l}%)`;
	}

	$effect(() => {
		if (!canvas || era.length === 0) return;

		if (chart) {
			chart.data.labels = era.map((e) => e.decade);
			chart.data.datasets[0].data = era.map((e) => e.count);
			chart.data.datasets[0].backgroundColor = era.map((_, i) => eraColour(i, era.length));
			chart.update('none');
			return;
		}

		chart = new Chart(canvas, {
			type: 'bar',
			data: {
				labels: era.map((e) => e.decade),
				datasets: [
					{
						data: era.map((e) => e.count),
						backgroundColor: era.map((_, i) => eraColour(i, era.length))
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: false,
				plugins: {
					legend: { display: false }
				},
				scales: {
					x: {
						ticks: { color: '#e5e7eb' },
						grid: { display: false }
					},
					y: {
						ticks: { color: '#9ca3af' },
						grid: { color: 'rgba(255,255,255,0.05)' }
					}
				}
			}
		});
	});
</script>

<div class="h-48 sm:h-64">
	<canvas bind:this={canvas}></canvas>
</div>
