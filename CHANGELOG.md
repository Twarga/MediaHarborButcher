# Changelog

All notable changes to MediaHarbor are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and releases use
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- **Imagechest ordered mode** — auto-detected for `imgchest.com` and
  `imagechest.com` URLs. Preserves gallery order, writes files with
  zero-padded sequential prefixes (`001_…`, `002_…`). Each post lands in its
  own folder (`imagechest-{postId}/`) so subsequent harvests never collide.
- Subtle amber pill below the URL bar confirms the folder name and ordered
  mode before harvesting.

### Changed
- `/download` saves the real hostname in history regardless of the
  `site_name` override used for folder naming.

---

## [2.1.0] — 2026-05-12

### Added
- **yt-dlp video engine** — 1800+ sites work out of the box: TikTok,
  Instagram, Twitter/X, Vimeo, Reddit, Twitch, Dailymotion, and more. Used
  as primary engine for HLS/DASH streams and as automatic fallback for
  failed HTTP video downloads.
- **Cookies forwarded** — Playwright's browser cookies and Referer are
  reused for every download (aiohttp `Cookie:` header and yt-dlp
  `cookiefile`), so CDN-protected media works without a separate login.
- **Retry & recover** — 3 retries with exponential backoff + jitter on
  403/429/5xx/timeout. Content-Type validation rejects HTML error pages
  served as `image/*`. One-click "Retry Failed (N)" button after each batch.
- Keyboard shortcuts: <kbd>Ctrl/Cmd</kbd>+<kbd>Enter</kbd> to harvest,
  <kbd>Esc</kbd> to cancel.
- Toast notification system replacing all `alert()` dialogs.
- Video poster thumbnails in the grid, image dimension badges, HLS badge.
- History dates formatted as relative time.
- "Clear all history" button in Danger zone.

### Changed
- **Full design refresh.** Editorial palette: warm near-black ink, amber
  harbor-lantern primary, coral accent, teal success (no more stock purple
  on gray). Typography: Instrument Serif display, Inter UI, JetBrains Mono
  code.
- 23 custom SVG icons replacing every emoji in the UI.
- Landing page rewritten with the same design system (realistic app mockup,
  numbered step counter, 9 feature cards).
- `uvicorn` now binds to `127.0.0.1` (was `0.0.0.0`).
- CORS locked to `localhost`/`127.0.0.1` origins via regex.
- Downloads stream to disk with incremental hashing (no RAM buffering).
- Real rolling-window download speed calculation.

### Fixed
- Min image-width/height filter was dead code — now actually applied with
  dimensions extracted from the DOM.
- `playwright-stealth` version pin now matches the API the code uses.
- Memory leak in the in-memory scan cache (1-hour TTL + active pruning).
- `asyncio.create_task` results now held in a strong-ref set to survive GC.
- `/open-folder` validates paths before shelling out (path-injection risk).
- SSE connection cleanup on reset / re-harvest.

### Removed
- Stale `__pycache__` leftovers from v1 modules, unused frontend assets,
  legacy `plan.md`, destructive `start-backend.sh` (`rm -rf .venv` every
  run), `App.css`.

---

## [2.0.0] — 2026-05-11

### Added
- Unified Playwright extraction pipeline replacing four older modules
  (`network_intercept`, `dom_extractor`, `auto_scroll`, `playwright_client`).
- Real-time scan + download progress via Server-Sent Events.
- Live preview grid with per-item checkboxes ("Select & Download" mode).
- Auto-download mode: paste → harvest → everything grabbed immediately.
- HLS/DASH stream support via ffmpeg.
- SQLite history of past harvests with search and "Open folder" actions.
- Stealth mode bypass for bot-detection CDNs.
- Single-command install (`./install.sh`) and run (`./run.sh`).
- GitHub Pages landing page at `docs/`.

### Known issues (fixed in 2.1.0)
- `playwright-stealth` pin mismatch at install time.
- Min-size filter settings stored but never applied.
- Downloads buffered whole files into RAM.
- No retries on transient failures.

[Unreleased]: https://github.com/Twarga/MediaHarborButcher/compare/v2.1.0...HEAD
[2.1.0]: https://github.com/Twarga/MediaHarborButcher/releases/tag/v2.1.0
[2.0.0]: https://github.com/Twarga/MediaHarborButcher/releases/tag/v2.0.0
