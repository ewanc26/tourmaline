<script lang="ts">
	import { BarChart3, Brain, CalendarDays, Fingerprint, Gem, Music, Shield, Eye } from '@lucide/svelte';

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
	<link rel="canonical" href="https://tourmaline.croft.click" />

	<!-- Open Graph -->
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://tourmaline.croft.click" />
	<meta property="og:title" content="Tourmaline — AT Protocol Scrobble Analyser" />
	<meta property="og:description" content="Discover what kind of listener you are. Analyses Teal.fm scrobbles from any AT Protocol account." />

	<!-- Twitter / X card -->
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content="Tourmaline — AT Protocol Scrobble Analyser" />
	<meta name="twitter:description" content="Discover what kind of listener you are. Analyses Teal.fm scrobbles from any AT Protocol account." />
</svelte:head>

<main>
	<!-- ── Hero ─────────────────────────────────────────────────────────────── -->
	<section class="hero">
		<div class="logo-wrap">
			<img src="/logo.svg" alt="Tourmaline" width={120} height={120} />
		</div>
		<p class="wordmark">Tourmaline</p>
		<p class="eyebrow">Open source · Read-only · No account needed</p>
		<h1>Discover what kind of<br />listener you are.</h1>
		<p class="sub">
			Tourmaline analyses your
			<a href="https://teal.fm" target="_blank" rel="noopener">Teal</a>
			scrobbles from any AT Protocol account — genres, moods, eras, obscurity, and a
			personality archetype.
		</p>

		<form onsubmit={(e) => { e.preventDefault(); analyse(); }} class="hero-form">
			<input
				type="text"
				bind:value={identifier}
				placeholder="ewancroft.uk or did:plc:..."
				class="hero-input"
				disabled={loading}
			/>
			<button
				type="submit"
				class="btn-primary"
				disabled={loading}
			>
				{loading ? 'Analysing...' : 'Analyse'}
			</button>
		</form>

		{#if error}
			<p class="error">{error}</p>
		{/if}

		<p class="hero-note">
			Reads <code>fm.teal.alpha.feed.play</code> records from the user's PDS. Enriches with
			MusicBrainz, Last.fm, and Deezer.
		</p>
	</section>

	<!-- ── Features ─────────────────────────────────────────────────────────── -->
	<section class="features">
		<div class="feature-card">
			<span class="feature-icon"><BarChart3 size={20} /></span>
			<h3>Top artists &amp; tracks</h3>
			<p>Ranked lists of your most-played artists, tracks, and albums with play counts.</p>
		</div>
		<div class="feature-card">
			<span class="feature-icon"><Music size={20} /></span>
			<h3>Genre profile</h3>
			<p>MusicBrainz tags and Last.fm genres mapped to a weighted genre chart.</p>
		</div>
		<div class="feature-card">
			<span class="feature-icon"><Brain size={20} /></span>
			<h3>Mood mapping</h3>
			<p>Energy, melancholy, tension, brightness — derived from genre weights.</p>
		</div>
		<div class="feature-card">
			<span class="feature-icon"><CalendarDays size={20} /></span>
			<h3>365-day heatmap</h3>
			<p>A full year of listening at a glance. Spot patterns, gaps, and spikes.</p>
		</div>
		<div class="feature-card">
			<span class="feature-icon"><Fingerprint size={20} /></span>
			<h3>Personality archetype</h3>
			<p>The Curator, The Explorer, The Loyalist — your listener profile in a few words.</p>
		</div>
		<div class="feature-card">
			<span class="feature-icon"><Gem size={20} /></span>
			<h3>Obscurity index</h3>
			<p>How deep into the catalog do you go? Scored from mainstream to obscure.</p>
		</div>
		<div class="feature-card">
			<span class="feature-icon"><Eye size={20} /></span>
			<h3>Diversity score</h3>
			<p>Measures breadth across artists and genres. Are you a generalist or a specialist?</p>
		</div>
		<div class="feature-card">
			<span class="feature-icon"><Shield size={20} /></span>
			<h3>Read-only</h3>
			<p>No sign-in required. Reads public scrobbles from any PDS. Nothing is written.</p>
		</div>
	</section>

	<!-- ── How it works ─────────────────────────────────────────────────────── -->
	<section class="how">
		<h2>How it works</h2>
		<ol class="steps-list">
			<li>
				<span class="step-num">1</span>
				<div>
					<strong>Enter a handle</strong>
					<p>Any AT Protocol handle or DID. No sign-in, no app password.</p>
				</div>
			</li>
			<li>
				<span class="step-num">2</span>
				<div>
					<strong>Fetch scrobbles</strong>
					<p>
						<code>fm.teal.alpha.feed.play</code> records are read from the user's PDS.
						Repeat visits only fetch new scrobbles since last time.
					</p>
				</div>
			</li>
			<li>
				<span class="step-num">3</span>
				<div>
					<strong>Analyse</strong>
					<p>
						Scrobbles are aggregated into top artists, genres, moods, era preference,
						diversity, obscurity, and a personality archetype.
					</p>
				</div>
			</li>
			<li>
				<span class="step-num">4</span>
				<div>
					<strong>Enrich</strong>
					<p>
						Top artists are enriched with genre data from MusicBrainz, listener counts
						from Last.fm, and images from Deezer — after the profile is already visible.
					</p>
				</div>
			</li>
		</ol>
	</section>

	<!-- ── CTA ──────────────────────────────────────────────────────────────── -->
	<section class="cta">
		<h2>Try it</h2>
		<p>Enter any Bluesky handle or AT Protocol DID. No account needed.</p>
		<form onsubmit={(e) => { e.preventDefault(); analyse(); }} class="cta-form">
			<input
				type="text"
				bind:value={identifier}
				placeholder="ewancroft.uk or did:plc:..."
				class="hero-input"
				disabled={loading}
			/>
			<button
				type="submit"
				class="btn-primary"
				disabled={loading}
			>
				{loading ? 'Analysing...' : 'Analyse'}
			</button>
		</form>
	</section>
</main>

<style>
	main {
		max-width: 720px;
		margin: 0 auto;
		padding: 4rem 1.5rem 5rem;
	}

	/* ── Hero ───────────────────────────────────────────────────────────────── */
	.hero {
		text-align: center;
		padding: 3rem 0 3.5rem;
	}

	.logo-wrap {
		display: flex;
		justify-content: center;
		margin-bottom: 0.75rem;
	}

	.wordmark {
		font-size: clamp(2rem, 5vw, 2.75rem);
		font-weight: 600;
		letter-spacing: -0.02em;
		color: #e5e7eb;
		margin: 0 0 0.5rem;
	}

	.eyebrow {
		font-size: 0.75rem;
		font-family: 'JetBrains Mono', monospace;
		color: #4ade80;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		margin: 0 0 1.25rem;
	}

	h1 {
		font-size: clamp(1.65rem, 4vw, 2.5rem);
		font-weight: 600;
		line-height: 1.2;
		letter-spacing: -0.03em;
		color: #f3f4f6;
		margin: 0 0 1.25rem;
	}

	.sub {
		font-size: 1.05rem;
		color: #9ca3af;
		line-height: 1.6;
		max-width: 480px;
		margin: 0 auto 2.25rem;
	}

	.sub a {
		color: #4ade80;
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.sub a:hover {
		color: #86efac;
	}

	.hero-form {
		display: flex;
		gap: 0.5rem;
		max-width: 480px;
		margin: 0 auto;
	}

	.hero-input {
		flex: 1;
		padding: 0.65rem 1rem;
		background: #111827;
		border: 1px solid #374151;
		border-radius: 6px;
		color: #f3f4f6;
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.875rem;
	}

	.hero-input:focus {
		outline: none;
		border-color: #22c55e;
	}

	.hero-input::placeholder {
		color: #4b5563;
	}

	.btn-primary {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: #16a34a;
		color: #fff;
		font-weight: 600;
		font-size: 0.9rem;
		padding: 0.65rem 1.25rem;
		border-radius: 6px;
		border: none;
		cursor: pointer;
		white-space: nowrap;
		transition: background 0.15s, transform 0.1s;
	}

	.btn-primary:hover {
		background: #15803d;
		transform: translateY(-1px);
	}

	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		transform: none;
	}

	.error {
		color: #f87171;
		font-size: 0.85rem;
		margin-top: 0.75rem;
	}

	.hero-note {
		font-size: 0.75rem;
		color: #4b5563;
		margin-top: 1.5rem;
	}

	.hero-note code {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.82em;
		color: #6b7280;
		background: #111827;
		padding: 0.1em 0.35em;
		border-radius: 3px;
	}

	/* ── Features ─────────────────────────────────────────────────────────── */
	.features {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
		gap: 0.75rem;
		margin-bottom: 4rem;
	}

	.feature-card {
		background: #111827;
		border: 1px solid #1f2937;
		border-radius: 10px;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.feature-icon {
		color: #4ade80;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
	}

	.feature-card h3 {
		font-size: 0.9rem;
		font-weight: 500;
		color: #e5e7eb;
		margin: 0;
	}

	.feature-card p {
		font-size: 0.8rem;
		color: #9ca3af;
		line-height: 1.5;
		margin: 0;
	}

	/* ── How it works ─────────────────────────────────────────────────────── */
	.how {
		margin-bottom: 4rem;
	}

	h2 {
		font-size: 1.25rem;
		font-weight: 500;
		color: #e5e7eb;
		margin: 0 0 1.5rem;
		letter-spacing: -0.02em;
	}

	.steps-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.steps-list li {
		display: flex;
		gap: 1.25rem;
		align-items: flex-start;
		padding: 1.25rem 0;
		border-bottom: 1px solid #1f2937;
	}

	.steps-list li:last-child {
		border-bottom: none;
	}

	.step-num {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: #111827;
		border: 1.5px solid #1f2937;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.75rem;
		font-family: 'JetBrains Mono', monospace;
		color: #4ade80;
		flex-shrink: 0;
		margin-top: 1px;
	}

	.steps-list strong {
		display: block;
		font-size: 0.9rem;
		font-weight: 500;
		color: #e5e7eb;
		margin-bottom: 0.2rem;
	}

	.steps-list p {
		font-size: 0.825rem;
		color: #9ca3af;
		line-height: 1.5;
		margin: 0;
	}

	.steps-list code {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.82em;
		color: #4ade80;
		background: #111827;
		padding: 0.1em 0.35em;
		border-radius: 3px;
	}

	/* ── CTA ───────────────────────────────────────────────────────────────── */
	.cta {
		background: #111827;
		border: 1px solid #1f2937;
		border-radius: 12px;
		padding: 2.5rem;
		text-align: center;
		margin-bottom: 3rem;
	}

	.cta h2 {
		margin-bottom: 0.5rem;
	}

	.cta p {
		font-size: 0.875rem;
		color: #9ca3af;
		margin: 0 0 1.75rem;
	}

	.cta-form {
		display: flex;
		gap: 0.5rem;
		max-width: 480px;
		margin: 0 auto;
	}

	/* ── Responsive ───────────────────────────────────────────────────────── */
	@media (max-width: 640px) {
		.hero-form,
		.cta-form {
			flex-direction: column;
		}

		.hero {
			padding: 1.5rem 0 2.5rem;
		}

		.features {
			grid-template-columns: 1fr 1fr;
		}

		.cta {
			padding: 1.75rem 1.25rem;
		}
	}

	@media (max-width: 400px) {
		.features {
			grid-template-columns: 1fr;
		}
	}
</style>
