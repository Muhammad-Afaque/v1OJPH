#!/usr/bin/env python3
import http.server
import json
import os
import sys
import urllib.parse
from pathlib import Path

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
PROJECT_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = Path(__file__).resolve().parent
JSON_FILE = PROJECT_DIR / "enriched_jobs.json"


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
        path = urllib.parse.urlparse(self.path).path

        if path == "/api/jobs":
            self._serve_json()
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

    def _serve_json(self):
        try:
            with open(JSON_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            body = json.dumps(data, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except Exception as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())

    def _save_job(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(length)
            payload = json.loads(raw)

            job_id = payload.get("job_id")
            if not job_id:
                self._json_error(400, "job_id required")
                return

            with open(JSON_FILE, "r", encoding="utf-8") as f:
                jobs = json.load(f)

            updated = False
            for job in jobs:
                if job.get("job_id") == job_id:
                    for key in ("email", "extra_description", "custom_notes"):
                        if key in payload:
                            job[key] = payload[key]
                    updated = True
                    break

            if not updated:
                self._json_error(404, "job not found")
                return

            with open(JSON_FILE, "w", encoding="utf-8") as f:
                json.dump(jobs, f, indent=2, ensure_ascii=False)

            self.send_response(200)
            body = json.dumps({"ok": True, "job_id": job_id}).encode()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        except json.JSONDecodeError:
            self._json_error(400, "invalid JSON")
        except Exception as e:
            self._json_error(500, str(e))

    def _json_error(self, code, msg):
        body = json.dumps({"error": msg}).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    print(f"Server: http://localhost:{PORT}/frontend/")
    print(f"API:    http://localhost:{PORT}/api/jobs")
    print(f"Data:   {JSON_FILE}")
    http.server.HTTPServer(("0.0.0.0", PORT), APIHandler).serve_forever()
