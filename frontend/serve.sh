#!/bin/bash
# Start frontend dev server with API for saving notes
# Usage: ./frontend/serve.sh [port]
set -e

PORT="${1:-8000}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "========================================="
echo " OnlineJobs.ph Job Board with API"
echo "========================================="
echo " Open:   http://localhost:$PORT/frontend/"
echo " API:    http://localhost:$PORT/api/jobs"
echo " Press Ctrl+C to stop"
echo "========================================="

cd "$SCRIPT_DIR"
python3 server.py "$PORT"
