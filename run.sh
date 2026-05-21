#!/bin/bash

# ============================================================
# OnlineJobs.ph Scraper — Full Pipeline
# ============================================================
# Chains Phase 1 → Phase 2 → Phase 3
# Each phase handles its own dedup/incremental internally.
# Designed to run via cron hourly.
#
# Usage: ./run.sh
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

LOCK_FILE=".run.lock"
LOG_DIR="logs"
LOG_FILE="${LOG_DIR}/run_$(date +%Y%m%d_%H%M%S).log"

mkdir -p "$LOG_DIR"

# ── Locking ────────────────────────────────────────────────
if [ -f "$LOCK_FILE" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Another run is already in progress (lock file exists). Exiting." | tee -a "$LOG_DIR/latest.log"
    exit 0
fi
trap 'rm -f "$LOCK_FILE"' EXIT
touch "$LOCK_FILE"

# ── Logging setup ──────────────────────────────────────────
exec > >(tee -a "$LOG_FILE") 2>&1

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "========================================="
log "Pipeline started"
log "Log file: $LOG_FILE"
log "========================================="

# ── Phase 1: Listings (mainv2.py) ──────────────────────────
# Scrapes the general listing plus keyword-targeted searches.
# General listing is fatal on failure; keyword searches are best-effort.
log ""
log "=== PHASE 1: Scrape listings (general + keywords) ==="
if python3 mainv2.py --keywords wordpress,shopify,seo; then
    log "Phase 1 completed successfully"
else
    log "Phase 1 FAILED — aborting pipeline"
    exit 1
fi

# ── Phase 2: Detail pages (phase2.py) ──────────────────────
log ""
log "=== PHASE 2: Scrape detail pages ==="
if python3 phase2.py; then
    log "Phase 2 completed successfully"
else
    log "Phase 2 FAILED — aborting pipeline"
    exit 1
fi

# ── Phase 3: Categorization (phase3.py) ────────────────────
log ""
log "=== PHASE 3: Categorize jobs ==="
if python3 phase3.py; then
    log "Phase 3 completed successfully"
else
    log "Phase 3 FAILED — aborting pipeline"
    exit 1
fi

# ── Copy data for frontend ──────────────────────────────────
cp enriched_jobs.json frontend/enriched_jobs.json
log "Copied enriched_jobs.json to frontend/"

# ── Summary ────────────────────────────────────────────────
log ""
log "========================================="
log "Pipeline complete"
log "Outputs:"
log "  Listing data:   $(du -h jobs.json 2>/dev/null | cut -f1) ($(python3 -c "import json; print(len(json.load(open('jobs.json'))))" 2>/dev/null || echo '?') jobs)"
log "  Enriched data:  $(du -h enriched_jobs.json 2>/dev/null | cut -f1) ($(python3 -c "import json; print(len(json.load(open('enriched_jobs.json'))))" 2>/dev/null || echo '?') jobs)"
log "  Categories:     $(ls categories/*.json 2>/dev/null | wc -l) files"
log "========================================="

# Symlink latest log
ln -sf "$(basename "$LOG_FILE")" "$LOG_DIR/latest.log"

log "Done."
