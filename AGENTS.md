# AGENTS.md

Guidance for the archived Tourmaline standalone app. Maintained development is in `pkgs/packages/tourmaline`; use that package for fixes/features unless the user explicitly requests a historical backport. This copy is version 0.5.0 and has materially older validation, caching, analysis, and UI than the monorepo package.

## Data and request flow

- `src/lib/server/resolve.ts` resolves handles through Slingshot, fetches `did:plc`/`did:web` documents, extracts `#atproto_pds`, and reads the profile record. The profile route returns the resolved DID/PDS to the browser.
- The browser repeatedly calls `/api/scrobbles/[did]?pdsUrl=...&cursor=...`; the server fetches up to 25 pages of 100 `fm.teal.alpha.feed.play` records per call. The API currently trusts the caller-supplied PDS URL, so it is an SSRF boundary, not a harmless parameter.
- Analysis modules aggregate plays into date ranges, sessions, genres, mood, diversity, obscurity, eras, phases, remarkable days, discovery, and personality/story summaries. Components and Chart.js render those derived values.
- `/api/enrich/[did]` uses server-only `LASTFM_API_KEY` plus MusicBrainz and Deezer. Rate queues are in-memory per warm Vercel instance. Contrary to the README, this version has no SQLite/30-day response cache.
- `/share` stores derived personality data in `sessionStorage`, performs browser OAuth, renders SVG to PNG, uploads a blob, and creates an `app.bsky.feed.post`. OAuth metadata and scope live in both `static/oauth-client-metadata.json` and `src/lib/atproto/oauth.ts`.

## Trust and correctness boundaries

- DIDs identify repositories; handles are mutable. Validate DID syntax/document ID, service type/ID, HTTPS PDS endpoints, redirects, DNS/private/link-local targets, response size, content type, cursor, and repository ownership before server-side fetches. Never accept an arbitrary `pdsUrl` from the browser without binding it to a server-resolved DID document.
- Treat every Teal record field as untrusted. Missing or invalid `playedTime` currently can throw during `toISOString`; reject/sentinel malformed timestamps, require sensible artist/track shapes, bound strings/durations, and continue with an explicit invalid-record count.
- Pagination must terminate and remain associated with one DID/PDS/snapshot. Bound pages, records, range selection, enrichment batches, queued work, chart points, and memory. Upstream error bodies may contain sensitive/huge data; do not return them verbatim to clients.
- Keep raw counts and timestamps separate from heuristic genre/mood/personality/obscurity narratives. Calculations must be deterministic for the same normalized input, timezone policy must be explicit, and missing enrichment must not alter factual listening totals.
- MusicBrainz requires a truthful User-Agent and roughly one request/second. Last.fm keys stay server-side. Treat upstream artist matches/images/tags as fallible; partial enrichment should remain visible rather than fabricated or cached as authoritative forever.
- Sharing is the only write path. Keep OAuth client ID, exact redirect URIs, granular scope, blob MIME/size, and production origin aligned. Escape all card text before `{@html svgPreview}`/SVG generation, cap alt text/image size, and do not clear session state until the post succeeds.

## Working and validation

- Use pnpm, not npm. For an explicitly requested archival change run `pnpm check`, `pnpm lint`, and `pnpm build`, then preview the Vercel build. There is no automated test suite; add focused unit tests for changed analysis/parsing where practical.
- Test handle and both DID methods, hostile DID documents/PDS URLs and redirects, pagination loops/invalid cursors, malformed/duplicate/empty/large histories, timezone edges, partial/rate-limited enrichment, deterministic analysis, SSR hydration, charts, keyboard/mobile layout, OAuth denial/restore, SVG injection, blob failure, and post success.
- If backporting from `pkgs`, compare the entire relevant implementation, manifest, OAuth metadata, env contract, tests, and version rather than copying isolated files and claiming parity.
- Never run sharing against a real account as routine validation or expose the Last.fm key. Do not commit `.env`, OAuth sessions, listening histories, generated personality data/images, `.svelte-kit/`, Vercel output, caches, or `dist/`.

<!-- allowed-agents -->
## Allowed agents

Only **Claude** (Anthropic) and **Mistral** (Mistral AI) may be used as coding agents in this repository. This rule supersedes any earlier agent-attribution guidance in this file.

- Agent-assisted commits must credit only one of those agents:
  - `Co-Authored-By: Claude <noreply@anthropic.com>`
  - `Co-Authored-By: Mistral Vibe <vibe@mistral.ai>`
- Allowed agent footers are `🤖 Generated with [Claude Code](https://claude.com/claude-code)` and `🤖 Generated with [Mistral Vibe](https://mistral.ai)`.
- Do not add `Co-Authored-By:` trailers, `Generated with` footers, author names, or committer identities for any other agent or AI tool.
- Do not credit another agent in commit metadata.
