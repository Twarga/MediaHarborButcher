# MediaHarbor v2 — Task Status

> Paste any link. Harvest everything.

This file used to be the build checklist. The detailed build plan lives in
[`remake.md`](remake.md). Below is a short status of what's shipped.

---

## ✅ Done (v2.0.0)

### Backend
- [x] `database.py` — SQLite settings + harvest history + `clear_history`
- [x] `extractor.py` — unified Playwright pipeline, network intercept registered **before** `goto`, DOM extraction (img/srcset/picture/CSS-bg/og/twitter/video/source/a[href]), auto-scroll, stealth mode, **min-width/min-height filter applied**, `poster` captured for videos
- [x] `downloader.py` — async downloads, **streamed to disk** (no RAM buffering), incremental MD5 hashing, Referer + real browser headers, ffmpeg stream support, per-file `elapsed` time
- [x] `main.py` — FastAPI + SSE, CORS locked to `localhost`/`127.0.0.1`, `/open-folder` validates the path, `_scans` TTL + task references, rolling-window download speed
- [x] Serves built frontend as static files at `/`

### Frontend
- [x] `api.js` — relative URLs, robust SSE parsing, `AbortController` cleanup, `clearHistory`
- [x] `App.jsx` — `ErrorBoundary`, stream cleanup on reset/re-harvest, `source_url` passed through to downloader
- [x] `URLBar`, `ScanProgress`, `MediaGrid`, `MediaCard` (with poster thumbnails + WxH badge), `DownloadBar`, `HistoryList` (formatted dates), `SettingsForm` (with Danger Zone → Clear History)
- [x] Vite dev proxy for `/scan /download /settings /history /health /open-folder`

### Ops
- [x] `install.sh` — checks Python/Node/ffmpeg, creates venv, `playwright install chromium`, builds frontend
- [x] `run.sh` — single command, binds to `127.0.0.1:8000`, opens browser
- [x] `.gitignore` excludes `.venv`, `node_modules`, `dist`, `*.db`
- [x] `docs/index.html` — GitHub Pages landing page
- [x] `v2.0.0` git tag

---

## 🔜 Nice-to-haves (post-1.0)

- [ ] Screenshots for README
- [ ] Automated tests for `extractor._classify` and download retries
- [ ] Per-page gallery pagination (URL patterns, Next buttons) — design in `remake.md`
- [ ] Cookie import for auth-gated pages
- [ ] Batch URL list (paste multiple pages at once)

---

## 🧪 Manual smoke-test checklist

Before tagging a new release, run through:

1. `./install.sh` on a fresh clone
2. `./run.sh`, open `http://localhost:8000`
3. Settings → change output folder → Save → refresh → still changed
4. Paste a known image-heavy page (e.g. Unsplash search result) → Harvest (Select mode) → scan completes, grid populates, checkboxes work
5. Download Selected → progress bar moves, `MB/s` is non-zero, files appear in the configured folder
6. History tab → entry present, "Open Folder" opens the OS file manager
7. Danger Zone → Clear History → list empties
