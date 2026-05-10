<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<div class="flex min-h-screen flex-col">
	<header class="sticky top-0 z-10 border-b border-gray-800 bg-gray-900/90 backdrop-blur-sm">
		<div class="mx-auto flex max-w-6xl items-center justify-between px-3 py-3 sm:px-4">
			<div class="flex items-center gap-3">
				<a href="/" class="flex items-center gap-2 text-gray-100 hover:text-white">
					<img src="/logo.svg" alt="Tourmaline" class="h-7 w-7 sm:h-8 sm:w-8" />
					<span class="text-sm font-semibold tracking-tight">Tourmaline</span>
				</a>
				<span class="text-xs text-gray-600">AT Protocol scrobble analyser</span>
			</div>
			<nav class="flex items-center gap-4 text-xs text-gray-400">
				<a href="/about" class="hover:text-white">About</a>
				<a href="https://github.com/ewanc26/tourmaline" target="_blank" rel="noopener" class="hover:text-white">GitHub ↗</a>
			</nav>
		</div>
	</header>

	<main class="flex-1">
		{@render children()}
	</main>

	<footer class="border-t border-gray-800 py-3 text-center text-xs text-gray-500">
		<span>scrobble analytics</span>
		<span class="mx-1">·</span>
		<a href="https://github.com/ewanc26/tourmaline" target="_blank" rel="noopener" class="text-gray-400 hover:text-green-400">source</a>
	</footer>
</div>
