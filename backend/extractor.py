import asyncio
import re
from dataclasses import dataclass, field
from typing import Callable, Awaitable
from urllib.parse import urljoin, urlparse

from playwright.async_api import async_playwright
from playwright_stealth import Stealth


IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".bmp", ".svg"}
VIDEO_EXTS = {".mp4", ".webm", ".mov", ".m4v", ".avi", ".mkv", ".ts"}
STREAM_EXTS = {".m3u8", ".mpd"}

IMAGE_CT_PREFIX = ("image/",)
VIDEO_CT_PREFIX = ("video/", "application/x-mpegurl", "application/vnd.apple.mpegurl",
                   "application/dash+xml")

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)


@dataclass
class MediaItem:
    url: str
    type: str        # "image" | "video"
    ext: str
    source: str
    is_stream: bool = False
    width: int = 0
    height: int = 0
    poster: str = ""
    index: int = -1  # position in source page when ordered mode is on; -1 means unordered


@dataclass
class ScanContext:
    """Cookies + UA collected during the scan, forwarded to the downloader."""
    user_agent: str = USER_AGENT
    cookies: list[dict] = field(default_factory=list)  # Playwright cookie dicts
    referer: str = ""


def _ext(url: str) -> str:
    path = urlparse(url).path.lower()
    for e in IMAGE_EXTS | VIDEO_EXTS | STREAM_EXTS:
        if path.endswith(e):
            return e
    return ""


def _classify_by_url(url: str) -> tuple[str, str, bool]:
    """Returns (type, ext, is_stream) or ('', '', False) if URL doesn't look like media."""
    e = _ext(url)
    if e in IMAGE_EXTS:
        return "image", e, False
    if e in VIDEO_EXTS:
        return "video", e, False
    if e in STREAM_EXTS:
        return "video", e, True
    u = url.lower()
    if any(x in u for x in ("image/", "/images/", "photo", "/img/", "thumb", "/photos/")):
        return "image", ".jpg", False
    if any(x in u for x in ("video/", "/videos/", "/stream/", "/hls/", "mediadelivery")):
        return "video", ".mp4", False
    return "", "", False


def _classify_by_ct(content_type: str) -> tuple[str, str, bool]:
    ct = content_type.lower().split(";")[0].strip()
    if ct.startswith(IMAGE_CT_PREFIX):
        ext = "." + ct.split("/")[-1].replace("jpeg", "jpg")
        if ext not in IMAGE_EXTS:
            ext = ".jpg"
        return "image", ext, False
    if ct.startswith("application/x-mpegurl") or ct.startswith("application/vnd.apple.mpegurl"):
        return "video", ".m3u8", True
    if ct.startswith("application/dash+xml"):
        return "video", ".mpd", True
    if ct.startswith("video/"):
        ext = "." + ct.split("/")[-1]
        if ext not in VIDEO_EXTS:
            ext = ".mp4"
        return "video", ext, False
    return "", "", False


def _make_item(url: str, source: str, width: int = 0, height: int = 0,
               type_hint: str = "", ext_hint: str = "", is_stream_hint: bool = False) -> MediaItem | None:
    """Create a MediaItem. If type_hint is given (e.g. from Content-Type), it overrides URL-based guessing."""
    if type_hint:
        t, e, s = type_hint, ext_hint, is_stream_hint
    else:
        t, e, s = _classify_by_url(url)
    if not t:
        return None
    return MediaItem(url=url, type=t, ext=e, source=source, is_stream=s, width=width, height=height)


def _parse_srcset(srcset: str, base: str) -> list[str]:
    urls = []
    for part in srcset.split(","):
        part = part.strip()
        if part:
            urls.append(urljoin(base, part.split()[0]))
    return urls


class Extractor:
    async def scan(
        self,
        url: str,
        settings: dict,
        on_found: Callable[[MediaItem], Awaitable[None]],
        on_status: Callable[[str], Awaitable[None]],
        ordered: bool = False,
        album_only: bool = True,
    ) -> ScanContext:
        stealth = settings.get("stealth_mode", "true") == "true"
        max_scrolls = int(settings.get("max_scrolls", 15))
        scroll_delay = float(settings.get("scroll_delay", 1.0))
        min_w = int(settings.get("min_image_width", 100))
        min_h = int(settings.get("min_image_height", 100))
        inc_images = settings.get("include_images", "true") == "true"
        inc_videos = settings.get("include_videos", "true") == "true"
        allowed = [f.strip().lower().lstrip(".") for f in settings.get("allowed_formats", "").split(",") if f.strip()]

        ctx_out = ScanContext(referer=url)
        seen_urls: set[str] = set()
        items_by_url: dict[str, MediaItem] = {}

        def add_item(item: MediaItem):
            """Insert or upgrade — keeps richest metadata (prefer known dimensions + Content-Type classifications)."""
            existing = items_by_url.get(item.url)
            if existing is None:
                items_by_url[item.url] = item
                return
            # Upgrade type classification if we now have a stronger signal
            if existing.type != item.type and item.source.startswith("ct:"):
                existing.type = item.type
                existing.ext = item.ext
                existing.is_stream = item.is_stream
            if not existing.width and item.width:
                existing.width = item.width
            if not existing.height and item.height:
                existing.height = item.height
            if not existing.poster and item.poster:
                existing.poster = item.poster

        async with async_playwright() as pw:
            browser = await pw.chromium.launch(
                headless=True,
                args=["--disable-blink-features=AutomationControlled", "--no-sandbox"],
            )
            ctx = await browser.new_context(
                viewport={"width": 1920, "height": 1080},
                user_agent=USER_AGENT,
            )
            ctx_out.user_agent = USER_AGENT
            page = await ctx.new_page()

            if stealth:
                try:
                    await Stealth().apply_stealth_async(page)
                except Exception as e:
                    await on_status(f"Stealth warning: {e}")

            # Intercept requests: URL-based classification (fast path, runs before response)
            def on_request(req):
                if req.url in seen_urls:
                    return
                item = _make_item(req.url, "network.req")
                if item:
                    seen_urls.add(req.url)
                    add_item(item)

            # Intercept responses: Content-Type classification (catches videos/images
            # served from URLs without file extensions).
            def on_response(resp):
                ct = resp.headers.get("content-type", "")
                t, e, s = _classify_by_ct(ct)
                if not t:
                    return
                item = _make_item(
                    resp.url, f"ct:{ct.split(';')[0]}",
                    type_hint=t, ext_hint=e, is_stream_hint=s,
                )
                if item:
                    seen_urls.add(resp.url)
                    add_item(item)

            page.on("request", on_request)
            page.on("response", on_response)

            await on_status("Launching browser...")
            await on_status(f"Navigating to {urlparse(url).netloc}...")
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=25000)
            except Exception as e:
                await on_status(f"Navigation warning: {e}")

            # ── Ordered mode (Imagechest etc.): walk gallery images in DOM order,
            # preserve duplicates, emit in sequence. Skips the normal network/DOM
            # merge + filter pipeline.
            if ordered:
                await on_status("Ordered mode: loading full album...")

                # 1) Click "show more" / "load more" / "view all" buttons until
                # nothing matches anymore. Up to 10 rounds. Guarded regex avoids
                # clicking "Learn more" / "Read more" and navigating away.
                if album_only:
                    for round_i in range(10):
                        try:
                            clicked = await page.evaluate("""() => {
                                const re = /\\b(show|load|view|see|expand)\\s+(more|all|full|\\d+)/i;
                                const exact = /^(more)\\s*(\\(\\d+\\))?$/i;
                                const candidates = [...document.querySelectorAll('button, a, [role="button"], [role="link"]')];
                                const buttons = candidates.filter(el => {
                                    if (!el.offsetParent && el.getClientRects().length === 0) return false;
                                    const t = (el.textContent || '').trim();
                                    if (!t || t.length > 60) return false;
                                    return re.test(t) || exact.test(t);
                                });
                                buttons.forEach(b => { try { b.click(); } catch {} });
                                return buttons.length;
                            }""")
                        except Exception:
                            break
                        if not clicked:
                            break
                        await on_status(f"Clicked 'show more' ({round_i + 1})...")
                        await asyncio.sleep(0.8)

                # 2) Light scroll to materialize anything lazy-loaded after expand.
                for _ in range(min(8, max_scrolls)):
                    try:
                        await page.evaluate("window.scrollBy(0, window.innerHeight)")
                    except Exception:
                        break
                    await asyncio.sleep(max(0.4, scroll_delay / 2))

                # 3) Scope image extraction to the gallery container so we don't
                # pull in sidebar / "related posts" thumbnails. Tries imagechest
                # selectors first, then common gallery containers. Falls back to
                # <body> only when album_only is OFF.
                ordered_urls: list[dict] = await page.evaluate("""(albumOnly) => {
                    const pickBest = (img) => {
                        const candidates = [];
                        const srcset = img.getAttribute('srcset');
                        if (srcset) {
                            for (const part of srcset.split(',')) {
                                const bits = part.trim().split(/\\s+/);
                                if (bits[0]) {
                                    const w = bits[1] ? parseInt(bits[1]) : 0;
                                    candidates.push({ url: bits[0], w });
                                }
                            }
                        }
                        for (const attr of ['data-src', 'data-original', 'data-lazy', 'src']) {
                            const v = img.getAttribute(attr);
                            if (v) candidates.push({ url: v, w: 0 });
                        }
                        if (candidates.length === 0) return null;
                        candidates.sort((a, b) => b.w - a.w);
                        return candidates[0].url;
                    };

                    // Priority list: imagechest-likely containers first, then
                    // common gallery wrappers, then the generic main content
                    // areas. A container only counts if it has at least 2 imgs.
                    const SELECTORS = [
                        '.post-images', '.images-container', '.post-container .images',
                        'article .gallery', 'article .images',
                        'main .gallery', 'main .images',
                        '[data-testid=\"post-images\"]',
                        'main[role=\"main\"]', 'main', 'article',
                        '#content', '.gallery', '.images'
                    ];
                    let root = null;
                    for (const s of SELECTORS) {
                        for (const el of document.querySelectorAll(s)) {
                            if (el.querySelectorAll('img').length >= 2) { root = el; break; }
                        }
                        if (root) break;
                    }
                    if (!root) {
                        if (albumOnly) {
                            // Container not found AND user asked for strict mode.
                            // Return empty so the caller can show a clear message.
                            return { found_container: false, items: [] };
                        }
                        root = document.body;
                    }

                    const out = [];
                    for (const el of root.querySelectorAll('img')) {
                        const u = pickBest(el);
                        if (!u) continue;
                        const w = el.naturalWidth || 0;
                        const h = el.naturalHeight || 0;
                        // Skip obvious UI icons (avatars, badges).
                        if (w > 0 && w < 80 && h > 0 && h < 80) continue;
                        out.push({ url: u, w, h });
                    }
                    return { found_container: true, items: out };
                }""", album_only)

                if album_only and not ordered_urls.get("found_container"):
                    await on_status("No album container found — toggle 'Album only' OFF to scan the whole page.")

                try:
                    ctx_out.cookies = await ctx.cookies()
                except Exception:
                    ctx_out.cookies = []
                await browser.close()

                for idx, entry in enumerate(ordered_urls.get("items", [])):
                    absurl = urljoin(url, entry["url"])
                    if not absurl.startswith("http"):
                        continue
                    item = _make_item(absurl, "ordered", entry.get("w", 0), entry.get("h", 0))
                    if not item or item.type != "image":
                        item = MediaItem(
                            url=absurl, type="image", ext=_ext(absurl) or ".jpg",
                            source="ordered", is_stream=False,
                            width=entry.get("w", 0), height=entry.get("h", 0),
                        )
                    item.index = idx
                    if allowed and item.ext.lstrip(".") not in allowed:
                        continue
                    await on_found(item)

                return ctx_out

            # Auto-scroll
            last_h = 0
            same = 0
            for i in range(max_scrolls):
                await on_status(f"Scrolling page ({i + 1}/{max_scrolls})...")
                try:
                    await page.evaluate("window.scrollBy(0, 900)")
                except Exception:
                    break
                await asyncio.sleep(scroll_delay)
                try:
                    h = await page.evaluate("document.body.scrollHeight")
                except Exception:
                    break
                if h == last_h:
                    same += 1
                    if same >= 3:
                        break
                else:
                    same = 0
                last_h = h

            await on_status("Extracting media from page...")

            # Single JS pass: all images (src/data-src/data-lazy/srcset) + picture sources.
            img_data: list[dict] = await page.evaluate("""() => {
                const out = [];
                for (const el of document.querySelectorAll('img')) {
                    const urls = [];
                    for (const attr of ['src', 'data-src', 'data-lazy', 'data-original']) {
                        const v = el.getAttribute(attr);
                        if (v) urls.push({ url: v, source: 'img.' + attr });
                    }
                    const ss = el.getAttribute('srcset');
                    if (ss) {
                        for (const part of ss.split(',')) {
                            const u = part.trim().split(/\\s+/)[0];
                            if (u) urls.push({ url: u, source: 'srcset' });
                        }
                    }
                    for (const u of urls) {
                        out.push({
                            url: u.url, source: u.source,
                            width: el.naturalWidth || el.width || 0,
                            height: el.naturalHeight || el.height || 0,
                        });
                    }
                }
                for (const el of document.querySelectorAll('picture source[srcset]')) {
                    const ss = el.getAttribute('srcset');
                    if (ss) {
                        for (const part of ss.split(',')) {
                            const u = part.trim().split(/\\s+/)[0];
                            if (u) out.push({ url: u, source: 'srcset', width: 0, height: 0 });
                        }
                    }
                }
                return out;
            }""")

            base = url
            for entry in img_data:
                absurl = urljoin(base, entry["url"])
                item = _make_item(absurl, entry["source"],
                                  entry.get("width", 0), entry.get("height", 0))
                if item:
                    add_item(item)

            # Videos — pair posters with their source URLs
            for el in await page.query_selector_all("video"):
                src = await el.get_attribute("src")
                poster = await el.get_attribute("poster")
                poster_abs = urljoin(base, poster) if poster else ""
                if poster_abs:
                    p_item = _make_item(poster_abs, "video.poster")
                    if p_item:
                        add_item(p_item)
                if src:
                    v = _make_item(urljoin(base, src), "video.src")
                    if v:
                        v.poster = poster_abs
                        add_item(v)
                for source_el in await el.query_selector_all("source"):
                    sv = await source_el.get_attribute("src")
                    if sv:
                        vs = _make_item(urljoin(base, sv), "video.source")
                        if vs:
                            vs.poster = poster_abs
                            add_item(vs)

            # CSS background-image
            try:
                bg_urls: list[str] = await page.evaluate("""() => {
                    const urls = [];
                    for (const el of document.querySelectorAll('*')) {
                        try {
                            const bg = getComputedStyle(el).backgroundImage;
                            if (bg && bg !== 'none') {
                                const m = bg.match(/url\\(["']?([^"')]+)["']?\\)/);
                                if (m) urls.push(m[1]);
                            }
                        } catch {}
                    }
                    return urls;
                }""")
            except Exception:
                bg_urls = []
            for u in bg_urls:
                item = _make_item(urljoin(base, u), "css.bg")
                if item:
                    add_item(item)

            # Meta og:image / twitter:image
            for sel in ('meta[property="og:image"]', 'meta[name="twitter:image"]'):
                for el in await page.query_selector_all(sel):
                    val = await el.get_attribute("content")
                    if val:
                        item = _make_item(urljoin(base, val), "meta")
                        if item:
                            add_item(item)

            # a[href] pointing to media
            for el in await page.query_selector_all("a[href]"):
                val = await el.get_attribute("href")
                if val and _ext(val):
                    item = _make_item(urljoin(base, val), "a.href")
                    if item:
                        add_item(item)

            # Capture cookies BEFORE closing so the downloader can reuse them
            try:
                ctx_out.cookies = await ctx.cookies()
            except Exception:
                ctx_out.cookies = []

            await browser.close()

        # Filter and emit
        for item in items_by_url.values():
            if not item.url.startswith("http"):
                continue
            if not inc_images and item.type == "image":
                continue
            if not inc_videos and item.type == "video":
                continue
            if allowed and item.ext.lstrip(".") not in allowed:
                continue
            if item.type == "image" and item.width and item.height:
                if item.width < min_w or item.height < min_h:
                    continue
            await on_found(item)

        return ctx_out
