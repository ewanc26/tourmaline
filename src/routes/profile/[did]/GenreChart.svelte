<script lang="ts">
	import { Chart, registerables } from 'chart.js';
	import type { GenreEntry } from '$lib/types';

	Chart.register(...registerables);

	let { genres = [] }: { genres: GenreEntry[] } = $props();

	let canvas: HTMLCanvasElement;
	let chart: Chart | null = $state(null);

	$effect(() => {
		if (!canvas || genres.length === 0) return;

		const top = genres.slice(0, 12);
		const maxWeight = top[0]?.weight ?? 1;

		if (chart) {
			// Update existing chart
			chart.data.labels = top.map((g) => g.name);
			chart.data.datasets[0].data = top.map((g) => Math.round((g.weight / maxWeight) * 100));
			chart.data.datasets[0].backgroundColor = top.map((_, i) => {
				const hue = (i * 30) % 360;
				return `hsl(${hue}, 70%, 55%)`;
			});
			chart.update('none');
			return;
		}

		chart = new Chart(canvas, {
			type: 'bar',
			data: {
				labels: top.map((g) => g.name),
				datasets: [
					{
						data: top.map((g) => Math.round((g.weight / maxWeight) * 100)),
						backgroundColor: top.map((_, i) => {
							const hue = (i * 30) % 360;
							return `hsl(${hue}, 70%, 55%)`;
						})
					}
				]
			},
			options: {
				indexAxis: 'y',
				responsive: true,
				maintainAspectRatio: false,
				animation: false,
				plugins: {
					legend: { display: false },
					tooltip: {
						callbacks: {
							label: (ctx) => `${ctx.raw}%`
						}
					}
				},
				scales: {
					x: {
						max: 100,
						ticks: { color: '#9ca3af' },
						grid: { color: 'rgba(255,255,255,0.05)' }
					},
					y: {
						ticks: { color: '#e5e7eb' },
						grid: { display: false }
					}
				}
			}
		});
	});
</script>

<div class="h-80">
	<canvas bind:this={canvas}></canvas>
</div>
