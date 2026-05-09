<script lang="ts">
	import { Chart, registerables } from 'chart.js';
	import type { EraEntry } from '$lib/types';

	Chart.register(...registerables);

	let { era }: { era: EraEntry[] } = $props();

	let canvas: HTMLCanvasElement;
	let chart: Chart | null = $state(null);

	$effect(() => {
		if (!canvas || era.length === 0) return;

		if (chart) chart.destroy();

		chart = new Chart(canvas, {
			type: 'bar',
			data: {
				labels: era.map((e) => e.decade),
				datasets: [
					{
						data: era.map((e) => e.count),
						backgroundColor: era.map((_, i) => {
							const hue = 200 + i * 25;
							return `hsl(${hue}, 60%, 50%)`;
						})
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
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

<div class="h-64">
	<canvas bind:this={canvas}></canvas>
</div>
