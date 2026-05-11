#!/bin/bash

set -e

MAGENTA='\033[0;35m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

UV_BIN="/home/twarga/.local/bin/uv"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$PROJECT_DIR/.venv"
LOG_DIR="/tmp/mediaharbor"

mkdir -p "$LOG_DIR"

echo -e "${MAGENTA}"
cat << 'EOF'
  _   _                       _ _           _   
 | \ | | ___ _   _ _ __ __ _| |_ ___  (_)_ __   __ _  ___ 
 |  \| |/ _ \ | | | '__/ _` | __/ _ \ | | '_ \ / _` |/ _ \
 | |\  |  __/ |_| | | | (_| | || (_) | | | | | (_| | (_) |
 |_| \_|\___|\__,_|_|  \__,_|\__\___/ |_|_| |_|\__,_|\___/ 
                                                       
EOF
echo -e "${NC}"

pkill -f "uvicorn" 2>/dev/null || true
pkill -f "node.*vite" 2>/dev/null || true
sleep 1

echo -e "${CYAN}Setting up...${NC}"
rm -rf "$VENV_DIR"
$UV_BIN venv "$VENV_DIR" --python /usr/bin/python3 2>&1
$UV_BIN pip install -r "$PROJECT_DIR/backend/requirements.txt" --python "$VENV_DIR/bin/python" 2>&1

echo -e "${CYAN}Starting Backend...${NC}"
cd "$PROJECT_DIR"
PYTHONPATH="$PROJECT_DIR/backend" nohup "$VENV_DIR/bin/python" -m uvicorn backend.main:app --port 8000 --host 0.0.0.0 > "$LOG_DIR/backend.log" 2>&1 &
sleep 3

echo -e "${CYAN}Starting Frontend...${NC}"
cd "$PROJECT_DIR/frontend"
nohup npm run dev -- --host 0.0.0.0 --port 5173 > "$LOG_DIR/frontend.log" 2>&1 &
sleep 4

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "  🎉 MediaHarbor is ready!"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "  Open: ${YELLOW}http://localhost:5173${NC}"
echo -e "  API:  ${YELLOW}http://localhost:8000${NC}"
echo ""

while true; do
    sleep 5
done