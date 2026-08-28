# OnlineJobs.ph Scraper

A job scraping and dashboard system for collecting, enriching, and browsing job listings from OnlineJobs.ph.

## Language

**Job Listing**:
A job posting scraped from the OnlineJobs.ph search results page. Contains basic fields: title, company, salary, posted date, URL, and tags.
_Avoid_: Job post, vacancy, opening

**Job Detail**:
The individual page for a specific job listing containing full information: description, work type, hours per week, date updated, and contact person.
_Avoid_: Job page, listing detail

**Enrichment**:
The process of fetching Job Detail data for each Job Listing and merging the two into a single record.
_Avoid_: Augmentation, enhancement, supplementation

**Category**:
A classification assigned to each job based on its title and tags. Used for filtering and dashboard statistics.
_Avoid_: Group, type, classification

**Tags**:
Keywords associated with a job listing by the employer on OnlineJobs.ph. Used as signals for Category assignment.
_Aavoid_: Labels, keywords, skills

**Work Type**:
The employment arrangement: Full Time, Part Time, Gig, Freelance, or Contract.
_Avoid_: Job type, employment type, arrangement

**Pipeline**:
The three-phase scraping chain: Phase 1 (listings), Phase 2 (detail enrichment), Phase 3 (categorization).
_Avoid_: Workflow, sequence, chain

**Incremental Update**:
A scraping run that skips already-collected Job Listings based on their job_id, appending only new records.
_Avoid_: Differential update, delta sync

## Session Log

### 2026-07-25
- **What was done**:
  - Ticket 04: CLI categorize command implemented
    - Classification rules ported from Python (9 categories + Other)
    - Score-based matching: tags weighted 2, title keywords weighted 3
    - Ties broken by first match
    - CLI `npx ojph categorize` subcommand
    - 20 new classification tests (65 total)
  - Code review fixes:
    - Added `Category` type union for `classify()` return (Primitive Obsession)
    - Extracted shared file I/O helpers (`loadJson`, `saveJson`, `mergeJobs`, `printCategoryDistribution`)
    - Reduced CLI boilerplate by ~40 lines
- **Files changed**:
  - Created: `src/scraper/categorize.ts`, `src/scraper/categorize.test.ts`, `src/cli-helpers.ts`
  - Modified: `src/cli.ts`, `src/scraper/types.ts`
- **Commits**:
  - `d391dc2` feat: ticket 04 — CLI categorize command
  - `2f732c3` refactor: fix code review issues from ticket 04
- **Status**: Completed
- **Next steps**: Ticket 05 — D1 write-back for all pipeline phases
