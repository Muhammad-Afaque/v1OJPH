import requests
import json
import os
import signal
import sys
import time
from bs4 import BeautifulSoup
from datetime import datetime, timezone

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Referer": "https://www.onlinejobs.ph/",
}

INPUT_FILE = "jobs.json"
OUTPUT_FILE = "enriched_jobs.json"
DELAY = 1
MAX_RETRIES = 3
SAVE_EVERY = 20

_interrupted = False

def _on_interrupt(signum, frame):
    global _interrupted
    _interrupted = True
    print("\n  Interrupt received — saving and exiting...")

signal.signal(signal.SIGINT, _on_interrupt)
signal.signal(signal.SIGTERM, _on_interrupt)


def load_json(filepath):
    if os.path.exists(filepath):
        with open(filepath, "r", encoding="utf-8") as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                return []
    return []


def save_json(filepath, data):
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def extract_job_id(url):
    try:
        return url.rstrip("/").split("/")[-1]
    except Exception:
        return None


def fetch_page(url):
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = requests.get(url, headers=HEADERS, timeout=30)
            response.raise_for_status()
            if "onlinejobs" in response.text.lower():
                return response.text
        except requests.RequestException as e:
            print(f"  Retry {attempt}/{MAX_RETRIES}: {e}")
            if attempt < MAX_RETRIES:
                time.sleep(2)
    return None


def parse_detail_page(html):
    soup = BeautifulSoup(html, "html.parser")

    job_title = "N/A"
    h1 = soup.select_one("h1.fs-24.fw-600.text-white.text-center.mb-40.job__title")
    if h1:
        job_title = h1.get_text(strip=True)

    work_type = "N/A"
    salary_detail = "N/A"
    hours = "N/A"
    date_updated = "N/A"

    card = soup.select_one("div.card.job-post")
    if card:
        values = [
            p.get_text(strip=True)
            for p in card.select("p.fs-18")
        ]
        if len(values) >= 4:
            work_type = values[0] or "N/A"
            salary_detail = values[1] or "N/A"
            hours = values[2] or "N/A"
            date_updated = values[3] or "N/A"

    description = "N/A"
    desc_tag = soup.select_one("p#job-description") or soup.select_one("p.job-description")
    if desc_tag:
        description = desc_tag.get_text(separator=" ", strip=True)

    company_detail = "N/A"
    contact_person = "N/A"

    return {
        "job_title": job_title,
        "work_type": work_type,
        "salary_detail": salary_detail,
        "hours": hours,
        "date_updated": date_updated,
        "description": description,
        "company_detail": company_detail,
        "contact_person": contact_person,
    }


def main():
    jobs = load_json(INPUT_FILE)
    if not jobs:
        print(f"No jobs found in {INPUT_FILE}. Run mainv2.py first.")
        return

    existing = load_json(OUTPUT_FILE)
    existing_ids = {job["job_id"] for job in existing if job.get("job_id")}

    if existing:
        print(f"Loaded {len(existing)} existing enriched jobs")

    enriched = list(existing)
    new_count = 0
    total = len(jobs)
    skipped = 0

    for i, job in enumerate(jobs, 1):
        if _interrupted:
            break

        jid = job.get("job_id")
        url = job.get("url")

        if not url or url == "N/A":
            continue

        if jid and jid in existing_ids:
            skipped += 1
            continue

        print(f"[{i}/{total}] {url}")

        html = fetch_page(url)
        if not html:
            print(f"  ERROR: Failed to fetch page")
            detail = {
                "job_title": "N/A",
                "work_type": "N/A",
                "salary_detail": "N/A",
                "hours": "N/A",
                "date_updated": "N/A",
                "description": "Failed to scrape",
                "company_detail": "N/A",
                "contact_person": "N/A",
            }
        else:
            detail = parse_detail_page(html)
            print(f"  Title: {detail['job_title'][:60]} | Type: {detail['work_type']} | Salary: {detail['salary_detail']}")

        enriched_job = {
            **job,
            **detail,
            "detail_scraped_at": datetime.now(timezone.utc).isoformat(),
        }
        enriched.append(enriched_job)
        if jid:
            existing_ids.add(jid)
        new_count += 1

        if new_count % SAVE_EVERY == 0:
            save_json(OUTPUT_FILE, enriched)
            print(f"  [saved {len(enriched)} jobs so far]")

        if i < total:
            time.sleep(DELAY)

    save_json(OUTPUT_FILE, enriched)

    print(f"\n{'='*50}")
    print(f"Done. {new_count} jobs enriched ({skipped} skipped).")
    print(f"Total in {OUTPUT_FILE}: {len(enriched)}")
    print(f"{'='*50}")


if __name__ == "__main__":
    main()
