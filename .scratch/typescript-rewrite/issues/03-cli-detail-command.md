# 03 — CLI detail command

**What to build:** Implement the `detail` subcommand that enriches Job Listings with Job Detail data by scraping individual job pages. Supports incremental updates (skips already-enriched jobs) and graceful error handling (retry on 429/503, skip on 404).

**Blocked by:** 01 — Project scaffolding + D1 write path

**Status:** ready-for-agent

- [ ] `npx ojph detail` subcommand
- [ ] Phase 2 scraper: fetches each job's detail page, parses description/work_type/hours/date_updated
- [ ] Reads existing job_ids from D1 to skip already-enriched jobs
- [ ] Writes enriched fields back to D1 via upsert
- [ ] HTTP error handling: retry on 429/503 (max 3 attempts), skip on 404
- [ ] Configurable delay between requests (default 1s)
- [ ] Progress logging to stdout with timestamps
- [ ] Unit tests for detail page parsing logic
