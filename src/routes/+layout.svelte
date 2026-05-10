<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<div class="flex min-h-screen flex-col">
	<header class="sticky top-0 z-10 border-b border-gray-800 bg-gray-900/90 backdrop-blur-sm">
		<div class="mx-auto flex max-w-6xl items-center gap-3 px-3 py-3 sm:px-4">
			<a href="/" class="flex items-center gap-2 text-gray-100 hover:text-white">
				<img src="/logo.svg" alt="Tourmaline" class="h-7 w-7 sm:h-8 sm:w-8" />
				<span class="text-sm font-semibold tracking-tight">Tourmaline</span>
			</a>
			<span class="text-xs text-gray-600">AT Protocol scrobble analyser</span>
		</div>
	</header>

	<main class="flex-1">
		{@render children()}
	</main>
</div>
