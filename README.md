# OnlineJobs.ph Job Scraper & Dashboard

A Python-based web scraper that collects job listings from [OnlineJobs.ph](https://www.onlinejobs.ph) and presents them in a modern dashboard interface.

## Overview

This project scrapes job listings from OnlineJobs.ph, enriches them with detailed information, categorizes them, and provides a web-based dashboard for browsing and filtering.

## Features

- **Multi-page scraping**: Scrapes paginated job listings (30+ pages)
- **Keyword-targeted searches**: Additional scraping for specific keywords (wordpress, shopify, seo)
- **Detail page enrichment**: Scrapes individual job pages for complete information
- **Automatic categorization**: Jobs are classified into 9 categories (Design, Development, Marketing, VA, Writing, Finance, Sales, Real Estate, Medical)
- **Web dashboard**: Modern dark-themed UI with charts, filters, and job details
- **REST API**: JSON API for programmatic access
- **CSV export**: Export filtered jobs to CSV
- **Incremental updates**: Skips already-scraped jobs on subsequent runs
- **Historical import**: Import jobs from Excel spreadsheets

## Project Structure

```
.
├── main.py                 # Original single-page scraper (Phase 0)
├── mainv2.py               # Phase 1: Multi-page listing scraper
├── phase2.py               # Phase 2: Detail page enrichment
├── phase3.py               # Phase 3: Job categorization
├── import_historical.py    # Import from Excel spreadsheet
├── run.sh                  # Pipeline orchestrator (Phase 1→2→3)
├── start.sh                # Unified entry point
├── jobs.json               # Raw scraped listings
├── enriched_jobs.json      # Enriched job data
├── categories/             # Per-category JSON files
│   ├── design.json
│   ├── development.json
│   ├── marketing.json
│   └── ...
└── frontend/
    ├── index.html          # Dashboard UI
    ├── server.py           # Python HTTP server + API
    ├── enriched_jobs.json  # Copy for frontend
    └── vercel.json         # Vercel deployment config
```

## Quick Start

### Prerequisites

- Python 3.7+
- pip packages: `requests`, `beautifulsoup4`, `openpyxl` (for Excel import)

```bash
pip install requests beautifulsoup4 openpyxl
```

### Running the Scraper

```bash
# Run full pipeline (scrape → enrich → categorize)
./start.sh scrape

# Or run individual phases
python3 mainv2.py                          # Phase 1: Scrape listings
python3 mainv2.py --keywords wordpress,seo # With keyword searches
python3 phase2.py                          # Phase 2: Enrich details
python3 phase3.py                          # Phase 3: Categorize
```

### Running the Dashboard

```bash
# Start dashboard server (default port 8000)
./start.sh serve

# Or with custom port
./start.sh serve 3000

# Scrape first, then serve
./start.sh all
```

Then open http://localhost:8000/frontend/ in your browser.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/jobs` | GET | List jobs with filters |
| `/api/jobs/{job_id}` | GET | Get single job details |
| `/api/stats` | GET | Dashboard statistics |
| `/api/save-job` | POST | Save notes/email to a job |

### Query Parameters for `/api/jobs`

- `page` (int): Page number (default: 1)
- `limit` (int): Results per page (default: 50, max: 200)
- `search` (string): Search in title, company, description
- `category` (string): Comma-separated categories
- `type` (string): Comma-separated work types
- `salary_min` / `salary_max` (number): Salary range filter
- `date_from` / `date_to` (string): Date range (ISO format)
- `sort` (string): Sort field (posted, title, company, salary_detail)
- `order` (string): Sort direction (asc, desc)

## Data Schema

Each job object contains:

```json
{
  "job_id": "12345",
  "title": "WordPress Developer",
  "company": "Company Name",
  "type": "Full Time",
  "salary": "$500-$800",
  "posted": "2024-01-15",
  "url": "https://www.onlinejobs.ph/jobseekers/job/12345",
  "tags": ["wordpress", "php", "woocommerce"],
  "category": "Development",
  "work_type": "Full Time",
  "salary_detail": "$500-$800 monthly",
  "hours": "40",
  "date_updated": "2024-01-20",
  "description": "Job description text...",
  "contact_person": "John Doe",
  "scraped_at": "2024-01-20T12:00:00+00:00",
  "detail_scraped_at": "2024-01-20T12:05:00+00:00"
}
```

## Categories

Jobs are automatically categorized based on tags and title keywords:

| Category | Description |
|----------|-------------|
| Design | Graphic design, video editing, animation, UI/UX |
| Development | Programming, software engineering, DevOps |
| Marketing | Social media, SEO, ads, content marketing |
| VA | Virtual assistance, admin, customer support |
| Writing | Copywriting, content writing, blogging |
| Finance | Bookkeeping, accounting, financial analysis |
| Sales | Lead generation, cold calling, business dev |
| Real Estate | Property management, Airbnb, leasing |
| Medical | Healthcare, medical VA, clinical support |

## Deployment

### Vercel

The frontend is configured for Vercel deployment:

```bash
cd frontend
vercel deploy
```

### Cron Job (Hourly Scraping)

```bash
# Add to crontab
0 * * * * /path/to/project/run.sh >> /path/to/project/logs/cron.log 2>&1
```

## Notes

- OnlineJobs.ph is a PHP/Laravel site (v1) - server-rendered, works with curl/requests
- The v2 site (Next.js/RSC) is not used
- Company name may show "N/A" when employers hide their logo (intentional platform behavior)
- Rate limiting: 1-2 second delay between requests
- The scraper handles interruptions gracefully (saves progress)

## License

Private project - not for distribution.
