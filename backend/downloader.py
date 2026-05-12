import asyncio
import hashlib
import os
import random
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Awaitable
from urllib.parse import urlparse, unquote

import aiohttp


CHUNK_SIZE = 64 * 1024
MAX_RETRIES = 3
RETRY_BACKOFF_BASE = 1.0  # seconds

# Content-Type prefixes that clearly indicate a non-media response. We'll reject
# them when we were expecting a media download (usually an anti-bot page).
NONMEDIA_CT_PREFIXES = ("text/html", "text/plain", "application/json", "application/xml")


@dataclass
class DownloadResult:
    url: str
    file_path: str
    file_size: int
    is_new: bool
    is_stream: bool
    elapsed: float = 0.0
    attempts: int = 1
    engine: str = "http"  # "http" | "ytdlp"
    error: str | None = None


def _playwright_cookies_to_netscape_file(cookies: list[dict]) -> str:
    """Write Playwright-format cookies to a Netscape cookies.txt file for yt-dlp."""
    if not cookies:
        return ""
    fd, path = tempfile.mkstemp(prefix="mh_cookies_", suffix=".txt")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write("# Netscape HTTP Cookie File\n")
        for c in cookies:
            domain = c.get("domain", "")
            if not domain:
                continue
            include_subdomains = "TRUE" if domain.startswith(".") else "FALSE"
            path_v = c.get("path", "/") or "/"
            secure = "TRUE" if c.get("secure") else "FALSE"
            # Playwright expires is a float seconds-since-epoch, -1 for session cookies
            exp = c.get("expires", -1)
            expiry = int(exp) if exp and exp > 0 else 0
            name = c.get("name", "")
            value = c.get("value", "")
            if not name:
                continue
            f.write(f"{domain}\t{include_subdomains}\t{path_v}\t{secure}\t{expiry}\t{name}\t{value}\n")
    return path


def _playwright_cookies_to_header(cookies: list[dict], url: str) -> str:
    """Build a Cookie header for a given URL from Playwright cookies."""
    if not cookies:
        return ""
    target_host = urlparse(url).hostname or ""
    target_scheme_secure = urlparse(url).scheme == "https"
    pairs = []
    for c in cookies:
        domain = (c.get("domain") or "").lstrip(".")
        if not domain:
            continue
        if not (target_host == domain or target_host.endswith("." + domain)):
            continue
        if c.get("secure") and not target_scheme_secure:
            continue
        pairs.append(f"{c['name']}={c['value']}")
    return "; ".join(pairs)


class Downloader:
    def __init__(
        self,
        output_dir: str,
        images_subfolder: str = "images",
        videos_subfolder: str = "videos",
        per_site_folder: bool = True,
        site_name: str = "",
        concurrent: int = 5,
        referer: str = "",
        user_agent: str = "",
        cookies: list[dict] | None = None,
    ):
        base = Path(output_dir).expanduser()
        root = base / site_name if per_site_folder and site_name else base
        self.img_dir = root / images_subfolder
        self.vid_dir = root / videos_subfolder
        self.semaphore = asyncio.Semaphore(concurrent)
        self.referer = referer
        self.user_agent = user_agent or (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        )
        self.cookies = cookies or []
        self._cookiefile: str | None = None  # lazy Netscape cookie file for yt-dlp
        self.img_dir.mkdir(parents=True, exist_ok=True)
        self.vid_dir.mkdir(parents=True, exist_ok=True)

    # ── helpers ───────────────────────────────────────────────────────────

    def _folder(self, item_type: str) -> Path:
        return self.img_dir if item_type == "image" else self.vid_dir

    def _filename(self, url: str, content_type: str = "") -> str:
        name = unquote(urlparse(url).path.split("/")[-1])[:80]
        name = name.split("?")[0]
        if not name or "." not in name:
            ext = {
                "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp",
                "image/gif": ".gif", "image/avif": ".avif",
                "video/mp4": ".mp4", "video/webm": ".webm",
            }.get(content_type.split(";")[0].strip().lower(), ".bin")
            name = f"file{ext}"
        name = "".join(c if c.isalnum() or c in "-._" else "_" for c in name)
        return name or "file.bin"

    def _request_headers(self, url: str) -> dict:
        headers = {
            "User-Agent": self.user_agent,
            "Accept": "image/avif,image/webp,image/apng,image/*,video/*,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
        }
        if self.referer:
            headers["Referer"] = self.referer
        else:
            parsed = urlparse(url)
            if parsed.scheme and parsed.netloc:
                headers["Referer"] = f"{parsed.scheme}://{parsed.netloc}/"
        cookie_header = _playwright_cookies_to_header(self.cookies, url)
        if cookie_header:
            headers["Cookie"] = cookie_header
        return headers

    def _get_cookiefile(self) -> str:
        if self._cookiefile is None:
            self._cookiefile = _playwright_cookies_to_netscape_file(self.cookies)
        return self._cookiefile

    def cleanup(self):
        if self._cookiefile and os.path.exists(self._cookiefile):
            try:
                os.unlink(self._cookiefile)
            except OSError:
                pass

    # ── HTTP download with retry ──────────────────────────────────────────

    async def _http_download(
        self,
        url: str,
        expected_type: str,
        folder: Path,
        session: aiohttp.ClientSession,
    ) -> DownloadResult:
        """Download via aiohttp with retry and Content-Type validation."""
        last_err = "unknown"
        start = time.monotonic()

        for attempt in range(1, MAX_RETRIES + 1):
            tmp_path: Path | None = None
            try:
                async with session.get(
                    url,
                    timeout=aiohttp.ClientTimeout(total=180, sock_read=45, sock_connect=15),
                    headers=self._request_headers(url),
                    allow_redirects=True,
                ) as resp:
                    if resp.status in (429, 500, 502, 503, 504):
                        last_err = f"HTTP {resp.status}"
                        # Retryable
                    elif resp.status == 403:
                        last_err = "HTTP 403 Forbidden"
                        # Retryable: some CDNs fail first call, succeed on second
                    elif resp.status != 200 and resp.status != 206:
                        return DownloadResult(
                            url, "", 0, False, False,
                            elapsed=time.monotonic() - start, attempts=attempt,
                            error=f"HTTP {resp.status}",
                        )
                    else:
                        ct = resp.headers.get("Content-Type", "").lower()
                        # Content-Type sanity check: reject HTML/JSON when we expect media.
                        # Many CDNs return 200 with an error page instead of a 403.
                        if any(ct.startswith(p) for p in NONMEDIA_CT_PREFIXES):
                            last_err = f"Wrong Content-Type: {ct.split(';')[0]}"
                        else:
                            # Stream to tmp file while hashing
                            md5 = hashlib.md5()
                            total_size = 0
                            fd, tmp_name = tempfile.mkstemp(prefix=".dl_", dir=str(folder))
                            tmp_path = Path(tmp_name)
                            try:
                                with os.fdopen(fd, "wb") as f:
                                    async for chunk in resp.content.iter_chunked(CHUNK_SIZE):
                                        f.write(chunk)
                                        md5.update(chunk)
                                        total_size += len(chunk)
                            except Exception:
                                tmp_path.unlink(missing_ok=True)
                                raise

                            if total_size == 0:
                                tmp_path.unlink(missing_ok=True)
                                last_err = "Empty response body"
                            else:
                                digest = md5.hexdigest()
                                name = f"{digest[:8]}_{self._filename(url, ct)}"
                                final_path = folder / name
                                if final_path.exists():
                                    tmp_path.unlink(missing_ok=True)
                                    return DownloadResult(
                                        url, str(final_path), final_path.stat().st_size,
                                        False, False,
                                        elapsed=time.monotonic() - start,
                                        attempts=attempt, engine="http",
                                    )
                                os.replace(tmp_path, final_path)
                                return DownloadResult(
                                    url, str(final_path), total_size, True, False,
                                    elapsed=time.monotonic() - start,
                                    attempts=attempt, engine="http",
                                )
            except asyncio.TimeoutError:
                last_err = "timeout"
            except aiohttp.ClientError as e:
                last_err = f"{type(e).__name__}: {e}"
            except Exception as e:
                last_err = str(e)
            finally:
                if tmp_path is not None and tmp_path.exists():
                    tmp_path.unlink(missing_ok=True)

            if attempt < MAX_RETRIES:
                # Exponential backoff + jitter
                delay = RETRY_BACKOFF_BASE * (2 ** (attempt - 1)) + random.uniform(0, 0.5)
                await asyncio.sleep(delay)

        return DownloadResult(
            url, "", 0, False, False,
            elapsed=time.monotonic() - start,
            attempts=MAX_RETRIES, engine="http", error=last_err,
        )

    # ── yt-dlp download ───────────────────────────────────────────────────

    def _ytdlp_download_sync(self, url: str, folder: Path) -> dict:
        """Run yt-dlp synchronously (called from a worker thread)."""
        from yt_dlp import YoutubeDL

        outtmpl = str(folder / "%(id)s_%(title).80s.%(ext)s")
        opts = {
            "outtmpl": outtmpl,
            "quiet": True,
            "no_warnings": True,
            "noprogress": True,
            "retries": 3,
            "fragment_retries": 10,
            "concurrent_fragment_downloads": 4,
            "http_headers": {
                "User-Agent": self.user_agent,
                **({"Referer": self.referer} if self.referer else {}),
            },
            "format": "bestvideo*+bestaudio/best",
            "merge_output_format": "mp4",
            "restrictfilenames": True,
            "overwrites": False,
            "continuedl": True,
        }
        cookiefile = self._get_cookiefile()
        if cookiefile:
            opts["cookiefile"] = cookiefile

        with YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)
            # info may be single or have 'entries' (playlist). We expect single.
            if info is None:
                raise RuntimeError("yt-dlp returned no info")
            # requested_downloads is populated after download
            reqs = info.get("requested_downloads") or []
            filepath = reqs[0].get("filepath") if reqs else ydl.prepare_filename(info)
            return {"filepath": filepath, "info": info}

    async def _ytdlp_download(self, url: str, folder: Path) -> DownloadResult:
        start = time.monotonic()
        try:
            result = await asyncio.to_thread(self._ytdlp_download_sync, url, folder)
            filepath = result["filepath"]
            if not filepath or not os.path.exists(filepath):
                return DownloadResult(
                    url, "", 0, False, True,
                    elapsed=time.monotonic() - start,
                    engine="ytdlp", error="yt-dlp reported no file",
                )
            size = os.path.getsize(filepath)
            return DownloadResult(
                url, filepath, size, True, True,
                elapsed=time.monotonic() - start,
                engine="ytdlp",
            )
        except Exception as e:
            # Keep the error message short — yt-dlp errors can be verbose
            msg = str(e).splitlines()[-1][:200] if str(e) else "yt-dlp failed"
            return DownloadResult(
                url, "", 0, False, True,
                elapsed=time.monotonic() - start,
                engine="ytdlp", error=f"yt-dlp: {msg}",
            )

    # ── orchestration ─────────────────────────────────────────────────────

    async def download_one(
        self,
        url: str,
        item_type: str,
        is_stream: bool,
        session: aiohttp.ClientSession,
    ) -> DownloadResult:
        async with self.semaphore:
            folder = self._folder(item_type)

            # Streams (m3u8/mpd) → always use yt-dlp; it handles manifest parsing,
            # segment reassembly, retries on individual fragments.
            if is_stream:
                return await self._ytdlp_download(url, folder)

            # Regular HTTP download
            result = await self._http_download(url, item_type, folder, session)

            # Videos only: if HTTP failed, fall back to yt-dlp. Images that fail
            # via HTTP aren't going to work with yt-dlp either.
            if result.error and item_type == "video":
                yt_result = await self._ytdlp_download(url, folder)
                if not yt_result.error:
                    yt_result.attempts = result.attempts + yt_result.attempts
                    return yt_result
                # yt-dlp also failed — return the richer error combining both
                return DownloadResult(
                    url, "", 0, False, False,
                    elapsed=result.elapsed + yt_result.elapsed,
                    attempts=result.attempts + yt_result.attempts,
                    engine="ytdlp",
                    error=f"http: {result.error} | {yt_result.error}",
                )

            return result

    async def download_batch(
        self,
        items: list[dict],  # [{"url", "type", "is_stream"}, ...]
        on_progress: Callable[[int, int, DownloadResult], Awaitable[None]] | None = None,
    ) -> list[DownloadResult]:
        total = len(items)
        done = 0
        results = []

        try:
            async with aiohttp.ClientSession() as session:
                tasks = [
                    self.download_one(i["url"], i["type"], i.get("is_stream", False), session)
                    for i in items
                ]
                for coro in asyncio.as_completed(tasks):
                    result = await coro
                    done += 1
                    results.append(result)
                    if on_progress:
                        await on_progress(done, total, result)
        finally:
            self.cleanup()

        return results
