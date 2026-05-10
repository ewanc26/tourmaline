<script lang="ts">
	import { Chart, registerables } from 'chart.js';
	import type { GenreEntry } from '$lib/types';

	Chart.register(...registerables);

	let { genres = [] }: { genres: GenreEntry[] } = $props();

	let canvas: HTMLCanvasElement;
	let chart: Chart | null = null;

	$effect(() => {
		if (!canvas || genres.length === 0) return;

		const top = genres.slice(0, 12);
		const maxWeight = top[0]?.weight ?? 1;

		// Tourmaline pleochroic palette: green → pink gradient for genre bars
	function genreColour(index: number, total: number): string {
		const t = total > 1 ? index / (total - 1) : 0;
		// Green (#4ade80) → Pink (#f472b6) interpolated via HSL
		const h = 142 - t * 108; // 142 (green) → 34 (pink)
		const s = 70 + t * 10;   // 70% → 80%
		const l = 55 + t * 5;    // 55% → 60%
		return `hsl(${h}, ${s}%, ${l}%)`;
	}
		// Show fewer genres on small screens
		const isMobile = canvas.clientWidth < 400;
		const display = isMobile ? top.slice(0, 8) : top;

		if (chart) {
			// Update existing chart
			chart.data.labels = display.map((g) => g.name);
			chart.data.datasets[0].data = display.map((g) => Math.round((g.weight / maxWeight) * 100));
			chart.data.datasets[0].backgroundColor = display.map((_, i) => genreColour(i, display.length));
			chart.update('none');
			return;
		}

		chart = new Chart(canvas, {
			type: 'bar',
			data: {
				labels: display.map((g) => g.name),
				datasets: [
					{
						data: display.map((g) => Math.round((g.weight / maxWeight) * 100)),
						backgroundColor: display.map((_, i) => genreColour(i, display.length))
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
						ticks: { color: '#9ca3af', font: { size: 11 } },
						grid: { color: 'rgba(255,255,255,0.05)' }
					},
					y: {
						ticks: { color: '#e5e7eb', font: { size: 11 } },
						grid: { display: false }
					}
				}
			}
		});
	});
</script>

<div class="h-64 sm:h-80">
	<canvas bind:this={canvas}></canvas>
</div>
