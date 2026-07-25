# 01 — Project scaffolding + D1 write path

**What to build:** Set up the TypeScript project structure, create the D1 schema, implement the CLI entry point with the `list` subcommand that scrapes Job Listings from OnlineJobs.ph and writes them to D1. This ticket validates the entire write path: scraper → D1.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Project scaffolding: package.json, tsconfig.json, wrangler.toml, biome.json, tsup.config.ts
- [ ] D1 schema: jobs table with all fields, FTS5 virtual table for search
- [ ] D1 client module: upsert, query, and read operations
- [ ] CLI entry point using citty with `list` subcommand
- [ ] Phase 1 scraper: paginated listing scrape with keyword support
- [ ] Scraper writes to D1 via upsert (incremental update, no duplicates)
- [ ] `npx ojph list` runs and stores jobs in local D1 (via wrangler dev)
- [ ] Unit tests for D1 client and scraper parsing logic
