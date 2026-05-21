#!/usr/bin/env python3
"""OnlineJobs.ph Listing Scraper — Phase 1

Scrapes the general job listing (paginated) and optionally additional
keyword-specific searches. All results are deduplicated and appended
to jobs.json incrementally.

Usage:
    python3 mainv2.py                          # General listing only
    python3 mainv2.py --keywords wordpress     # General + WordPress keyword
    python3 mainv2.py --keywords wordpress,seo # General + multiple keywords
"""

import requests
import json
import os
import sys
import time
import argparse
from urllib.parse import quote
from bs4 import BeautifulSoup
from datetime import datetime, timezone

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Referer": "https://www.onlinejobs.ph/",
}

BASE_URL    = "https://www.onlinejobs.ph/jobseekers/jobsearch"
OUTPUT_FILE = "jobs.json"
DELAY       = 2

# Offset-based pagination: 0, 30, 60 ... 240
OFFSETS = [0] + list(range(30, 270, 30))  # [0, 30, 60, 90, 120, 150, 180, 210, 240]


def load_existing(filepath):
    """Load existing jobs.json, return list of jobs."""
    if os.path.exists(filepath):
        with open(filepath, "r", encoding="utf-8") as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                return []
    return []


def extract_job_id(url):
    """Extract job ID from the tail of a job detail URL."""
    try:
        return url.rstrip("/").split("/")[-1]
    except Exception:
        return None


def build_url(offset, keyword=None):
    """Build the listing URL for a given offset and optional keyword.

    General:   .../jobsearch        (offset 0)
               .../jobsearch/30     (offset 30)
    Keyword:   .../jobsearch?jobkeyword=wordpress          (offset 0)
               .../jobsearch/30?jobkeyword=wordpress       (offset 30)
    """
    if keyword:
        qs = f"?jobkeyword={quote(keyword)}"
        if offset == 0:
            return f"https://www.onlinejobs.ph/jobseekers/jobsearch{qs}"
        else:
            return f"https://www.onlinejobs.ph/jobseekers/jobsearch/{offset}{qs}"
    else:
        if offset == 0:
            return BASE_URL
        else:
            return f"{BASE_URL}/{offset}"


def parse_cards(soup):
    """Parse job cards from a listing page BeautifulSoup object."""
    jobs = []
    for card in soup.select(".jobpost-cat-box"):

        logo    = card.select_one("img.jobpost-cat-box-logo")
        company = logo["alt"].strip() if logo else "N/A"

        title_tag = card.select_one("h4.fs-16.fw-700")
        if title_tag:
            badge_tag = title_tag.find("span", class_="badge")
            job_type  = badge_tag.get_text(strip=True) if badge_tag else "N/A"
            if badge_tag:
                badge_tag.decompose()
            title = title_tag.get_text(strip=True)
        else:
            title    = "N/A"
            job_type = "N/A"

        salary_tag = card.select_one("dl.row.no-gutters dd.col")
        salary     = salary_tag.get_text(strip=True) if salary_tag else "N/A"

        date_tag = card.select_one("p.fs-13.mb-0 em")
        posted   = date_tag.get_text(strip=True).replace("Posted on ", "") if date_tag else "N/A"

        link_tag = card.select_one("div.desc a[href^='/jobseekers/job/']")
        job_url  = "https://www.onlinejobs.ph" + link_tag["href"] if link_tag else "N/A"
        job_id   = extract_job_id(job_url) if job_url != "N/A" else None

        tags = [
            a.get_text(strip=True)
            for a in card.select("div.job-tag a.badge")
            if a.get_text(strip=True)
        ]

        jobs.append({
            "job_id":     job_id,
            "title":      title,
            "company":    company,
            "type":       job_type,
            "salary":     salary,
            "posted":     posted,
            "url":        job_url,
            "tags":       tags,
            "scraped_at": datetime.now(timezone.utc).isoformat(),
        })
    return jobs


def scrape_source(label, keyword, offsets, existing_ids, seen_this_run):
    """Scrape paginated listing pages for a source (general or keyword).

    Returns list of new jobs. Mutates existing_ids and seen_this_run
    to prevent duplicates across sources within the same run.
    """
    new_jobs = []
    total_pages = len(offsets)

    for i, offset in enumerate(offsets, 1):
        url = build_url(offset, keyword)
        print(f"  [Page {i}/{total_pages}] Offset {offset} → {url}")

        try:
            response = requests.get(url, headers=HEADERS, timeout=30)
            response.raise_for_status()
        except requests.RequestException as e:
            print(f"    ERROR: {e} — skipping")
            continue

        soup  = BeautifulSoup(response.text, "html.parser")
        cards = parse_cards(soup)

        if not cards:
            print(f"    No cards found — stopping.")
            break

        page_new  = 0
        page_dups = 0

        for job in cards:
            jid = job["job_id"]
            if jid in existing_ids or jid in seen_this_run:
                page_dups += 1
                continue
            new_jobs.append(job)
            existing_ids.add(jid)
            seen_this_run.add(jid)
            page_new += 1

        print(f"    +{page_new} new | {page_dups} skipped")

        if page_new == 0 and page_dups == len(cards):
            print(f"    Full page of duplicates — stopping early.")
            break

        if i < total_pages:
            time.sleep(DELAY)

    return new_jobs


def main():
    parser = argparse.ArgumentParser(
        description="Scrape OnlineJobs.ph job listings"
    )
    parser.add_argument(
        "--keywords", "-k",
        type=str,
        default=None,
        help="Comma-separated keywords for additional targeted searches (e.g., 'wordpress,shopify')"
    )
    args = parser.parse_args()

    keywords = None
    if args.keywords:
        keywords = [kw.strip() for kw in args.keywords.split(",") if kw.strip()]

    existing      = load_existing(OUTPUT_FILE)
    existing_ids  = {job["job_id"] for job in existing if job.get("job_id")}
    seen_this_run = set()

    print(f"Loaded {len(existing)} existing jobs ({len(existing_ids)} unique IDs)")

    all_jobs = list(existing)
    total_new = 0

    # ── General listing (always, fatal on failure) ──────────
    print(f"\n{'='*50}")
    print("Scraping: General listing")
    print(f"{'='*50}")
    try:
        new_jobs = scrape_source("general", None, OFFSETS, existing_ids, seen_this_run)
        all_jobs.extend(new_jobs)
        total_new += len(new_jobs)
        print(f"  → {len(new_jobs)} new jobs from general listing")
    except Exception as e:
        print(f"\nFATAL: General listing scrape failed: {e}")
        sys.exit(1)

    # ── Keyword-targeted searches (best-effort) ─────────────
    if keywords:
        for keyword in keywords:
            print(f"\n{'='*50}")
            print(f"Scraping: Keyword \"{keyword}\"")
            print(f"{'='*50}")
            try:
                new_jobs = scrape_source(f"keyword:{keyword}", keyword, OFFSETS, existing_ids, seen_this_run)
                all_jobs.extend(new_jobs)
                total_new += len(new_jobs)
                print(f"  → {len(new_jobs)} new jobs from keyword \"{keyword}\"")
            except Exception as e:
                print(f"  WARNING: Keyword \"{keyword}\" failed: {e} — continuing")

    # ── Save ────────────────────────────────────────────────
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(all_jobs, f, indent=2, ensure_ascii=False)

    print(f"\n{'='*50}")
    print(f"Done. {total_new} new jobs added.")
    print(f"Total in {OUTPUT_FILE}: {len(all_jobs)}")
    print(f"{'='*50}")


if __name__ == "__main__":
    main()
