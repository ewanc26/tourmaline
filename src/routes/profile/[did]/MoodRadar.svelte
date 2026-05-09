<script lang="ts">
	import { Chart, registerables } from 'chart.js';

	Chart.register(...registerables);

	let { mood }: { mood: Record<string, number> } = $props();

	let canvas: HTMLCanvasElement;
	let chart: Chart | null = $state(null);

	$effect(() => {
		if (!canvas || Object.keys(mood).length === 0) return;

		const labels = Object.keys(mood);
		const values = Object.values(mood);

		if (chart) chart.destroy();

		chart = new Chart(canvas, {
			type: 'radar',
			data: {
				labels,
				datasets: [
					{
						data: values,
						backgroundColor: 'rgba(74, 222, 128, 0.2)',
						borderColor: 'rgba(74, 222, 128, 0.8)',
						pointBackgroundColor: 'rgba(74, 222, 128, 1)'
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
					r: {
						beginAtZero: true,
						max: 100,
						ticks: { color: '#9ca3af', backdropColor: 'transparent' },
						grid: { color: 'rgba(255,255,255,0.1)' },
						pointLabels: { color: '#e5e7eb', font: { size: 11 } },
						angleLines: { color: 'rgba(255,255,255,0.1)' }
					}
				}
			}
		});
	});
</script>

<div class="h-80">
	<canvas bind:this={canvas}></canvas>
</div>
