#!/bin/bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

# Build frontend only when dist doesn't exist (Replit).
# On Render, the buildCommand already runs npm install + npm run build,
# so dist/ exists by the time this script runs.
if [ ! -d "$ROOT/frontend/dist" ]; then
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
