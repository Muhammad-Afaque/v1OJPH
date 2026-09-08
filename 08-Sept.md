# 08-Sept-2026 — Working Notes

Working session log for the OnlineJobs.ph scraper. Today's ticket:
**fix the live frontend showing stale/no current jobs after the D1 migration.**

---

## The Issue

- The GitHub Actions workflow scrapes OnlineJobs.ph, enriches details, and
  categorizes each Job Listing, then upserts everything into Cloudflare D1.
- The deployed frontend at `https://ojph.wpninja.org/` is a **static site on
  Vercel** (`frontend/index.html`); it does NOT read D1. It only fetches
  pre-generated JSON `chunk_001.json … chunk_050.json` files via `fetch()`.
- The new TS/D1 pipeline removed the old step that generated and committed
  the chunk files, so the live site kept serving **stale chunk files from
  May 2026**, and after the last pipeline rewrote D1, the site shows data
  that is no longer current.

## Root-Cause Research

1. **Frontend data loading** (`frontend/index.html`, `loadAllJobs()`):
   - Fetches `chunks/chunk_042.json`-style paths for chunk numbers 1..50.
   - Uses `Promise.all`; a missing/failed chunk resolves to `[]`.
   - Only throws if `allJobs.length === 0`.
   - The page references **nothing else** (no `jobs.json`, no
     `enriched_jobs.json`), so the chunk files are the only data source.

2. **Proven Vercel deployment mechanism**:
   - Live `chunk_001.json` is **byte-identical** to the repo file
     (`chunks/chunk_001.json`, 10,543,999 bytes, 3,267 jobs, first
     `posted` 2026-05-18) ⇒ **Vercel auto-redeploys from pushes to main**;
     the repo's `chunks/` directory is what's being served.

3. **The stale chunk files are also corrupt**:
   - `chunks/chunk_007.json` and `frontend/chunks/chunk_007.json` are
     committed **truncated** (8,471,744 bytes, ends mid-JSON) — this was
     checked into git as-is (commit `0025319` "feat: split enriched_jobs.json
     into 10MB chunks for GitHub compliance").
   - So chunks 1–6 hold ~20,826 jobs; chunk 7 fails `JSON.parse` on the
     frontend and is silently skipped.

4. **D1 is now the source of truth**:
   - D1 holds ~9,504 job IDs.
   - The Python-era chunks held ~22.8k jobs (7 × ~3,267) — much of that data
     predates the D1 pipeline and would be dropped when regenerating.

5. **Old workflow vs current workflow** (history):
   - Old (`df18a89`): `on: schedule + workflow_dispatch` (no `on: push`),
     `permissions: contents: write`, and a `git-auto-commit-action@v5` step
     with `file_pattern: 'enriched_jobs.json jobs.json categories/ chunks/
     frontend/chunks/'`.
   - Current (`28b3481`): added `on: push` and removed the data commit step
     when the pipeline moved to D1. This is why chunks went stale.

## Constraints (from user)

- No new D1 instances.
- No new Cloudflare Workers.
- No API setup that would create Cloudflare billing costs.
- No DNS changes.

A Worker-based `/api` alternative exists (`src/worker.ts` is a Hono app) and
was implemented/tested previously, but it is **ruled out** by these
constraints (also has a missing `export default app` defect, deferred).

## The Fix (chosen approach — stays in constraints)

After the pipeline writes to D1, **export the D1 dataset back into
`chunks/*.json` and commit them**. Vercel auto-redeploys from those pushes,
so the live site gets fresh chunks without any new infrastructure.

Implementation steps:

1. **D1 client** — add `getAll(): Promise<Job[]>` to the D1 client interface
   and implementation:
   - `SELECT * FROM jobs`, then `deserializeJob()` on each row.
   - (`src/db/d1.ts`)

2. **Chunk module** (`src/chunks.ts`, new):
   - `DEFAULT_CHUNK_BYTES = 10 * 1024 * 1024` (match the old ~10MB files).
   - `splitIntoChunks(jobs, targetBytes)` — byte-budget splitting with a 4KB
     tolerance so a single oversized job never splits mid-way.
     Uses `Buffer.byteLength(JSON.stringify([job]))` for size estimation.
   - `writeChunkFiles(dir, chunks)` — writes `chunk_001.json`… `chunk_NNN.json`
     (zero-padded, compact single-line JSON arrays, matching the live format);
     **removes old `chunk_NNN.json` files not in the new set** so the frontend
     never mixes stale + fresh data.
   - `readChunkFiles(dir)` — loads all chunk jobs in file order (used for
     validation/testing).
   - Tests: `src/chunks.test.ts` (7 tests).

3. **CLI subcommand** — `ojph chunks` in `src/cli.ts`:
   - Reads all jobs from D1 via `getAll()`.
   - `splitIntoChunks()` then `writeChunkFiles()` into `chunks/` and
     `frontend/chunks/` (both are deployed/tracked; they were identical).
   - `--dirs` arg allows overriding the output dirs (default
     `chunks,frontend/chunks`).

4. **Workflow** (`.github/workflows/scrape.yml`):
   - After the pipeline step: `node dist/cli.js chunks`.
   - Restore `git-auto-commit-action@v5` with
     `file_pattern: 'chunks/ frontend/chunks/'`.
   - Add `paths-ignore: ['chunks/**', 'frontend/chunks/**']` to the
     `on: push` trigger so data-only pushes do **not** re-trigger the full
     scrape (prevents infinite CI loop); Vercel still redeploys because the
     data commit lands on main.
   - Requires the workflow to keep `permissions: contents: write` (already
     present) and `environment: Production` for the CI secrets.

## Verification so far

- **Tests:** 7/7 test files pass, 81 tests total (added:
  `src/db/d1.test.ts` getAll tests → 11 total in file;
  `src/chunks.test.ts` → 7 tests).
- **Typecheck:** `tsc --noEmit` clean.
- **Split/write verified at volume:** read the 6 parseable old chunks
  (20,826 jobs), re-split → exactly 6 chunks, each
  ~9.56–10.00 MB, matching the old file format.
- **Local D1 live test blocked:** the local `.env` CF API token returns
  `401 Unauthorized` from the D1 HTTP API (a known local-only issue; the CI
  `Production` secrets are valid). `getAll()` is nonetheless covered by the
  mocked-fetch tests.

## Notes / gotchas

- `chunk_007.json` is committed truncated in both `chunks/` and
  `frontend/chunks/` — our `writeChunkFiles` removes stale chunk files, so a
  regenerate will drop it automatically.
- Regenerating from D1 will reduce the frontend's job count from ~20.8k
  (stale, pre-D1) to ~9.5k (current). Accepted tradeoff: fresher data.

## Status / next steps

- [x] Root-cause confirmed (stale/corrupt committed chunks + pipeline no
      longer emits them)
- [x] `getAll()` + tests
- [x] `chunks` module + tests
- [x] `ojph chunks` CLI subcommand + build
- [x] `scrape.yml` updated (export step, git-auto-commit, push paths-ignore)
- [x] Full `npm run lint` attribution for src (formatter-only cleanup of the
      files I touched is pending → done: `biome check --write` on the 5
      touched files; only pre-existing `mockD1 as any` remains, not fixable
      in-ticket)
- [x] Regenerate chunks locally against live D1 — **the local token works
      now** (no longer 401; run via `node --env-file=.env dist/cli.js chunks`):
      wrote 4 chunks (9,610 unique jobs, newest `posted` 2026-09-08 05:47,
      all valid JSON, both dirs byte-identical); stale corrupt chunks 5–7 (incl.
      committed-truncated `chunk_007.json`) deleted
- [ ] Commit + push; watch CI export chunks; confirm Vercel redeploy and
      current jobs on the live site

### 2026-09-08 session notes

- Restored `package.json`/`package-lock.json` (only line-ending churn from the
  prior session; content identical to HEAD).
- `npm install` re-added an `allowScripts` block to `package.json` (machine
  npm policy); **reverted** to keep the ticket diff focused. If the repo wants
  reproducible installs with that policy, commit it deliberately.
- Biome's `cli-linux-x64` platform binary was missing → approved via
  `npm install-scripts approve @biomejs/biome esbuild workerd` (local only).
- Typecheck clean; build succeeds; 81/81 tests pass.

## Second session (same day): data-loss fix + new frontend

User: previously-scraped (pre-D1) jobs must stay visible alongside new ones.

**Root cause of the data loss:** D1 (`src/worker.ts`-era pipeline) is the
source of truth and only held ~9.7k jobs. The older **33,476 jobs** from the
Python era existed ONLY in `enriched_jobs.json` (last full copy: commit
`7ed19bc`, 104.6 MB) and the 20.8k-job chunk files; they had never been
migrated into D1. Regenerating chunks from D1 alone dropped them all.
(Note: chunk_007 truncated at commit time — that ~12.6k loss predates us and
is not recoverable; the 33,476-job `enriched_jobs.json` is the complete set.)

**What was done:**
- `d1.ts`: extracted `JOB_COLUMNS`; rewrote `upsertBatch` to multi-row
  `INSERT OR REPLACE` in batches of 3 rows — D1's SQLite build caps bound
  variables at 99/statement (26 cols × 3 = 78); parallel backfill streams.
- `cli.ts`: new `ojph backfill --from <json…>` imports legacy Job arrays,
  skipping IDs already in D1; runs 8 concurrent upsert streams.
- Backfilled `7ed19bc:enriched_jobs.json` (33,476 jobs, 0 overlap) into D1
  → D1 = **43,188** unique jobs.
- Regenerated chunks: **14 files × ~10 MB**, 43,188 jobs, both
  `chunks/` and `frontend/chunks/` byte-identical. Oldest posted 2026-05-07
  (legacy), newest 2026-09-08 (today).
- **New frontend:** user wanted the nicer `frontend-new` UI (dark, searchable,
  filter/sort/paginated) instead of the old one; chose chunk-based loading
  (no Worker API). Rewrote its JS to load `chunks/chunk_NNN.json`
  client-side with search/category/sort/pagination. Deployed as
  `frontend/index.html`; `frontend-new/` deleted.
- AGENTS.md: added hard rule — never store work in temp dirs.

**Pending:** commit + push (push currently blocked: the git OAuth token has no
`workflow` scope, which is required because the commit touches
`.github/workflows/`).

### Same-day incident: D1 free-tier daily write quota

- Cloudflare began **enforcing** D1 free-tier limits on 2026-09-01: 100,000
  rows written/day, reset at 00:00 UTC. The 33.5k-row backfill (+ hourly
  pipeline writes) exhausted today's budget → CI pipeline failed at the
  "Writing N jobs to D1" step with code 7500 "exceeded D1's free tier daily
  row write limit". Reads kept working; the 43,188-row dataset is intact.
- Fix (committed): `isD1WriteQuotaError()` detector in `d1-http.ts`; the
  pipeline and `backfill` now treat the quota error as recoverable — log a
  warning and continue, so the workflow still exports + commits chunks
  (frontend stays fresh). Unwritten jobs remain "new" and are picked up on a
  later run. No data was lost.
- Operations: next successful write happens on the first run after 00:00 UTC.