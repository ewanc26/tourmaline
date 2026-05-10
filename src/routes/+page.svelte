<script lang="ts">
	let identifier = $state('');
	let loading = $state(false);
	let error = $state('');

	function analyse() {
		const input = identifier.trim();
		if (!input) return;

		loading = true;
		error = '';

		const encoded = encodeURIComponent(input);
		window.location.href = `/profile/${encoded}`;
	}
</script>

<svelte:head>
	<title>Tourmaline — AT Protocol Scrobble Analyser</title>
	<meta name="description" content="Discover what kind of listener you are. Analyses Teal.fm scrobbles from any AT Protocol account." />
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center px-4">
	<div class="w-full max-w-lg text-center">
		<h1 class="text-4xl font-bold">Tourmaline</h1>
		<p class="mt-2 text-gray-400">AT Protocol scrobble analyser</p>
		<p class="mt-4 text-sm text-gray-500">
			Enter a handle or DID to analyse their Teal.fm listening history.
		</p>

		<form onsubmit={(e) => { e.preventDefault(); analyse(); }} class="mt-8 flex flex-col gap-2 sm:flex-row">
			<input
				type="text"
				bind:value={identifier}
				placeholder="ewancroft.uk or did:plc:..."
				class="flex-1 rounded border border-gray-600 bg-gray-800 px-4 py-3 font-mono text-sm text-white placeholder-gray-500 focus:border-green-500 focus:outline-none"
				disabled={loading}
			/>
			<button
				type="submit"
				class="rounded bg-green-600 px-6 py-3 font-medium text-sm hover:bg-green-500 disabled:opacity-50"
				disabled={loading}
			>
				{loading ? 'Analysing...' : 'Analyse'}
			</button>
		</form>

		{#if error}
			<p class="mt-2 text-sm text-red-400">{error}</p>
		{/if}

		<p class="mt-6 text-xs text-gray-600">
			Identity resolution via <a href="https://slingshot.microcosm.blue" class="text-gray-400 hover:text-green-400">Slingshot</a>.
			Reads <code class="text-gray-400">fm.teal.alpha.feed.play</code> records from the user's PDS.
			Enriches with MusicBrainz, Last.fm, and Deezer.
		</p>
	</div>
</div>
