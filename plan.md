OnlineJobs.ph Scraper — Context Transfer
Background: I am a WordPress developer from Pakistan working on a side project to scrape job listings from OnlineJobs.ph. I have built two scripts so far which I will paste below.
What I have built:
main.py — A Python/BeautifulSoup scraper that hits https://www.onlinejobs.ph/jobseekers/jobsearch and extracts job cards from the listing page. Currently scrapes only page 1 (~30 jobs). Extracts: title, company (from logo alt), job type, salary, posted date, job URL, tags. Company shows N/A when employer hides their logo — this is intentional platform behavior, not a bug.
ojph_scraper.sh — A bash script that takes a CSV of URLs as input, visits each individual job detail page, and scrapes: contact person, work type, salary, hours/week, date updated, job description, job title. It handles duplicates by labeling them (duplicate, duplicate-2, etc), retries on failure, and logs everything. Does NOT currently scrape company name from detail pages.
Key technical findings:

onlinejobs.ph (v1) is PHP/Laravel, fully server-rendered — curl works fine with browser User-Agent headers
v2.onlinejobs.ph is Next.js with RSC — not being used, skip entirely
Pagination URL pattern: https://www.onlinejobs.ph/jobseekers/jobsearch/{page} — 10 jobs per page, ~300 total across 30 pages
Company name on detail pages needs to be investigated — selector unknown yet

What needs to be built (in phases):
Phase 1 — Fix main.py: add pagination loop (30 pages), output to JSON file instead of printing, add job ID for deduplication
Phase 2 — Fix ojph_scraper.sh: add company name extraction from individual job detail pages, make it accept JSON input from Phase 1 output instead of manual CSV, produce one enriched output with all fields combined
Phase 3 — Filtering system: map tags + title keywords to categories (Design, Development, Marketing, VA, Writing, Finance, etc), add category column to output or produce per-category files
Phase 4 — Single run.sh entry point: chains Phase 1 → 2 → 3, skips already-scraped URLs, logs with timestamps, designed to run via cron hourly
Start from Phase 1.

Paste this, then attach both files and say "start Phase 1."