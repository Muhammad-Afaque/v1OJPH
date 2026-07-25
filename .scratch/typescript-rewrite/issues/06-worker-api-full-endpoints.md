# 06 — Worker API — full endpoints

**What to build:** Implement all remaining Worker API endpoints: single job lookup, notes save, and aggregate statistics. Includes FTS5 full-text search.

**Blocked by:** 01 — Project scaffolding + D1 write path

**Status:** ready-for-agent

- [ ] `GET /api/jobs/:id` returns single job detail
- [ ] `POST /api/jobs/:id/notes` saves email, extra_description, custom_notes to D1
- [ ] `GET /api/stats` returns aggregate statistics (category counts, work type distribution, salary ranges, posting timeline, top tags)
- [ ] `GET /api/jobs?search=wordpress` uses FTS5 for full-text search across title, company, description, tags
- [ ] `GET /api/jobs?salary_min=500&salary_max=2000` filters by salary range
- [ ] `GET /api/jobs?date_from=2026-01-01&date_to=2026-07-01` filters by date range
- [ ] Unit tests for each endpoint
