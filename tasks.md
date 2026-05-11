# MediaHarbor v2 — Full Rebuild Tasks

> Paste any link. Harvest everything.

---

## Phase 0 — Wipe & Setup

### 0.1 Clean the repo
- [ ] Delete `backend/multi_page.py` (logic duplicated, replaced by extractor.py)
- [ ] Delete `backend/network_intercept.py` (merged into extractor.py)
- [ ] Delete `backend/dom_extractor.py` (merged into extractor.py)
- [ ] Delete `backend/auto_scroll.py` (merged into extractor.py)
- [ ] Delete `backend/playwright_client.py` (merged into extractor.py)
- [ ] Delete `backend/pagination.py` (merged into extractor.py)
- [ ] Delete `frontend/src/App.css` (replaced by Tailwind)
- [ ] Clear `frontend/src/App.jsx` (full rewrite)
- [ ] Delete `mediaharbor.db` (schema changes, will be recreated)

### 0.2 Backend dependencies
- [ ] Update `backend/requirements.txt`:
  ```
  fastapi==0.115.0
  uvicorn[standard]==0.30.0
  playwright==1.44.0
  playwright-stealth==1.0.6
  aiohttp==3.9.5
  aiofiles==23.2.1
  sse-starlette==2.1.0
  ```
- [ ] Run `pip install -r backend/requirements.txt`
- [ ] Run `playwright install chromium`
- [ ] Verify ffmpeg is installed: `ffmpeg -version`

### 0.3 Frontend dependencies
- [ ] Ensure `package.json` has: `react`, `react-dom`, `axios`, `vite`, `tailwindcss`
- [ ] Run `npm install` inside `frontend/`
- [ ] Verify `npm run dev` starts without errors

---

## Phase 1 — Backend Core

### 1.1 `backend/database.py`
- [ ] Create `harvests` table:
  ```sql
  id, url, domain, image_count, video_count,
  downloaded_files, total_size_mb, output_dir, created_at
  ```
- [ ] Create `settings` table: `key TEXT PRIMARY KEY, value TEXT`
- [ ] Write `get_setting(key, default)` method
- [ ] Write `set_setting(key, value)` method
- [ ] Write `save_harvest(...)` method
- [ ] Write `get_history(limit=50)` method
- [ ] Write `delete_harvest(id)` method
- [ ] Insert default settings on first run:
  - `output_dir` → `/home/{user}/Downloads/MediaHarbor`
  - `images_subfolder` → `images`
  - `videos_subfolder` → `videos`
  - `per_site_folder` → `true`
  - `concurrent_downloads` → `5`
  - `stealth_mode` → `true`
  - `max_scrolls` → `15`
  - `scroll_delay` → `1.0`
  - `min_image_width` → `100`
  - `min_image_height` → `100`
  - `include_images` → `true`
  - `include_videos` → `true`
  - `allowed_formats` → `` (empty = all)

### 1.2 `backend/extractor.py` — unified pipeline
- [ ] Define `MediaItem` dataclass: `url, type, width, height, ext, source, is_stream`
- [ ] Define `ScanSettings` dataclass: mirrors settings fields
- [ ] Write `Extractor` class with `async scan(url, settings, on_found, on_status)` entry point
- [ ] `_setup_interception(page)` — register request/response handlers **before** `page.goto()`
- [ ] `_navigate(page, url)` — goto with 25s timeout, wait for domcontentloaded
- [ ] `_scroll(page, max_scrolls, delay, on_status)` — scroll loop, stop when height stops changing 3x
- [ ] `_extract_dom(page, base_url)` — extract from:
  - `<img src>`, `<img data-src>`, `<img data-lazy>`
  - `<img srcset>` — parse all URLs from srcset string
  - `<picture><source srcset>`
  - CSS `background-image: url(...)` via `page.evaluate()`
  - `<meta property="og:image">`, `<meta name="twitter:image">`
  - `<video src>`, `<video poster>`, `<source src>`
  - `<a href>` ending in media extensions
- [ ] `_merge_and_dedupe(network_items, dom_items)` — union by URL
- [ ] `_filter(items, settings)` — apply min_width, min_height, include_images, include_videos, allowed_formats
- [ ] Detect stream URLs: `.m3u8`, `.mpd` → set `is_stream=True`

### 1.3 `backend/downloader.py`
- [ ] Define `DownloadResult` dataclass: `url, file_path, file_size, is_new, is_stream, error`
- [ ] `Downloader` class with `output_dir, concurrent, images_subfolder, videos_subfolder, per_site_folder, site_name`
- [ ] `async download(url, item_type, on_progress)` — single file download
- [ ] Determine output subfolder: `output_dir / site_name? / images_subfolder or videos_subfolder`
- [ ] Dedup by MD5 hash of content — skip if file with same hash exists
- [ ] Clean filename: use hash prefix + original filename, max 100 chars
- [ ] Handle stream URLs: call `ffmpeg -i {url} -c copy {output}.mp4` via `asyncio.create_subprocess_exec`
- [ ] `async download_batch(items, on_progress)` — `asyncio.gather` with semaphore
- [ ] `on_progress` callback fires after each file: `(done, total, result)`

### 1.4 `backend/main.py`
- [ ] FastAPI app with lifespan (startup message)
- [ ] CORS: allow `http://localhost:*` and `http://127.0.0.1:*`
- [ ] `GET /health` → `{"status": "ok"}`
- [ ] `GET /settings` → load all settings from DB, return as JSON object
- [ ] `POST /settings` → accept JSON body, save all keys to DB, return `{"saved": true}`
- [ ] `GET /scan` (SSE) — main scan endpoint:
  - Accept `url` query param
  - Load settings from DB
  - Create `Extractor`, call `scan()` with callbacks
  - `on_status` → emit `event: status` with `{"msg": "..."}`
  - `on_found` → emit `event: found` with `MediaItem` as JSON
  - On complete → emit `event: done` with `{"total_images": N, "total_videos": N, "scan_id": "uuid"}`
  - Store found URLs in memory dict keyed by `scan_id` (for download step)
  - Use `sse_starlette.sse.EventSourceResponse`
- [ ] `POST /download` (SSE) — download endpoint:
  - Accept JSON: `{scan_id, urls, output_dir, images_subfolder, videos_subfolder, per_site_folder, site_name}`
  - Create `Downloader`, call `download_batch()` with progress callback
  - `on_progress` → emit `event: progress` with `{"done": N, "total": N, "current_file": "...", "speed_mbps": X}`
  - Per file → emit `event: file_done` with `DownloadResult` as JSON
  - On complete → emit `event: complete` with summary, save to DB history
- [ ] `GET /history` → return last 50 harvests
- [ ] `DELETE /history/{id}` → delete one entry
- [ ] `POST /open-folder` → accept `{"path": "..."}`, call `xdg-open` (Linux) / `open` (Mac) / `explorer` (Windows)

---

## Phase 2 — Frontend Components

### 2.1 `frontend/src/api.js`
- [ ] `getSettings()` → GET /settings
- [ ] `saveSettings(data)` → POST /settings
- [ ] `openFolder(path)` → POST /open-folder
- [ ] `getHistory()` → GET /history
- [ ] `deleteHistory(id)` → DELETE /history/{id}
- [ ] `startScan(url, onStatus, onFound, onDone)` → opens SSE to GET /scan?url=..., dispatches events to callbacks
- [ ] `startDownload(payload, onProgress, onFileDone, onComplete)` → opens SSE to POST /download, dispatches events

### 2.2 `frontend/src/components/URLBar.jsx`
- [ ] URL text input (full width, large, autofocus)
- [ ] Mode toggle: two pill buttons `Auto Download` | `Select & Download` — selected one is purple
- [ ] `Harvest` button — disabled when input empty or scanning in progress
- [ ] Show current output folder path below input (small grey text, clickable → navigate to Settings)
- [ ] On submit: call `onHarvest(url, mode)`

### 2.3 `frontend/src/components/ScanProgress.jsx`
- [ ] Receives `logs` array (strings) and `counts` object `{images: N, videos: N}`
- [ ] Scrolling log panel — auto-scrolls to bottom as new lines arrive
- [ ] Each log line: icon (🔵 for status, ✅ for found item) + message
- [ ] Live counters at bottom: `Images: 47  |  Videos: 3`
- [ ] Spinner animation while scanning, checkmark when done

### 2.4 `frontend/src/components/MediaCard.jsx`
- [ ] Props: `item` (MediaItem), `selected` (bool), `onToggle`
- [ ] Renders `<img src={item.url}>` for images (with `loading="lazy"`)
- [ ] For videos: grey placeholder with play icon overlay + purple border
- [ ] Bottom overlay: extension badge (`.jpg`, `.mp4`, etc.)
- [ ] Top-right: large checkbox — clicking card or checkbox toggles selection
- [ ] Selected state: purple ring border
- [ ] On hover: show full URL in `title` tooltip

### 2.5 `frontend/src/components/MediaGrid.jsx`
- [ ] Receives `items` array, `selected` Set, `onToggle`, `onSelectAll`, `onSelectNone`
- [ ] Filter bar: Show (All/Selected/Unselected), Type (All/Images/Videos), Sort (Default/Extension)
- [ ] Toolbar: `Select All` | `Select None` | `Images Only` | `Videos Only` buttons
- [ ] Responsive grid: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`
- [ ] Renders `<MediaCard>` for each filtered item
- [ ] Item count summary: `Showing 34 of 50`

### 2.6 `frontend/src/components/DownloadBar.jsx`
- [ ] Sticky bar at bottom of screen (when grid is visible)
- [ ] Shows: `{N} selected` | `Download Selected ({N})` button (purple, disabled if 0 selected)
- [ ] During download: progress bar + `{done}/{total} ({pct}%)` + speed + ETA
- [ ] Per-file log (last 5 lines, scrollable)
- [ ] On complete: `Open Folder` button + `New Harvest` button

### 2.7 `frontend/src/components/HistoryList.jsx`
- [ ] Search input at top (filters by URL/domain)
- [ ] List of harvest rows: domain, full URL, date, image count, video count, size, `Open Folder` button, delete button
- [ ] Empty state: "No harvests yet"
- [ ] Delete calls `deleteHistory(id)` then refreshes list

### 2.8 `frontend/src/components/SettingsForm.jsx`
- [ ] Section: **Download Location**
  - Output folder: text input + `Browse` button (calls `POST /open-folder` with current path to open picker — or just manual type)
  - Per-site subfolder: toggle switch
  - Images subfolder name: text input
  - Videos subfolder name: text input
- [ ] Section: **What to Download**
  - Include images: toggle
  - Include videos: toggle
  - Min image width (px): number input
  - Min image height (px): number input
  - Allowed formats: chip multi-select — `jpg` `png` `webp` `gif` `mp4` `webm` (empty = all)
- [ ] Section: **Browser & Speed**
  - Stealth mode: toggle
  - Max scroll depth: range slider 1–50, shows value
  - Scroll delay: range slider 0.5–5.0s, shows value
  - Concurrent downloads: range slider 1–10, shows value
- [ ] Section: **Danger Zone**
  - Clear all history: red button with confirmation
- [ ] `Save Settings` button — calls `saveSettings()`, shows "Saved ✓" for 2s

### 2.9 `frontend/src/App.jsx`
- [ ] State: `screen` (home/history/settings), `mode` (auto/select), `scanState` (idle/scanning/done), `items` (array), `selected` (Set), `downloadState` (idle/downloading/done), `logs` (array), `counts` (object), `settings` (object)
- [ ] Load settings on mount via `getSettings()`
- [ ] Top navbar: logo + History + Settings nav buttons
- [ ] Render `<URLBar>` always on home screen
- [ ] `handleHarvest(url, mode)`:
  - Set `scanState = scanning`
  - Call `startScan(url, onStatus, onFound, onDone)`
  - `onStatus`: append to `logs`
  - `onFound`: append to `items`, increment `counts`, if mode=auto add to `selected`
  - `onDone`: set `scanState = done`, if mode=auto immediately call `handleDownload()`
- [ ] `handleDownload()`:
  - Build payload from `selected` items + settings
  - Call `startDownload(payload, onProgress, onFileDone, onComplete)`
  - Update download progress state
- [ ] Render `<ScanProgress>` when `scanState !== idle`
- [ ] Render `<MediaGrid>` when `scanState === done` and `mode === select`
- [ ] Render `<DownloadBar>` when `scanState === done` and `mode === select`
- [ ] Render `<HistoryList>` when `screen === history`
- [ ] Render `<SettingsForm>` when `screen === settings`

---

## Phase 3 — Integration & Testing

### 3.1 Wire up and smoke test
- [ ] Start backend: `uvicorn main:app --reload` from `backend/`
- [ ] Start frontend: `npm run dev` from `frontend/`
- [ ] Test `GET /health` returns 200
- [ ] Test `GET /settings` returns default settings
- [ ] Test `POST /settings` saves and `GET /settings` reflects changes
- [ ] Test `GET /scan?url=https://example.com` streams SSE events
- [ ] Test `POST /download` streams progress events
- [ ] Test `GET /history` returns saved harvest

### 3.2 Test on real sites
- [ ] `https://unsplash.com` — infinite scroll, lazy loading
- [ ] `https://imgur.com/gallery/...` — gallery page
- [ ] `https://www.reddit.com/r/EarthPorn` — mixed images
- [ ] `https://vimeo.com` — video extraction
- [ ] `https://giphy.com` — GIF extraction
- [ ] `https://500px.com` — high-res photography site
- [ ] `https://flickr.com` — paginated gallery
- [ ] `https://pixabay.com` — stock photos
- [ ] `https://www.pexels.com` — stock photos + videos
- [ ] Any news site (BBC, CNN) — mixed media article

### 3.3 Fix extraction bugs found in testing
- [ ] Fix any URLs that fail to resolve (relative URLs, CDN rewrites)
- [ ] Fix any sites where stealth mode is needed but not triggering
- [ ] Fix any SSE connection drops
- [ ] Fix any download failures (403s, redirects, content-type mismatches)

### 3.4 UI polish
- [ ] Verify grid thumbnails load correctly (CORS issues on some image URLs — use `crossOrigin="anonymous"` or proxy)
- [ ] Verify progress bar is smooth
- [ ] Verify log panel auto-scrolls
- [ ] Verify settings save/load correctly
- [ ] Verify history shows correct data
- [ ] Test Select All / None / Images / Videos toolbar buttons
- [ ] Test filter bar (Show/Type/Sort)
- [ ] Test Open Folder button on Linux

---

## Phase 4 — Installation Script

### 4.1 Create `install.sh`
- [ ] Check Python 3.11+ is installed, error if not
- [ ] Check Node.js 18+ is installed, error if not
- [ ] Check ffmpeg is installed, warn if not (optional for stream support)
- [ ] Create Python venv at `.venv/`
- [ ] Activate venv and `pip install -r backend/requirements.txt`
- [ ] Run `playwright install chromium`
- [ ] Run `npm install` inside `frontend/`
- [ ] Build frontend: `npm run build` inside `frontend/`
- [ ] Print success message with instructions to run

```bash
#!/bin/bash
set -e

echo "=== MediaHarbor v2 Installer ==="

# Check Python
python3 --version | grep -E "3\.(1[1-9]|[2-9][0-9])" || { echo "ERROR: Python 3.11+ required"; exit 1; }

# Check Node
node --version | grep -E "v(1[8-9]|[2-9][0-9])\." || { echo "ERROR: Node.js 18+ required"; exit 1; }

# Check ffmpeg (optional)
ffmpeg -version &>/dev/null || echo "WARNING: ffmpeg not found. HLS/DASH stream download will be disabled."

# Python venv
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt --quiet
playwright install chromium

# Frontend
cd frontend
npm install --silent
npm run build
cd ..

echo ""
echo "✅ MediaHarbor installed successfully!"
echo ""
echo "To start: ./run.sh"
echo "Then open: http://localhost:8000"
```

### 4.2 Update `run.sh`
- [ ] Activate venv
- [ ] Start uvicorn serving both API and built frontend static files
- [ ] Open browser automatically after 2s delay

```bash
#!/bin/bash
source .venv/bin/activate
echo "Starting MediaHarbor..."
(sleep 2 && xdg-open http://localhost:8000 2>/dev/null || open http://localhost:8000 2>/dev/null) &
cd backend && uvicorn main:app --host 0.0.0.0 --port 8000
```

### 4.3 Serve frontend from FastAPI
- [ ] In `backend/main.py`, add `StaticFiles` mount to serve `frontend/dist/` at `/`
- [ ] Add catch-all route to serve `index.html` for React router
- [ ] This means single `run.sh` starts everything — no separate frontend dev server needed for production

---

## Phase 5 — README

### 5.1 Create `README.md`
- [ ] Write the following sections:

```markdown
# MediaHarbor

> Paste any link. Harvest everything.

A local web app that extracts and downloads every image and video from any webpage.
Works on JavaScript-heavy sites, infinite scroll galleries, and lazy-loaded content.

## Features

- Extracts images and videos from any webpage
- Two modes: Auto Download or Select & Download
- Real-time progress with live preview grid
- Multi-page gallery support
- HLS/DASH stream download via ffmpeg
- Stealth mode to bypass bot detection
- Full settings control: output folder, filters, concurrency
- Harvest history with folder access

## Requirements

- Python 3.11+
- Node.js 18+
- ffmpeg (optional, for HLS/DASH streams)

## Install

    git clone https://github.com/Twarga/MediaHarborButcher.git
    cd MediaHarbor
    chmod +x install.sh
    ./install.sh

## Run

    ./run.sh

Then open http://localhost:8000 in your browser.

## Usage

1. Paste any webpage URL into the input field
2. Choose mode: **Auto Download** (downloads everything) or **Select & Download** (pick what you want)
3. Click **Harvest**
4. Watch the live scan progress
5. In Select mode: check/uncheck items in the grid, then click Download
6. Find your files in `~/Downloads/MediaHarbor/` (configurable in Settings)

## Settings

| Setting | Default | Description |
|---|---|---|
| Output folder | ~/Downloads/MediaHarbor | Where files are saved |
| Per-site folder | On | Creates subfolder per domain |
| Min image size | 100x100px | Filters out icons/tracking pixels |
| Stealth mode | On | Bypasses bot detection (slower) |
| Max scrolls | 15 | How deep to scroll for lazy content |
| Concurrent downloads | 5 | Parallel download threads |

## Troubleshooting

**Backend won't start**: Make sure you ran `./install.sh` and the venv is active.

**No images found**: Try enabling Stealth Mode in Settings. Some sites block automated browsers.

**403 errors on download**: The site requires cookies/login. This tool works on public pages only.

**ffmpeg not found**: Install with `sudo apt install ffmpeg` (Linux) or `brew install ffmpeg` (Mac).

## Legal

This tool is for personal use only. Only download content you have the right to download.
Respect copyright and terms of service of websites you use this on.
```

---

## Phase 6 — GitHub Pages Landing Page

### 6.1 Create `docs/index.html`
- [ ] Single HTML file (no build step, pure HTML/CSS/JS)
- [ ] Enable GitHub Pages in repo settings → Source: `docs/` folder
- [ ] Content:

```
Header:
  MediaHarbor logo (text, purple)
  Tagline: "Paste any link. Harvest everything."
  [Download v2.0] button  [View on GitHub] button

Hero section:
  Screenshot/mockup of the app UI (or ASCII art mockup if no screenshot yet)

Features section (3 columns):
  🎯 Any Website        — Works on JS-heavy sites, infinite scroll, lazy loading
  🎬 Images & Videos    — JPG, PNG, WebP, GIF, MP4, WebM, HLS streams
  ✅ Select & Download  — Preview everything, pick what you want

How it works (3 steps):
  1. Paste URL
  2. Scan & Preview
  3. Download

Requirements section:
  Python 3.11+ | Node.js 18+ | ffmpeg (optional)

Install section (code block):
  git clone ...
  ./install.sh
  ./run.sh

Footer:
  MIT License | GitHub link
```

### 6.2 Style the landing page
- [ ] Dark background (`#0f0f0f`), purple accent (`#7c3aed`)
- [ ] System font stack (no external fonts needed)
- [ ] Responsive (works on mobile)
- [ ] No JavaScript required (pure CSS)
- [ ] Total file size under 20KB

### 6.3 GitHub Pages config
- [ ] Create `docs/` folder
- [ ] Add `docs/index.html` (landing page)
- [ ] Optionally add `docs/screenshot.png` (app screenshot)
- [ ] In GitHub repo settings: Pages → Source → `docs/` folder → Save
- [ ] Verify page loads at `https://Twarga.github.io/MediaHarborButcher`

---

## Phase 7 — Release

### 7.1 Git cleanup
- [ ] Add `.gitignore`:
  ```
  .venv/
  __pycache__/
  *.pyc
  frontend/node_modules/
  frontend/dist/
  mediaharbor.db
  downloads/
  *.db
  .env
  ```
- [ ] Remove `mediaharbor.db` from git history if committed
- [ ] Remove `frontend/node_modules/` from git if committed

### 7.2 Tag and release
- [ ] Commit all changes: `git add -A && git commit -m "MediaHarbor v2.0 - full rebuild"`
- [ ] Tag: `git tag v2.0.0`
- [ ] Push: `git push origin main --tags`
- [ ] Create GitHub Release:
  - Tag: `v2.0.0`
  - Title: `MediaHarbor v2.0 — Full Rebuild`
  - Body: paste the README features section
  - Attach: nothing (users clone and run install.sh)

### 7.3 Final checklist before release
- [ ] `install.sh` runs clean on a fresh machine
- [ ] `run.sh` starts the app and opens browser
- [ ] All 10 test sites work
- [ ] Settings save and load correctly
- [ ] History records harvests correctly
- [ ] Open Folder button works
- [ ] README is accurate
- [ ] GitHub Pages landing page is live
- [ ] No secrets or personal paths hardcoded in source

---

## Summary

| Phase | What | Files |
|---|---|---|
| 0 | Wipe old code, install deps | requirements.txt, package.json |
| 1 | Backend rebuild | database.py, extractor.py, downloader.py, main.py |
| 2 | Frontend rebuild | api.js, 7 components, App.jsx |
| 3 | Integration & testing | — |
| 4 | Install script + run script | install.sh, run.sh |
| 5 | README | README.md |
| 6 | GitHub Pages landing | docs/index.html |
| 7 | Release | git tag, GitHub Release |

**Total new/rewritten files: 16**
**Files deleted: 6 (old backend modules)**
