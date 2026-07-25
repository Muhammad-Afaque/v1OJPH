# Spec: TypeScript Rewrite - OnlineJobs.ph Scraper

## Problem Statement

The OnlineJobs.ph scraper is a Python codebase (~700 lines across 5 files) that scrapes job listings, enriches them with detail data, categorizes them, and serves a frontend dashboard. The system has several pain points:

1. **Performance**: The frontend loads 70MB of JSON chunks into the browser, causing slow initial load times
2. **Portability**: The Python backend requires a server process and doesn't deploy cleanly to Cloudflare
3. **Maintainability**: The codebase is split across multiple Python files with shell script orchestration
4. **Scalability**: The current chunk-based architecture doesn't scale well with growing data (~20MB/month growth)

## Solution

Rewrite the entire system in TypeScript, deploying on Cloudflare (D1 + Workers + Pages). The scraper becomes a CLI tool with subcommands, the data lives in D1 (SQLite on Cloudflare), and the frontend is a vanilla TypeScript SPA served from Cloudflare Pages.

Key improvements:
- D1 eliminates 70MB chunk loading - queries return only what's needed
- Worker API serves filtered/paginated results server-side
- Single language (TypeScript) across scraper, API, and frontend
- Cloudflare free tier handles the entire workload

## User Stories

### Scraper CLI

1. As a developer, I want to run `npx ojph list` to scrape Job Listings, so that I can collect new job postings
2. As a developer, I want `npx ojph list --keywords wordpress,shopify` to run keyword-targeted searches, so that I can capture niche jobs
3. As a developer, I want `npx ojph detail` to enrich Job Listings with Job Detail data, so that I have complete job information
4. As a developer, I want `npx ojph detail` to skip already-enriched jobs (incremental update), so that I don't re-scrape existing data
5. As a developer, I want `npx ojph categorize` to classify all jobs into Categories based on title and Tags, so that jobs are organized
6. As a developer, I want `npx ojph pipeline` to run all three phases sequentially, so that I can execute the full chain in one command
7. As a developer, I want the CLI to support `--dry-run` flag, so that I can verify behavior safely
8. As a developer, I want the scraper to handle HTTP errors gracefully (retry on 429/503, skip on 404), so that transient failures don't crash the pipeline
9. As a developer, I want the scraper to respect rate limits with configurable delays, so that I don't get blocked

### D1 Database

10. As a user, I want all Job Listings stored in D1 with full Job Detail data, so that I can query them via the API
11. As a user, I want a full-text search index (FTS5) on title, company, description, and Tags, so that I can search jobs quickly
12. As a user, I want the database schema to support incremental updates (upsert on job_id), so that repeated runs don't create duplicates
13. As a user, I want user-editable fields (email, extra_description, custom_notes) stored in D1, so that my notes persist across sessions
14. As a user, I want the D1 schema to include all scraped fields, so that no data is lost

### Worker API

15. As a user, I want `GET /api/jobs` to return paginated, filtered, sorted Job Listings from D1, so that the frontend loads fast
16. As a user, I want `GET /api/jobs?search=wordpress` to perform full-text search, so that I can find relevant jobs
17. As a user, I want `GET /api/jobs?category=VA&type=Full+Time` to filter by Category and Work Type, so that I can narrow results
18. As a user, I want `GET /api/jobs?salary_min=500&salary_max=2000` to filter by salary range, so that I can find jobs in my budget
19. As a user, I want `GET /api/jobs?sort=posted&order=desc` to sort results, so that I can see newest jobs first
20. As a user, I want `GET /api/jobs/:id` to return a single Job Detail, so that I can view full job information
21. As a user, I want `POST /api/jobs/:id/notes` to save user-editable fields, so that I can annotate jobs
22. As a user, I want `GET /api/stats` to return aggregate statistics, so that the dashboard can render charts
23. As a user, I want the API to return CORS headers, so that the frontend can call it during development

### Frontend Dashboard

24. As a user, I want a dashboard view showing total jobs, top Category, salary statistics, and work type distribution
25. As a user, I want a doughnut chart showing Category distribution
26. As a user, I want a bar chart showing Work Type distribution
27. As a user, I want a line chart showing posting timeline (last 30 days)
28. As a user, I want a bar chart showing salary ranges
29. As a user, I want a tag cloud showing top 20 Tags
30. As a user, I want a browse view with a job list panel and detail panel
31. As a user, I want the job list to show title, company, salary, Work Type, posted date, and Category badge
32. As a user, I want to search jobs by typing in a search box
33. As a user, I want to filter by Category using checkboxes
34. As a user, I want to filter by Work Type using toggle chips
35. As a user, I want to filter by salary range using min/max inputs
36. As a user, I want to filter by date range using date pickers
37. As a user, I want to sort by posted date, title, company, or salary
38. As a user, I want pagination with 50 jobs per page
39. As a user, I want to click a job card to see full details in the detail panel
40. As a user, I want to save my email, extra description, and custom notes for each job
41. As a user, I want notes to persist in D1 via the Worker API
42. As a user, I want to export filtered results as CSV
43. As a user, I want the frontend to be responsive (works on mobile and desktop)
44. As a user, I want the dark theme UI preserved from the current design

## Implementation Decisions

### Modules to Build

1. **CLI Entry Point** - Single CLI with subcommands using citty
2. **Phase 1 Scraper** - Scrapes paginated Job Listings from OnlineJobs.ph
3. **Phase 2 Scraper** - Enriches Job Listings with Job Detail data
4. **Phase 3 Categorizer** - Classifies jobs into Categories using keyword matching
5. **Pipeline Runner** - Chains Phase 1, 2, 3 sequentially
6. **D1 Client** - Database access layer for D1 and local SQLite
7. **Local Storage** - Fallback for local development without D1
8. **Worker API** - Cloudflare Worker handling all API endpoints
9. **Frontend** - Vanilla TypeScript SPA

### D1 Schema

```sql
CREATE TABLE jobs (
  job_id TEXT PRIMARY KEY,
  title TEXT,
  company TEXT,
  type TEXT,
  salary TEXT,
  posted TEXT,
  url TEXT,
  tags TEXT,  -- JSON array stored as text
  scraped_at TEXT,
  job_title TEXT,
  work_type TEXT,
  salary_detail TEXT,
  hours TEXT,
  date_updated TEXT,
  description TEXT,
  company_detail TEXT,
  contact_person TEXT,
  detail_scraped_at TEXT,
  category TEXT,
  email TEXT DEFAULT '',
  extra_description TEXT DEFAULT '',
  custom_notes TEXT DEFAULT '[]',  -- JSON array stored as text
  source_info TEXT DEFAULT '',
  status TEXT DEFAULT '',
  contact_info TEXT DEFAULT '',
  notes TEXT DEFAULT ''
);

CREATE VIRTUAL TABLE jobs_fts USING fts5(
  title, company, description, tags,
  content='jobs',
  content_rowid='rowid'
);
```

### API Endpoints

- `GET /api/jobs` - List jobs with filters, search, sort, pagination
- `GET /api/jobs/:id` - Get single job detail
- `POST /api/jobs/:id/notes` - Save user-editable fields
- `GET /api/stats` - Aggregate statistics for dashboard

### Tooling

- Runtime: Bun
- Build: tsup
- HTML Parser: cheerio
- CLI Framework: citty
- Linter: biome
- Test Runner: bun:test

### Migration Strategy

Big bang - rewrite everything in TypeScript, delete Python files after verifying TS works.

## Testing Decisions

### Test Approach

- Test external behavior (API responses, CLI output), not implementation details
- Each module can be tested independently through its public interface
- Use `bun:test` for unit tests
- Integration tests against local D1 (SQLite via wrangler dev)

### Modules to Test

1. **Scraper** - Mock HTTP responses, verify parsing logic
2. **Categorizer** - Test classification rules against known inputs
3. **D1 Client** - Test against local SQLite
4. **Worker API** - Test endpoint responses

### Prior Art

No existing tests in the codebase. This will be the first test suite.

## Out of Scope

1. **Authentication** - Single user, no auth needed for the notes API
2. **User management** - No multi-user support
3. **Advanced search** - FTS5 is sufficient, no Elasticsearch needed
4. **Real-time updates** - Polling is fine, no WebSockets needed
5. **Python code preservation** - Python files will be deleted
6. **Vercel deployment** - Moving to Cloudflare entirely
7. **Historical data migration** - The import_historical.py script stays as-is

## Further Notes

### Existing Data Migration

The current 34K jobs (~70MB) need to be imported into D1. This can be done via:
1. Wrangler CLI: `wrangler d1 import ojph-db --file=chunks/*.json`
2. Or a one-time migration script that reads chunks and inserts into D1

### Cloudflare Free Tier Limits

- D1: 5GB storage, 5M reads/day, 100K writes/day
- Workers: 100K requests/day
- Pages: Unlimited static serving
- Current workload: ~34K jobs, growing ~20MB/month - well within limits

### Local Development

- `wrangler dev` provides D1 local emulation via SQLite
- Scraper runs locally with `npx ojph list/detail/categorize/pipeline`
- Frontend built and served via `wrangler pages dev`
