<script lang="ts">
	let did = $state('');
	let loading = $state(false);
	let error = $state('');

	async function analyse() {
		const input = did.trim();
		if (!input) return;

		// Handle bare handles
		let resolvedDid = input;
		if (!input.startsWith('did:')) {
			error = 'Enter a DID (did:plc:... or did:web:...)';
			return;
		}

		loading = true;
		error = '';

		try {
			const encoded = encodeURIComponent(resolvedDid);
			window.location.href = `/profile/${encoded}`;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to resolve DID';
			loading = false;
		}
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
			Enter a DID to analyse their Teal.fm listening history and discover what kind of listener they are.
		</p>

		<form onsubmit={(e) => { e.preventDefault(); analyse(); }} class="mt-8 flex gap-2">
			<input
				type="text"
				bind:value={did}
				placeholder="did:plc:..."
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
			Reads <code class="text-gray-400">fm.teal.alpha.feed.play</code> records from any AT Protocol PDS.
			Enriches with MusicBrainz, Last.fm, and Deezer.
		</p>
	</div>
</div>
