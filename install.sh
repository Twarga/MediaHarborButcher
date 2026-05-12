#!/bin/bash
set -e

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║      MediaHarbor v2.1 — Installer            ║"
echo "║   yt-dlp video engine • 1800+ sites          ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# Check Python 3.11+
if ! python3 -c "import sys; assert sys.version_info >= (3,11)" 2>/dev/null; then
  echo "❌ Python 3.11+ is required."
  echo "   Install: https://python.org/downloads"
  exit 1
fi
echo "✅ Python $(python3 --version)"

# Check Node 18+
if ! node -e "assert(parseInt(process.version.slice(1)) >= 18)" 2>/dev/null; then
  echo "❌ Node.js 18+ is required."
  echo "   Install: https://nodejs.org"
  exit 1
fi
echo "✅ Node $(node --version)"

# Check ffmpeg (optional but recommended for yt-dlp HLS merging)
if ffmpeg -version &>/dev/null; then
  echo "✅ ffmpeg found"
else
  echo "⚠️  ffmpeg not found — HLS/DASH stream download and video merging will be disabled."
  echo "   Install: sudo apt install ffmpeg  (Linux)"
  echo "            brew install ffmpeg      (macOS)"
fi

echo ""
echo "📦 Setting up Python environment..."
# Use existing venv if present; otherwise create one.
if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi
# Use the venv's pip directly — safer than `source activate` inside a script.
./.venv/bin/python -m pip install --upgrade pip --quiet
./.venv/bin/python -m pip install -r backend/requirements.txt --quiet
echo "✅ Python packages installed (FastAPI, Playwright, yt-dlp, aiohttp...)"

echo ""
echo "🎭 Installing Playwright browser (Chromium)..."
./.venv/bin/python -m playwright install chromium
echo "✅ Chromium installed"

echo ""
echo "⚛️  Installing and building frontend..."
cd frontend
npm install --silent --no-audit --no-fund
npm run build
cd ..
echo "✅ Frontend built"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  ✅ MediaHarbor installed!                   ║"
echo "║                                              ║"
echo "║  To start:  ./run.sh                         ║"
echo "║  Then open: http://localhost:8000            ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
