# Contributing to MediaHarbor

Thanks for your interest. MediaHarbor is a small, focused tool. Contributions
are welcome, but please keep the scope tight — this is not a general-purpose
scraping framework.

## What fits

- Extraction fixes for specific sites that fail today
- Robustness fixes (retry logic, error handling, memory/streaming)
- UI polish that keeps the editorial design language (warm ink + amber/coral,
  Instrument Serif display, Inter UI, JetBrains Mono data)
- yt-dlp extractor updates or new site support

## What probably doesn't fit

- Cloud features, accounts, telemetry, analytics
- Packaging as Electron/Tauri (the web app is intentional)
- Features that require remote servers to run

## Getting the project running

```bash
git clone https://github.com/Twarga/MediaHarborButcher.git
cd MediaHarborButcher
./install.sh
./run.sh
```

`install.sh` needs Python 3.11+, Node 18+, and `ffmpeg` (recommended). It
creates a `.venv/`, installs backend requirements, pulls the Playwright
Chromium binary, and builds the frontend.

During development you can also run the frontend dev server for hot reload:

```bash
# Terminal 1 — backend
.venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload \
  --app-dir backend

# Terminal 2 — frontend
cd frontend && npm run dev
```

Vite proxies `/scan`, `/download`, `/settings`, `/history`, `/open-folder`,
`/health` to the backend.

## Style

### Python
- Standard library where possible
- `async`/`await` for I/O; never block the event loop
- No new dependencies unless there's a very clear reason

### JavaScript
- Functional React components, hooks
- Tailwind utilities in the existing palette (`ink-*`, `paper-*`, `amber-*`,
  `coral-*`, `teal-*`) — don't introduce new color families
- Icons go in `frontend/src/icons.jsx` (inline SVG, currentColor)

### Commits
- One logical change per commit
- Past tense, sentence case, no trailing period in the subject
- Body wraps at ~72 columns

## Testing a change

```bash
# Backend import check
.venv/bin/python -c "import sys; sys.path.insert(0,'backend'); import main"

# Frontend build
(cd frontend && npm run build)

# Manual smoke test checklist is in tasks.md
```

The CI workflow runs both on every push and pull request.

## Reporting bugs

Open an issue using the "Bug report" template. Include:

- The URL you pasted (or a minimal one that reproduces the bug)
- The expected vs actual behavior
- Console output from `./run.sh` if the backend crashed
- Your OS / Python / Node versions

## Code of Conduct

Be kind. See [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).
