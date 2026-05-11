#!/bin/bash
set -e

if [ ! -d ".venv" ]; then
  echo "❌ Not installed. Run ./install.sh first."
  exit 1
fi

source .venv/bin/activate

echo ""
echo "🎣 Starting MediaHarbor..."
echo "   Open: http://localhost:8000"
echo ""

# Open browser after 2s
(sleep 2 && xdg-open http://localhost:8000 2>/dev/null || open http://localhost:8000 2>/dev/null || true) &

cd backend
uvicorn main:app --host 0.0.0.0 --port 8000
