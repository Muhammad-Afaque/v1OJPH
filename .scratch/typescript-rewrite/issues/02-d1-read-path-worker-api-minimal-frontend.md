# 02 — D1 read path + Worker API + minimal frontend

**What to build:** Create a Cloudflare Worker with a `GET /api/jobs` endpoint that reads from D1 and returns paginated, filtered, sorted Job Listings. Create a minimal vanilla TypeScript frontend that calls this endpoint and displays jobs in a list. This ticket validates the entire read path: D1 → Worker API → Frontend.

**Blocked by:** 01 — Project scaffolding + D1 write path

**Status:** done

- [ ] Cloudflare Worker setup with Hono or itty-router
- [ ] `GET /api/jobs` endpoint: pagination, sort, filter by category/type
- [ ] CORS headers for local development
- [ ] Worker responds with `{ jobs, total, page, limit, totalPages }`
- [ ] Minimal frontend: HTML page that fetches `/api/jobs` and renders job cards
- [ ] Frontend served via `wrangler pages dev`
- [ ] `wrangler dev` shows jobs in browser end-to-end
- [ ] Unit tests for API endpoint responses
