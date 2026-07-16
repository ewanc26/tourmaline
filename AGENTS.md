# AGENTS.md

Guidance for agents working on Tourmaline. This repository is archived; maintained code lives in `pkgs/packages/tourmaline`.

## Data flow

The SvelteKit app resolves a handle/DID, discovers the user's PDS, reads `fm.teal.alpha.feed.play` records, aggregates listening history, enriches artists through public music APIs, and builds a listener profile.

## Rules

- Make maintained fixes in `pkgs` unless an archival backport is explicitly requested.
- Handles are mutable and DIDs stable. Validate DID documents, PDS service endpoints, cursors, records, and timestamps.
- Bound pagination, concurrency, caching, and external enrichment. Partial API failure must not corrupt core play statistics.
- Keep aggregation deterministic and separate factual counts from heuristic mood/obscurity analysis.
- Never expose server credentials or log private tokens.

## Validation

For an intentional archive change run `npm run check`, `npm run lint`, and `npm run build`. Test handle/DID lookup, pagination, duplicate/malformed plays, empty histories, API timeouts/rate limits, deterministic aggregates, SSR, and mobile rendering. Do not publish or duplicate new features here.
