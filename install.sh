#!/bin/bash
set -e

echo ""
echo "╔══════════════════════════════════════╗"
echo "║     MediaHarbor v2 — Installer       ║"
echo "╚══════════════════════════════════════╝"
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

# Check ffmpeg (optional)
if ffmpeg -version &>/dev/null; then
  echo "✅ ffmpeg found"
else
  echo "⚠️  ffmpeg not found — HLS/DASH stream download will be disabled."
  echo "   Install: sudo apt install ffmpeg  (Linux)"
  echo "            brew install ffmpeg      (macOS)"
fi

echo ""
echo "📦 Setting up Python environment..."
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt -q
echo "✅ Python packages installed"

echo ""
echo "🎭 Installing Playwright browser..."
playwright install chromium
echo "✅ Chromium installed"

echo ""
echo "⚛️  Building frontend..."
cd frontend
npm install --silent
npm run build
cd ..
echo "✅ Frontend built"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║  ✅ MediaHarbor installed!           ║"
echo "║                                      ║"
echo "║  To start:  ./run.sh                 ║"
echo "║  Then open: http://localhost:8000    ║"
echo "╚══════════════════════════════════════╝"
echo ""
