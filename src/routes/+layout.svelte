<script lang="ts">
	import '../app.css';
	import { ExternalLink } from '@lucide/svelte';

	let { children } = $props();

	const year = new Date().getFullYear();
</script>

<div class="flex min-h-screen flex-col bg-[var(--bg)]">
	<header class="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur-sm">
		<div class="mx-auto flex max-w-6xl items-center justify-between px-3 py-3 sm:px-4">
			<div class="flex items-center gap-3">
				<a href="/" class="flex items-center gap-2.5 text-[var(--text)] hover:text-white transition-colors">
					<img src="/logo.svg" alt="Tourmaline" class="h-7 w-7 shrink-0 sm:h-8 sm:w-8" />
					<div class="flex flex-col leading-tight">
						<span class="text-sm font-bold tracking-tight sm:text-base">Tourmaline</span>
						<span class="hidden text-[10px] text-[var(--text-dim)] sm:block">Teal.fm scrobble analyser</span>
					</div>
				</a>
			</div>
			<nav class="flex items-center gap-4 text-xs text-[var(--text-muted)]">
				<a href="/about" class="hover:text-[var(--accent)] transition-colors">About</a>
				<a
					href="https://github.com/ewanc26/tourmaline"
					target="_blank"
					rel="noopener"
					class="inline-flex items-center gap-1 hover:text-[var(--accent)] transition-colors"
				>
					GitHub <ExternalLink size={11} />
				</a>
			</nav>
		</div>
	</header>

	<main class="flex-1">
		{@render children()}
	</main>

	<footer class="border-t border-[var(--border)] py-4 text-center text-xs text-[var(--text-dim)]">
		<div class="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4">
			<span class="text-[var(--text-muted)]">Tourmaline</span>
			<span>·</span>
			<span>Teal.fm scrobble analyser</span>
			<span>·</span>
			<a
				href="https://github.com/ewanc26/tourmaline"
				target="_blank"
				rel="noopener"
				class="hover:text-[var(--accent)] transition-colors"
			>
				Source
			</a>
			<span>·</span>
			<a
				href="/about"
				class="hover:text-[var(--accent)] transition-colors"
			>
				Privacy
			</a>
			<span>·</span>
			<span>© {year} Ewan Croft · AGPL-3.0</span>
		</div>
	</footer>
</div>
