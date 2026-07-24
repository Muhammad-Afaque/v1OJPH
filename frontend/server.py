#!/usr/bin/env python3
import http.server
import json
import os
import re
import sys
import urllib.parse
from collections import Counter
from datetime import datetime, timedelta
from glob import glob
from pathlib import Path

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
PROJECT_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = Path(__file__).resolve().parent
CHUNKS_DIR = PROJECT_DIR / "chunks"

JOBS_CACHE = None


def load_jobs():
    global JOBS_CACHE
    if JOBS_CACHE is None:
        JOBS_CACHE = []
        chunk_files = sorted(glob(str(CHUNKS_DIR / "chunk_*.json")))
        for cf in chunk_files:
            with open(cf, "r", encoding="utf-8") as f:
                JOBS_CACHE.extend(json.load(f))
    return JOBS_CACHE


def parse_salary(val):
    if not val or val == "N/A":
        return None
    s = str(val).lower().replace(",", "").strip()
    nums = re.findall(r"\d+(?:\.\d+)?", s)
    if not nums:
        return None
    return float(nums[0])


def job_matches(job, params):
    search = params.get("search", "").lower()
    if search:
        haystack = " ".join(str(v) for v in [
            job.get("title", ""),
            job.get("job_title", ""),
            job.get("company", ""),
            job.get("description", ""),
            job.get("work_type", ""),
            job.get("type", ""),
            " ".join(job.get("tags", [])),
        ]).lower()
        if search not in haystack:
            return False

    cats = params.get("category", "")
    if cats and cats != "All":
        cat_list = [c.strip() for c in cats.split(",")]
        if job.get("category") not in cat_list:
            return False

    salary_min = params.get("salary_min")
    salary_max = params.get("salary_max")
    if salary_min is not None or salary_max is not None:
        sal = parse_salary(job.get("salary_detail") or job.get("salary"))
        if sal is None:
            return False
        if salary_min is not None and sal < salary_min:
            return False
        if salary_max is not None and sal > salary_max:
            return False

    date_from = params.get("date_from")
    date_to = params.get("date_to")
    if date_from or date_to:
        posted = job.get("posted") or job.get("scraped_at") or ""
        if posted:
            try:
                d = datetime.fromisoformat(posted.replace("Z", "+00:00")).date()
                if date_from and d < datetime.fromisoformat(date_from).date():
                    return False
                if date_to and d > datetime.fromisoformat(date_to).date():
                    return False
            except (ValueError, TypeError):
                pass

    tags = params.get("tags", "")
    if tags:
        tag_list = [t.strip().lower() for t in tags.split(",")]
        job_tags = [t.lower() for t in job.get("tags", [])]
        if not any(t in job_tags for t in tag_list):
            return False

    types = params.get("type", "")
    if types and types != "all":
        type_list = [t.strip().lower() for t in types.split(",")]
        job_type = (job.get("work_type") or job.get("type") or "").lower()
        if job_type not in type_list:
            return False

    return True


def sort_key(job, field):
    if field in ("posted", "scraped_at", "date_updated"):
        val = job.get(field, "")
        try:
            return datetime.fromisoformat(val.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            return datetime.min
    if field == "salary_detail":
        sal = parse_salary(job.get("salary_detail") or job.get("salary"))
        return sal if sal is not None else -1
    return (job.get(field) or "").lower()


def build_stats():
    jobs = load_jobs()
    total = len(jobs)
    cats = Counter(j.get("category", "Other") for j in jobs)
    work_types = Counter((j.get("work_type") or j.get("type") or "N/A") for j in jobs)

    salary_ranges = {"0-500": 0, "500-1000": 0, "1000-2000": 0, "2000-5000": 0, "5000+": 0}
    for j in jobs:
        sal = parse_salary(j.get("salary_detail") or j.get("salary"))
        if sal is not None:
            if sal < 500:
                salary_ranges["0-500"] += 1
            elif sal < 1000:
                salary_ranges["500-1000"] += 1
            elif sal < 2000:
                salary_ranges["1000-2000"] += 1
            elif sal < 5000:
                salary_ranges["2000-5000"] += 1
            else:
                salary_ranges["5000+"] += 1

    today = datetime.now().date()
    daily_counts = Counter()
    for j in jobs:
        posted = j.get("posted") or j.get("scraped_at") or ""
        try:
            d = datetime.fromisoformat(posted.replace("Z", "+00:00")).date()
            if (today - d).days <= 30:
                daily_counts[d.isoformat()] += 1
        except (ValueError, TypeError):
            pass

    last_30 = []
    for i in range(30, -1, -1):
        d = (today - timedelta(days=i)).isoformat()
        last_30.append({"date": d, "count": daily_counts.get(d, 0)})

    with_salary = sum(1 for j in jobs if parse_salary(j.get("salary_detail") or j.get("salary")) is not None)

    job_types_list = sorted(
        [{"type": k, "count": v} for k, v in work_types.items()],
        key=lambda x: -x["count"]
    )

    return {
        "total": total,
        "with_salary": with_salary,
        "salary_pct": round(with_salary / total * 100) if total else 0,
        "categories": [{"name": k, "count": v} for k, v in cats.most_common()],
        "work_types": job_types_list,
        "salary_ranges": salary_ranges,
        "posting_timeline": last_30,
        "top_tags": [{"name": t, "count": c}
                     for t, c in Counter(
                         tg for j in jobs for tg in j.get("tags", [])
                     ).most_common(20)],
    }


class APIHandler(http.server.SimpleHTTPRequestHandler):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PROJECT_DIR), **kwargs)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip("/")
        qs = dict(urllib.parse.parse_qsl(parsed.query))

        params = {}
        for k, v in qs.items():
            if v.isdigit():
                params[k] = int(v)
            elif v.lower() == "true":
                params[k] = True
            elif v.lower() == "false":
                params[k] = False
            else:
                try:
                    params[k] = float(v)
                except ValueError:
                    params[k] = v

        if path == "/api/jobs" and "/jobs/" not in self.path:
            self._serve_jobs(params)
            return

        job_match = re.match(r"^/api/jobs/(.+)$", path)
        if job_match:
            self._serve_job(job_match.group(1))
            return

        if path == "/api/stats":
            self._json_response(build_stats())
            return

        return super().do_GET()

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path

        if path == "/api/save-job":
            self._save_job()
            return

        self.send_response(404)
        self.end_headers()
        self.wfile.write(b'{"error":"not found"}')

    def _json_response(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _serve_jobs(self, params):
        jobs = load_jobs()
        page = int(params.get("page", 1))
        limit = min(int(params.get("limit", 50)), 200)

        filtered = [j for j in jobs if job_matches(j, params)]

        sort_field = params.get("sort", "posted")
        sort_desc = params.get("order", "desc") != "asc"
        filtered.sort(key=lambda j: sort_key(j, sort_field), reverse=sort_desc)

        total = len(filtered)
        total_pages = max(1, (total + limit - 1) // limit)
        start = (page - 1) * limit
        end = start + limit
        page_jobs = filtered[start:end]

        self._json_response({
            "jobs": page_jobs,
            "total": total,
            "page": page,
            "limit": limit,
            "totalPages": total_pages,
        })

    def _serve_job(self, job_id):
        jobs = load_jobs()
        for j in jobs:
            if j.get("job_id") == job_id:
                self._json_response(j)
                return
        self._json_response({"error": "not found"}, 404)

    def _save_job(self):
        self._json_response({"ok": True, "note": "saved to localStorage only"})


if __name__ == "__main__":
    jobs = load_jobs()
    print(f"Server: http://localhost:{PORT}/frontend/")
    print(f"API:    http://localhost:{PORT}/api/jobs?page=1&limit=50")
    print(f"Stats:  http://localhost:{PORT}/api/stats")
    print(f"Data:   {len(jobs)} jobs from chunks/")
    http.server.HTTPServer(("0.0.0.0", PORT), APIHandler).serve_forever()
