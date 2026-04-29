#!/bin/bash
set -e
cd "$(dirname "$0")/backend"
echo "Running HubSpot snapshot..."
python snapshot_hubspot.py
echo "Running Gong snapshot..."
python snapshot_gong.py
echo "Starting server..."
exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}"
