import asyncio
import hashlib
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Awaitable
from urllib.parse import urlparse, unquote

import aiohttp


@dataclass
class DownloadResult:
    url: str
    file_path: str
    file_size: int
    is_new: bool
    is_stream: bool
    error: str | None = None


class Downloader:
    def __init__(
        self,
        output_dir: str,
        images_subfolder: str = "images",
        videos_subfolder: str = "videos",
        per_site_folder: bool = True,
        site_name: str = "",
        concurrent: int = 5,
    ):
        base = Path(output_dir)
        root = base / site_name if per_site_folder and site_name else base
        self.img_dir = root / images_subfolder
        self.vid_dir = root / videos_subfolder
        self.semaphore = asyncio.Semaphore(concurrent)
        self.img_dir.mkdir(parents=True, exist_ok=True)
        self.vid_dir.mkdir(parents=True, exist_ok=True)

    def _folder(self, item_type: str) -> Path:
        return self.img_dir if item_type == "image" else self.vid_dir

    def _filename(self, url: str, content_type: str = "") -> str:
        name = unquote(urlparse(url).path.split("/")[-1])[:80]
        if not name or "." not in name:
            ext = {"image/jpeg": ".jpg", "image/png": ".png",
                   "image/webp": ".webp", "video/mp4": ".mp4",
                   "video/webm": ".webm"}.get(content_type.split(";")[0].strip(), ".bin")
            name = f"file{ext}"
        return name

    async def download_one(
        self,
        url: str,
        item_type: str,
        is_stream: bool,
        session: aiohttp.ClientSession,
    ) -> DownloadResult:
        async with self.semaphore:
            folder = self._folder(item_type)

            if is_stream:
                return await self._download_stream(url, folder)

            try:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=30)) as resp:
                    if resp.status != 200:
                        return DownloadResult(url, "", 0, False, False, f"HTTP {resp.status}")
                    content = await resp.read()
                    ct = resp.headers.get("Content-Type", "")

                md5 = hashlib.md5(content).hexdigest()
                name = f"{md5[:8]}_{self._filename(url, ct)}"
                path = folder / name

                if path.exists():
                    return DownloadResult(url, str(path), len(content), False, False)

                path.write_bytes(content)
                return DownloadResult(url, str(path), len(content), True, False)

            except Exception as e:
                return DownloadResult(url, "", 0, False, False, str(e))

    async def _download_stream(self, url: str, folder: Path) -> DownloadResult:
        import hashlib, time
        name = f"{hashlib.md5(url.encode()).hexdigest()[:8]}_stream.mp4"
        path = folder / name
        if path.exists():
            return DownloadResult(url, str(path), path.stat().st_size, False, True)
        try:
            proc = await asyncio.create_subprocess_exec(
                "ffmpeg", "-i", url, "-c", "copy", "-y", str(path),
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL,
            )
            await asyncio.wait_for(proc.wait(), timeout=120)
            size = path.stat().st_size if path.exists() else 0
            return DownloadResult(url, str(path), size, True, True)
        except Exception as e:
            return DownloadResult(url, "", 0, False, True, str(e))

    async def download_batch(
        self,
        items: list[dict],  # [{"url", "type", "is_stream"}, ...]
        on_progress: Callable[[int, int, DownloadResult], Awaitable[None]] | None = None,
    ) -> list[DownloadResult]:
        total = len(items)
        done = 0
        results = []

        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        async with aiohttp.ClientSession(headers=headers) as session:
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

        return results
