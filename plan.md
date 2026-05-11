**COMPLETE & FINAL PROJECT PLAN: MediaHarbor**  
**Full Professional Web Application**  
**Version 1.0 – Ready for Development**

### 1. Product Overview & Vision
MediaHarbor is a powerful, private **local web application** that lets users paste **any webpage URL** and automatically harvest **every image and every video** on that page (and optionally all pages in a paginated gallery).  

It works on modern JavaScript-heavy websites where normal tools (yt-dlp, browser extensions, online downloaders) fail. Everything is saved locally in clean, organized folders with preview, selection, and deduplication.

**Core Promise**  
Paste → Analyze → Preview → Download.  
No accounts, no cloud, no limits on personal use.

**Target Users**  
- Power users who save media from news sites, galleries, social media embeds, blogs, etc.  
- People dealing with 50-page photo galleries or infinite-scroll pages.

**Tagline**  
“Paste any link. Harvest everything.”

### 2. Full Feature List

**MVP (Must-Have for v1.0)**
- Single URL input
- Full page rendering with Playwright (handles JS, lazy loading, infinite scroll)
- Real-time network interception for all media files
- Auto-scroll to trigger lazy-loaded content
- Extract images (img, srcset, CSS background, og:image, picture tags)
- Extract videos (<video>, <source>, .mp4, .webm, .m3u8, .mpd)
- Smart deduplication (MD5 hash of URL + content)
- Organized folders: `images/` and `videos/`
- Live progress log + percentage
- Pause / Cancel / Resume
- Preview grid with checkboxes (select what to keep)
- Basic settings (download folder, concurrent downloads)

**v1.0 Core Additions (Required for Release)**
- **Multi-Page Gallery Harvesting** (the feature you asked about)
  - Automatic detection of pagination (URL patterns like ?page=, numbered links, “Next” button, infinite scroll)
  - Analysis Summary screen after first page
  - User chooses: Only this page OR 5 / 10 / 25 / 50 / All pages
  - Optional per-page subfolders (images/page-01/, videos/page-01/)
  - Configurable delay between pages (1–5 seconds)
  - Resume support (start from page X)
- HLS / DASH stream support via ffmpeg (converts .m3u8/.mpd → clean .mp4)
- Stealth / anti-bot mode (Playwright extra stealth + random delays + realistic fingerprints)
- Harvest History panel (list of past URLs with thumbnail collage, media count, date, “Open Folder”)
- Dark theme by default + Light mode toggle

**Future Features (v1.1+) – Planned but Post-Launch**
- Batch URL list (paste 10+ links at once)
- Cookie / login import (for private pages)
- Video thumbnail generation for preview
- Metadata JSON export
- Ignore list (skip certain domains or file types)
- Auto-update checker
- Export/import settings
- Mobile companion app (optional later)

### 3. Technical Architecture
- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Python 3.11+ with FastAPI web server
- **Browser Automation**: Playwright Python (Chromium engine)
- **Downloads**: aiohttp (fast async) + ffmpeg (for streams)
- **Database**: SQLite (local history + settings)
- **Server**: FastAPI (handles API calls from React)

All communication between UI and Python uses HTTP requests + JSON.

### 4. Folder Structure (Auto-Created on Download)
```
~/Downloads/MediaHarbor/
├── [domain-name]-2026-05-07/          ← folder named after URL + date
│   ├── images/
│   │   ├── image-001.jpg
│   │   ├── banner.webp
│   │   └── ...
│   ├── videos/
│   │   ├── main-video.mp4
│   │   └── reel-01.mp4
│   ├── thumbnails/                    ← optional
│   ├── metadata.json                  ← optional (original URLs + sizes)
│   └── per-page subfolders (if chosen)
│       ├── page-01/
│       └── page-02/
└── MediaHarbor.db                     ← SQLite history file
```

### 5. Complete UI Wireframes (Text Descriptions)

**Screen 1: Home / Dashboard**
- Top bar: Logo + Settings + History + About
- Big input field: “Paste webpage URL here”
- Two big buttons: [Harvest Quick] [Harvest Deep]
- Below: Recent harvests list (clickable cards with thumbnail collage + counts)

**Screen 2: Analysis Summary (New after paste)**
- Shows detected pagination (e.g., “50-page gallery found”)
- Media summary on page 1
- Checkbox: “Enable Multi-Page Harvest”
- Controls: Number of pages dropdown, start-from page, delay slider, per-page folders toggle
- Buttons: “Harvest Only This Page” or “Start Multi-Page Harvest”

**Screen 3: Harvest Progress (Live)**
- URL at top
- Big progress bar + estimated time
- Live log panel (scrolling)
- Tabbed preview grid: All | Images | Videos
- Each thumbnail shows small “Page X” badge if multi-page
- Select All / Deselect buttons
- Bottom bar: Pause | Cancel | Download Selected

**Screen 4: Settings**
- Default save folder
- Concurrent downloads slider
- Stealth mode toggle
- Multi-page defaults
- Theme
- Proxy support (advanced)
- Clear history button

**Screen 5: History / Library**
- Search bar
- Grid of past harvests
- Each card: thumbnail collage + “42 images • 7 videos” + date + Open Folder button

### 6. Development Phases (Step-by-Step Plan)

**Phase 0: Setup (1 day)**
- Install Node.js, Python 3.11+, ffmpeg
- Create React frontend with Vite + Tailwind CSS
- Set up FastAPI backend structure
- Configure CORS for local development

**Phase 1: Core Engine (Python only – 4–7 days)**
- Build standalone Python script that takes URL and does full harvest
- Implement Playwright + network interception
- Add auto-scroll + DOM extraction
- Add basic download logic
- Test on 15 different difficult websites

**Phase 2: Multi-Page & Smart Features (7–10 days)**
- Add pagination detection logic
- Build Analysis Summary flow
- Implement multi-page loop with delay
- Add HLS/ffmpeg support
- Add deduplication + clean naming

**Phase 3: React Frontend Integration (5–7 days)**
- Connect FastAPI backend to React frontend
- Build all React UI screens with Tailwind CSS
- Add live progress polling
- Implement preview grid with thumbnails
- Set up CORS properly

**Phase 4: Polish & Testing (7–10 days)**
- Add History + Settings
- Stealth improvements
- Full testing on 30+ real websites
- Bug fixing + edge cases (anti-bot blocks, huge galleries, etc.)
- Instructions for running locally

**Total Realistic Timeline**: 4–6 weeks (part-time) or 3 weeks (full-time)

### 7. Testing Strategy
- Test suite of 30 websites (news, galleries, social embeds, video players, infinite scroll)
- Compare results vs manual save + yt-dlp
- Test multi-page on real 20–50 page galleries
- Test on Windows, macOS, Linux
- Stress test: 100-page gallery, 1000+ files

### 8. Risks & Mitigations
- Sites block scraping → Mitigation: Stealth mode + polite delays + user-agent rotation
- True DRM videos (Netflix-style) → Impossible to fix; app will clearly say “DRM protected”
- App performance → FastAPI + async handles this fine
- Legal → App is for personal offline use only; include disclaimer

### 9. Packaging & Distribution
- No packaging needed - runs locally via `python main.py`
- User visits `http://localhost:8000` in their browser
- Optional: .bat/.sh script to auto-open browser and start server

### 10. Final Deliverables (End of v1.0)
- Fully working web app (runs locally)
- Complete source code (organized)
- User guide (simple README)
- How to run instructions

This is the **complete, exhaustive plan** covering vision, features, architecture, UI, development steps, testing, risks — literally everything needed to build MediaHarbor from zero to a professional tool.

You now have a crystal-clear blueprint.

**Next Step**  
Tell me exactly what you want to do next:
- Start building Phase 1 (I’ll give you the exact high-level structure and tools checklist)
- Zoom into any specific section (e.g., more detailed multi-page detection logic)
- Change anything in the plan
- Or anything else

Just say the word and we move forward. This is going to be an awesome project. 🚀
