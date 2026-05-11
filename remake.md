# MediaHarbor v2 — Full Rebuild Plan

> GitHub: https://github.com/Twarga/MediaHarborButcher

---

## 1. What We're Building

A local web app that runs on your machine at `localhost:8000`. It uses a real browser engine (Playwright/Chromium) to load any webpage — including JavaScript-heavy sites — and extract every image and video. You control exactly what gets downloaded and where.

---

## 2. Tech Stack

| Layer | Tech |
|---|---|
| Backend | Python 3.14 + FastAPI |
| Browser engine | Playwright (Chromium) + playwright-stealth |
| Real-time comms | SSE (Server-Sent Events) |
| Downloads | aiohttp (async, concurrent) |
| Video streams | ffmpeg (m3u8/mpd → mp4) |
| Database | SQLite (history + settings) |
| Frontend | React + Vite + Tailwind CSS |

---

## 3. File Structure

```
MediaHarborButcher/
├── backend/
│   ├── main.py                  ← FastAPI app, all routes
│   ├── extractor.py             ← unified pipeline (replaces 4 old files)
│   ├── downloader.py            ← async downloader with progress callbacks
│   ├── database.py              ← SQLite (history + settings)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx              ← router + layout + state
│   │   ├── api.js               ← all fetch/SSE calls
│   │   └── components/
│   │       ├── URLBar.jsx       ← URL input + mode selector + harvest button
│   │       ├── ScanProgress.jsx ← live SSE log + found counts
│   │       ├── MediaGrid.jsx    ← thumbnail grid with checkboxes
│   │       ├── MediaCard.jsx    ← single image/video card
│   │       ├── DownloadBar.jsx  ← select toolbar + download button + progress
│   │       ├── HistoryList.jsx  ← past harvests
│   │       └── SettingsForm.jsx ← all settings controls
│   ├── package.json
│   └── vite.config.js
├── docs/
│   └── index.html               ← GitHub Pages landing page
├── mediaharbor.db
├── install.sh
├── run.sh
├── README.md
├── tasks.md
└── remake.md
```

---

## 4. What's Wrong With the Current Code

| Problem | Fix |
|---|---|
| Network intercept registered AFTER `page.goto()` — misses all initial requests | Register handlers before `page.goto()` |
| Only images downloaded, videos completely ignored | Unified extractor handles both |
| No real-time feedback — UI just waits with a spinner | SSE on both scan and download |
| 50-file hardcoded cap | Removed, configurable |
| `multi_page.py` duplicates extraction logic | Deleted, one extractor |
| Settings not persisted to DB | Full settings save/load |
| No preview before download | Select mode with full grid |
| No video support in UI | Video cards with play icon |
| Single 600-line App.jsx | Split into 7 components |
| Analyze endpoint reloads page twice | Single pass |
| No min-size filter | Settings: min width/height |

---

## 5. Backend — Every Endpoint

### `GET /health`
Returns `{"status": "ok"}`.

---

### `GET /settings`
Returns all settings as JSON:
```json
{
  "output_dir": "/home/user/Downloads/MediaHarbor",
  "images_subfolder": "images",
  "videos_subfolder": "videos",
  "per_site_folder": true,
  "concurrent_downloads": 5,
  "stealth_mode": true,
  "max_scrolls": 15,
  "scroll_delay": 1.0,
  "min_image_width": 100,
  "min_image_height": 100,
  "include_images": true,
  "include_videos": true,
  "allowed_formats": []
}
```

---

### `POST /settings`
Accepts same JSON body, saves all to SQLite. Returns `{"saved": true}`.

---

### `GET /scan?url=...` — SSE stream
The main engine. Streams Server-Sent Events in real time.

**Step by step:**
1. Launch Playwright Chromium (stealth if enabled)
2. Register network interception handlers **before** `page.goto()`
3. Navigate to URL
4. Auto-scroll to trigger lazy loading
5. Extract all media from DOM
6. Merge network-intercepted + DOM-extracted URLs
7. Deduplicate
8. Filter by settings (min size, format, type)
9. Stream each found item back as it's discovered

**SSE events emitted:**
```
event: status
data: {"msg": "Launching browser..."}

event: status
data: {"msg": "Scrolling page (3/15)..."}

event: found
data: {"url": "https://...", "type": "image", "width": 1200, "height": 800, "ext": ".jpg", "source": "img.src", "is_stream": false}

event: found
data: {"url": "https://...", "type": "video", "width": 0, "height": 0, "ext": ".mp4", "source": "video.src", "is_stream": false}

event: done
data: {"total_images": 47, "total_videos": 3, "scan_id": "abc123"}
```

---

### `POST /download` — SSE stream
Called after user selects items (Select mode) or immediately after scan (Auto mode).

**Request body:**
```json
{
  "scan_id": "abc123",
  "urls": ["https://...", "https://..."],
  "output_dir": "/home/user/Downloads/MediaHarbor",
  "images_subfolder": "images",
  "videos_subfolder": "videos",
  "per_site_folder": true,
  "site_name": "unsplash.com"
}
```

**SSE events emitted:**
```
event: progress
data: {"done": 5, "total": 47, "current_file": "image-001.jpg", "speed_mbps": 2.3}

event: file_done
data: {"url": "https://...", "path": "/home/.../image-001.jpg", "size": 204800, "is_new": true, "error": null}

event: complete
data: {"downloaded": 45, "skipped": 2, "errors": 1, "total_size_mb": 124.5, "output_dir": "/home/..."}
```

---

### `GET /history`
Returns last 50 harvests from SQLite.

### `DELETE /history/{id}`
Deletes one history entry.

### `POST /open-folder`
Opens OS file manager at given path. Body: `{"path": "..."}`.

---

## 6. Backend — `extractor.py`

Replaces: `network_intercept.py`, `dom_extractor.py`, `auto_scroll.py`, `playwright_client.py`, `pagination.py`

**`MediaItem` dataclass:**
```python
@dataclass
class MediaItem:
    url: str        # final resolved URL
    type: str       # "image" or "video"
    width: int      # 0 if unknown
    height: int     # 0 if unknown
    ext: str        # ".jpg", ".mp4", etc.
    source: str     # "network", "img.src", "srcset", "css.bg", "video.src", "meta"
    is_stream: bool # True for m3u8/mpd
```

**`Extractor` class:**
- `async scan(url, settings, on_found, on_status)` — main entry point
- `_setup_interception(page)` — register handlers **before** goto
- `_navigate(page, url)` — goto with 25s timeout
- `_scroll(page, max_scrolls, delay, on_status)` — scroll until height stops changing 3x
- `_extract_dom(page, base_url)` — img src/data-src/data-lazy, srcset, picture source, CSS background-image, og:image/twitter:image meta, video src/poster, source src, a[href] with media extensions
- `_merge_and_dedupe(network_items, dom_items)` — union by URL
- `_filter(items, settings)` — min size, type, format filters

---

## 7. Backend — `downloader.py`

**`DownloadResult` dataclass:**
```python
@dataclass
class DownloadResult:
    url: str
    file_path: str
    file_size: int
    is_new: bool        # False = duplicate (same MD5 already exists)
    is_stream: bool     # True = was m3u8/mpd, converted via ffmpeg
    error: str | None
```

**Key behaviors:**
- Output path: `output_dir / site_name? / images_subfolder or videos_subfolder`
- Dedup by MD5 hash of content
- Stream URLs (`.m3u8`, `.mpd`): call `ffmpeg -i {url} -c copy {output}.mp4`
- Progress callback fires per file: `(done, total, result)`
- Semaphore limits concurrency to `concurrent_downloads` setting

---

## 8. Database Schema

```sql
CREATE TABLE harvests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    domain TEXT,
    image_count INTEGER DEFAULT 0,
    video_count INTEGER DEFAULT 0,
    downloaded_files INTEGER DEFAULT 0,
    total_size_mb REAL DEFAULT 0,
    output_dir TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT
);
```

**Default settings (inserted on first run):**
```
output_dir            → /home/{user}/Downloads/MediaHarbor
images_subfolder      → images
videos_subfolder      → videos
per_site_folder       → true
concurrent_downloads  → 5
stealth_mode          → true
max_scrolls           → 15
scroll_delay          → 1.0
min_image_width       → 100
min_image_height      → 100
include_images        → true
include_videos        → true
allowed_formats       → (empty = all)
```

---

## 9. Frontend — Every Screen

### Screen 1: Home

- Top navbar: `MediaHarbor` logo (purple) | `History` | `Settings`
- Large URL input (full width, autofocus)
- Mode toggle pills: `[ Auto Download ]  [ Select & Download ]`
- `Harvest` button (purple, full width, disabled when empty)
- Small text below: current output folder path (clickable → Settings)

**Scanning state** — progress panel below input:
```
🔵 Launching browser...
🔵 Navigating to unsplash.com...
🔵 Scrolling page (4/15)...
✅ Found image: banner.jpg
✅ Found video: intro.mp4

Images: 12  |  Videos: 1
```

### Screen 2: Media Grid (Select mode)

**Toolbar:**
```
[Select All] [Select None] [Images Only] [Videos Only]
                              34 selected | [Download Selected (34)]
```

**Filter bar:** Show (All/Selected/Unselected) | Type (All/Images/Videos) | Sort (Default/Extension)

**Grid:** 4–5 columns, responsive.

**Each card:**
- Thumbnail (`<img loading="lazy">`)
- Extension badge bottom overlay (`.jpg`, `.mp4`)
- Large checkbox top-right
- Purple ring when selected
- Video cards: play icon overlay + purple border

### Screen 3: Download Progress

```
Downloading 34 files...

████████████░░░░░░░░  18/34  (52%)
Speed: 3.2 MB/s  |  ETA: 8s

Current: banner-photo-1920x1080.jpg

✅ image-001.jpg  (204 KB)
✅ image-002.webp  (88 KB)  [duplicate]
✅ video-001.mp4  (12.4 MB)
❌ image-003.jpg  (failed: 403)

[Open Folder]  [New Harvest]
```

### Screen 4: Settings

**Download Location**
- Output folder path + Browse button
- Per-site subfolder toggle
- Images subfolder name
- Videos subfolder name

**What to Download**
- Include images toggle
- Include videos toggle
- Min image width (px)
- Min image height (px)
- Allowed formats: chip multi-select (jpg, png, webp, gif, mp4, webm)

**Browser & Speed**
- Stealth mode toggle
- Max scroll depth slider (1–50)
- Scroll delay slider (0.5–5.0s)
- Concurrent downloads slider (1–10)

**Danger Zone**
- Clear all history (red, with confirmation)

### Screen 5: History

- Search bar (filter by URL/domain)
- List rows: domain | URL | date | image count | video count | size | Open Folder | Delete

---

## 10. Two Harvest Modes — Exact Flow

### Mode 1: Auto Download
```
Paste URL → Harvest
  → GET /scan (SSE) → live log, collect all URLs silently
  → scan done → immediately POST /download with ALL URLs
  → download progress screen
  → complete
```

### Mode 2: Select & Download
```
Paste URL → Harvest
  → GET /scan (SSE) → live log, cards appear in grid as found
  → scan done → grid fully populated, all pre-checked
  → user unchecks unwanted items
  → Download Selected (N)
  → POST /download with selected URLs only
  → download progress screen
  → complete
```

---

## 11. Install & Run

### `install.sh`
```bash
#!/bin/bash
set -e
echo "=== MediaHarbor v2 Installer ==="
python3 --version | grep -E "3\.(1[1-9]|[2-9][0-9])\." || { echo "ERROR: Python 3.11+ required"; exit 1; }
node --version | grep -E "v(1[8-9]|[2-9][0-9])\." || { echo "ERROR: Node.js 18+ required"; exit 1; }
ffmpeg -version &>/dev/null || echo "WARNING: ffmpeg not found. HLS/DASH streams disabled."
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt --quiet
playwright install chromium
cd frontend && npm install --silent && npm run build && cd ..
echo "✅ Done! Run: ./run.sh"
```

### `run.sh`
```bash
#!/bin/bash
source .venv/bin/activate
(sleep 2 && xdg-open http://localhost:8000 2>/dev/null || open http://localhost:8000 2>/dev/null) &
cd backend && uvicorn main:app --host 0.0.0.0 --port 8000
```

FastAPI serves the built React frontend as static files — single command starts everything.

---

## 12. Build Order

1. `backend/database.py`
2. `backend/extractor.py`
3. `backend/downloader.py`
4. `backend/main.py`
5. `frontend/src/api.js`
6. `frontend/src/components/URLBar.jsx`
7. `frontend/src/components/ScanProgress.jsx`
8. `frontend/src/components/MediaCard.jsx`
9. `frontend/src/components/MediaGrid.jsx`
10. `frontend/src/components/DownloadBar.jsx`
11. `frontend/src/components/HistoryList.jsx`
12. `frontend/src/components/SettingsForm.jsx`
13. `frontend/src/App.jsx`
14. `install.sh` + `run.sh`
15. `README.md`
16. `docs/index.html`
