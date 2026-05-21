#!/bin/bash
# ================================================================
# OnlineJobs.ph — Unified Entry Point
# ================================================================
# Usage:
#   ./start.sh scrape       Run the full scraper pipeline (Phase 1→2→3)
#   ./start.sh serve [port] Start the frontend dashboard + API server
#   ./start.sh all [port]   Scrape first, then start the server
# ================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
    echo "Usage:"
    echo "  ./start.sh scrape         Run scraper pipeline"
    echo "  ./start.sh serve [port]   Start dashboard (default port 8000)"
    echo "  ./start.sh all [port]     Scrape + serve"
    exit 0
}

cmd_scrape() {
    echo "──────────────────────────────────────────"
    echo " Running scraper pipeline"
    echo "──────────────────────────────────────────"
    cd "$SCRIPT_DIR"
    exec bash "$SCRIPT_DIR/run.sh"
}

cmd_serve() {
    local port="${1:-8000}"
    echo "──────────────────────────────────────────"
    echo " Starting dashboard on port $port"
    echo "──────────────────────────────────────────"
    cd "$SCRIPT_DIR/frontend"
    exec python3 server.py "$port"
}

cmd_all() {
    local port="${1:-8000}"
    echo "──────────────────────────────────────────"
    echo " Step 1/2: Running scraper pipeline..."
    echo "──────────────────────────────────────────"
    cd "$SCRIPT_DIR"
    bash "$SCRIPT_DIR/run.sh"
    echo ""
    echo "──────────────────────────────────────────"
    echo " Step 2/2: Starting dashboard on port $port"
    echo "──────────────────────────────────────────"
    cd "$SCRIPT_DIR/frontend"
    exec python3 server.py "$port"
}

case "${1:-}" in
    scrape) cmd_scrape ;;
    serve)  cmd_serve "${2:-}" ;;
    all)    cmd_all "${2:-}" ;;
    *)      usage ;;
esac
