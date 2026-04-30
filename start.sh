#!/bin/bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

# If npm is available (Replit), always rebuild the frontend so source changes
# are picked up on every republish. On Render, npm is not in PATH during the
# start phase (it runs in buildCommand instead), so this block is skipped.
if command -v npm &> /dev/null; then
  echo "=== Installing Python packages ==="
  pip install -r "$ROOT/backend/requirements.txt" -q

  echo "=== Building frontend ==="
  cd "$ROOT/frontend"
  npm install --silent
  npm run build
  cd "$ROOT"
fi

echo "=== Running HubSpot snapshot ==="
cd "$ROOT/backend"
python snapshot_hubspot.py

echo "=== Running Gong snapshot ==="
python snapshot_gong.py

echo "=== Starting server ==="
exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-8080}"
