/**
 * Client-side adaptive rate limiter for enrichment APIs.
 *
 * Each ApiThrottle:
 *   - Serialises outgoing requests so they never exceed a base rate
 *   - On 429: doubles the interval (exponential backoff) and adds jitter
 *   - On sustained success: gradually recovers toward the base rate
 *
 * throttledFetch wraps window.fetch with acquire + retry logic.
 * DynamicConcurrency manages a live worker-count that shrinks under
 * error pressure and recovers after sustained success.
 */

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// ApiThrottle
// ---------------------------------------------------------------------------

export class ApiThrottle {
	readonly name: string;
	private readonly baseInterval: number;
	private currentInterval: number;
	private lastFired = 0;
	private consecutiveOk = 0;
	private pending: Array<() => void> = [];
	private draining = false;

	/** @param reqPerSec - target maximum sustained request rate */
	constructor(name: string, reqPerSec: number) {
		this.name = name;
		this.baseInterval = Math.ceil(1000 / reqPerSec);
		this.currentInterval = this.baseInterval;
	}

	/**
	 * Acquire a send slot.
	 * Resolves when enough time has passed since the last request.
	 */
	acquire(): Promise<void> {
		return new Promise((resolve) => {
			this.pending.push(resolve);
			if (!this.draining) this.drain();
		});
	}

	private async drain() {
		this.draining = true;
		while (this.pending.length > 0) {
			const now = Date.now();
			const wait = Math.max(0, this.currentInterval - (now - this.lastFired));
			if (wait > 0) await sleep(wait);
			this.lastFired = Date.now();
			this.pending.shift()!();
		}
		this.draining = false;
	}

	/** Call after every successful (non-429) response. */
	success(): void {
		this.consecutiveOk++;
		// After 10 consecutive successes, step 20% back toward base rate.
		if (this.consecutiveOk >= 10 && this.currentInterval > this.baseInterval) {
			this.currentInterval = Math.max(
				this.baseInterval,
				Math.round(this.currentInterval * 0.8)
			);
			this.consecutiveOk = 0;
			console.debug(
				`[throttle:${this.name}] recovering → ${this.rps.toFixed(2)} req/s`
			);
		}
	}

	/**
	 * Call after a 429 response. Doubles the inter-request interval.
	 * @param retryAfterMs - parsed Retry-After value in ms, if provided by the server
	 */
	limited(retryAfterMs?: number): void {
		this.consecutiveOk = 0;
		const next = retryAfterMs
			? Math.max(this.currentInterval, retryAfterMs)
			: Math.min(this.currentInterval * 2, 60_000);
		this.currentInterval = next;
		console.warn(
			`[throttle:${this.name}] 429 → interval now ${this.currentInterval}ms (${this.rps.toFixed(2)} req/s)`
		);
	}

	get rps(): number {
		return 1000 / this.currentInterval;
	}
	get interval(): number {
		return this.currentInterval;
	}
}

// ---------------------------------------------------------------------------
// Singletons — one per upstream API, shared across the whole session
// ---------------------------------------------------------------------------

/** MusicBrainz: documented limit is 1 req/s without auth */
export const MB_THROTTLE = new ApiThrottle('musicbrainz', 1);

/** Last.fm: undocumented but ~5 req/s is safe in practice */
export const LFM_THROTTLE = new ApiThrottle('lastfm', 5);

/** Deezer: undocumented; 10 req/s is conservative for JSONP */
export const DZ_THROTTLE = new ApiThrottle('deezer', 10);

// ---------------------------------------------------------------------------
// throttledFetch — drop-in fetch replacement with throttle + retry
// ---------------------------------------------------------------------------

const MAX_RETRIES = 4;

/**
 * Fetches `url` through the given throttle, retrying on 429 up to
 * MAX_RETRIES times with exponential backoff + jitter.
 *
 * Throws if all retries are exhausted or a non-retriable error occurs.
 */
export async function throttledFetch(
	url: string | URL,
	throttle: ApiThrottle,
	options?: RequestInit
): Promise<Response> {
	let attempt = 0;
	let backoff = throttle.interval;

	while (true) {
		await throttle.acquire();
		const res = await fetch(url, options);

		if (res.status !== 429) {
			throttle.success();
			return res;
		}

		// 429 — parse Retry-After if present
		const retryAfterSec = res.headers.get('Retry-After');
		const retryAfterMs = retryAfterSec ? parseInt(retryAfterSec, 10) * 1000 : undefined;
		throttle.limited(retryAfterMs);

		if (attempt >= MAX_RETRIES) {
			throw new Error(
				`[throttle:${throttle.name}] 429 after ${MAX_RETRIES} retries — giving up`
			);
		}

		backoff = Math.min(backoff * 2, 60_000);
		const jitter = Math.random() * 1000;
		console.warn(
			`[throttle:${throttle.name}] retry ${attempt + 1}/${MAX_RETRIES} in ${Math.round(backoff + jitter)}ms`
		);
		await sleep(backoff + jitter);
		attempt++;
	}
}

// ---------------------------------------------------------------------------
// DynamicConcurrency — live worker-count with feedback
// ---------------------------------------------------------------------------

export class DynamicConcurrency {
	private current: number;
	private readonly min: number;
	private readonly max: number;
	private successSinceLastError = 0;
	private readonly recoverAfter: number;

	/**
	 * @param initial     Starting worker count
	 * @param min         Floor (default 1)
	 * @param recoverAfter How many consecutive successes before adding a worker back
	 */
	constructor(initial: number, min = 1, recoverAfter = 20) {
		this.current = initial;
		this.max = initial;
		this.min = min;
		this.recoverAfter = recoverAfter;
	}

	get value(): number {
		return this.current;
	}

	/** Call when a worker completes an item without error. */
	onSuccess(): void {
		this.successSinceLastError++;
		if (this.successSinceLastError >= this.recoverAfter && this.current < this.max) {
			this.current++;
			this.successSinceLastError = 0;
			console.debug(`[concurrency] recovered to ${this.current} workers`);
		}
	}

	/** Call when a worker hits a retriable error (e.g. 429 exhausted). */
	onError(): void {
		this.successSinceLastError = 0;
		if (this.current > this.min) {
			this.current--;
			console.warn(`[concurrency] reduced to ${this.current} workers`);
		}
	}
}

// ---------------------------------------------------------------------------
// runAdaptive — concurrent runner with live concurrency adjustment
// ---------------------------------------------------------------------------

/**
 * Processes `items` with dynamic concurrency.
 *
 * `process` should return `true` on success, `false` on a retriable error.
 * The concurrency is adjusted up/down based on these signals.
 *
 * `onDone` is called after each item completes (success or error) —
 * use it to update progress UI and yield to the browser.
 */
export async function runAdaptive<T>(
	items: T[],
	concurrency: DynamicConcurrency,
	process: (item: T) => Promise<boolean>,
	onDone: () => Promise<void>
): Promise<void> {
	let next = 0;
	let active = 0;
	let resolve!: () => void;

	const done = new Promise<void>((r) => (resolve = r));

	function trySpawn() {
		while (active < concurrency.value && next < items.length) {
			active++;
			const item = items[next++];
			process(item)
				.then((ok) => {
					if (ok) concurrency.onSuccess();
					else concurrency.onError();
				})
				.catch(() => {
					concurrency.onError();
				})
				.finally(async () => {
					await onDone();
					active--;
					trySpawn();
					if (active === 0 && next >= items.length) resolve();
				});
		}
		if (active === 0 && next >= items.length) resolve();
	}

	trySpawn();
	await done;
}
