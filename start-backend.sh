#!/bin/bash
# Simple run script - run this in your terminal

cd /home/twarga/Projects/MediaHarborButcher

echo "Setting up .venv..."
rm -rf .venv
/home/twarga/.local/bin/uv venv .venv --python /usr/bin/python3
/home/twarga/.local/bin/uv pip install -r backend/requirements.txt --python .venv/bin/python

echo ""
echo "Starting backend on port 8000..."
echo "Keep this terminal running!"
PYTHONPATH=backend .venv/bin/python -m uvicorn backend.main:app --port 8000 --host 0.0.0.0 --reload