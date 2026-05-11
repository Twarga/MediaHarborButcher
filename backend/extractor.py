import asyncio
from dataclasses import dataclass
from typing import Callable, Awaitable
from urllib.parse import urljoin, urlparse

from playwright.async_api import async_playwright
from playwright_stealth import Stealth


IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".bmp", ".svg"}
VIDEO_EXTS = {".mp4", ".webm", ".mov", ".m4v", ".avi", ".mkv"}
STREAM_EXTS = {".m3u8", ".mpd"}


@dataclass
class MediaItem:
    url: str
    type: str        # "image" | "video"
    ext: str
    source: str
    is_stream: bool = False


def _ext(url: str) -> str:
    path = urlparse(url).path.lower()
    for e in IMAGE_EXTS | VIDEO_EXTS | STREAM_EXTS:
        if path.endswith(e):
            return e
    return ""


def _classify(url: str) -> tuple[str, str, bool]:
    """Returns (type, ext, is_stream) or ('', '', False) if not media."""
    e = _ext(url)
    if e in IMAGE_EXTS:
        return "image", e, False
    if e in VIDEO_EXTS:
        return "video", e, False
    if e in STREAM_EXTS:
        return "video", e, True
    u = url.lower()
    if any(x in u for x in ("image/", "/images/", "photo", "img", "thumb")):
        return "image", ".jpg", False
    if any(x in u for x in ("video/", "/videos/", "stream")):
        return "video", ".mp4", False
    return "", "", False


def _make_item(url: str, source: str) -> MediaItem | None:
    t, e, s = _classify(url)
    if not t:
        return None
    return MediaItem(url=url, type=t, ext=e, source=source, is_stream=s)


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
    ):
        stealth = settings.get("stealth_mode", "true") == "true"
        max_scrolls = int(settings.get("max_scrolls", 15))
        scroll_delay = float(settings.get("scroll_delay", 1.0))
        min_w = int(settings.get("min_image_width", 100))
        min_h = int(settings.get("min_image_height", 100))
        inc_images = settings.get("include_images", "true") == "true"
        inc_videos = settings.get("include_videos", "true") == "true"
        allowed = [f.strip().lower().lstrip(".") for f in settings.get("allowed_formats", "").split(",") if f.strip()]

        seen: set[str] = set()
        network_items: list[MediaItem] = []

        async with async_playwright() as pw:
            browser = await pw.chromium.launch(
                headless=True,
                args=["--disable-blink-features=AutomationControlled", "--no-sandbox"],
            )
            ctx = await browser.new_context(
                viewport={"width": 1920, "height": 1080},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            )
            page = await ctx.new_page()

            if stealth:
                await Stealth().apply_stealth_async(page)

            # Register interception BEFORE navigation
            def on_request(req):
                item = _make_item(req.url, "network")
                if item and req.url not in seen:
                    seen.add(req.url)
                    network_items.append(item)

            page.on("request", on_request)

            await on_status("Launching browser...")
            await on_status(f"Navigating to {urlparse(url).netloc}...")
            await page.goto(url, wait_until="domcontentloaded", timeout=25000)

            # Auto-scroll
            last_h = 0
            same = 0
            for i in range(max_scrolls):
                await on_status(f"Scrolling page ({i + 1}/{max_scrolls})...")
                await page.evaluate("window.scrollBy(0, 900)")
                await asyncio.sleep(scroll_delay)
                h = await page.evaluate("document.body.scrollHeight")
                if h == last_h:
                    same += 1
                    if same >= 3:
                        break
                else:
                    same = 0
                last_h = h

            await on_status("Extracting media from page...")

            # DOM extraction
            dom_items: list[MediaItem] = []
            base = url

            # img src / data-src / data-lazy
            for attr in ("src", "data-src", "data-lazy", "data-original"):
                for el in await page.query_selector_all(f"img[{attr}]"):
                    val = await el.get_attribute(attr)
                    if val:
                        item = _make_item(urljoin(base, val), f"img.{attr}")
                        if item:
                            dom_items.append(item)

            # srcset
            for el in await page.query_selector_all("img[srcset], source[srcset]"):
                srcset = await el.get_attribute("srcset")
                if srcset:
                    for u in _parse_srcset(srcset, base):
                        item = _make_item(u, "srcset")
                        if item:
                            dom_items.append(item)

            # video src / poster
            for el in await page.query_selector_all("video"):
                for attr in ("src", "poster"):
                    val = await el.get_attribute(attr)
                    if val:
                        item = _make_item(urljoin(base, val), f"video.{attr}")
                        if item:
                            dom_items.append(item)

            for el in await page.query_selector_all("video source"):
                val = await el.get_attribute("src")
                if val:
                    item = _make_item(urljoin(base, val), "video.source")
                    if item:
                        dom_items.append(item)

            # CSS background-image
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
            for u in bg_urls:
                item = _make_item(urljoin(base, u), "css.bg")
                if item:
                    dom_items.append(item)

            # og:image / twitter:image
            for sel in ('meta[property="og:image"]', 'meta[name="twitter:image"]'):
                for el in await page.query_selector_all(sel):
                    val = await el.get_attribute("content")
                    if val:
                        item = _make_item(urljoin(base, val), "meta")
                        if item:
                            dom_items.append(item)

            # a[href] pointing to media
            for el in await page.query_selector_all("a[href]"):
                val = await el.get_attribute("href")
                if val and _ext(val):
                    item = _make_item(urljoin(base, val), "a.href")
                    if item:
                        dom_items.append(item)

            await browser.close()

        # Merge, dedupe, filter, emit
        all_items = network_items + dom_items
        emitted: set[str] = set()

        for item in all_items:
            if item.url in emitted:
                continue
            if not item.url.startswith("http"):
                continue
            if not inc_images and item.type == "image":
                continue
            if not inc_videos and item.type == "video":
                continue
            if allowed and item.ext.lstrip(".") not in allowed:
                continue
            emitted.add(item.url)
            await on_found(item)
