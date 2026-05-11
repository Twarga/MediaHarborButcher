import os
import asyncio
import aiohttp
import hashlib
from pathlib import Path
from urllib.parse import urlparse, unquote
from dataclasses import dataclass
from typing import Optional


@dataclass
class DownloadResult:
    file_path: str
    file_size: int
    is_new: bool
    error: Optional[str] = None


class Downloader:
    def __init__(
        self,
        output_dir: str = "downloads",
        concurrent: int = 5,
        headers: dict = None
    ):
        self.output_dir = Path(output_dir)
        self.concurrent = concurrent
        self.semaphore = asyncio.Semaphore(concurrent)
        
        self.headers = headers or {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        self.session: Optional[aiohttp.ClientSession] = None
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession(
            headers=self.headers,
            timeout=aiohttp.ClientTimeout(total=30)
        )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    def _get_filename(self, url: str, content_type: str = "") -> str:
        parsed = urlparse(url)
        filename = unquote(parsed.path.split('/')[-1])
        
        if not filename or '.' not in filename:
            ext = self._get_extension(content_type)
            if not ext:
                ext = '.jpg'
            filename = f"file{ext}"
        
        filename = filename[:100]
        return filename
    
    def _get_extension(self, content_type: str) -> str:
        mapping = {
            'image/jpeg': '.jpg',
            'image/png': '.png',
            'image/gif': '.gif',
            'image/webp': '.webp',
            'video/mp4': '.mp4',
            'video/webm': '.webm',
        }
        return mapping.get(content_type, '')
    
    def _compute_hash(self, content: bytes) -> str:
        return hashlib.md5(content).hexdigest()
    
    async def download(self, url: str, subfolder: str = "") -> DownloadResult:
        async with self.semaphore:
            try:
                folder = self.output_dir / subfolder if subfolder else self.output_dir
                folder.mkdir(parents=True, exist_ok=True)
                
                async with self.session.get(url) as response:
                    if response.status != 200:
                        return DownloadResult(
                            file_path="",
                            file_size=0,
                            is_new=False,
                            error=f"HTTP {response.status}"
                        )
                    
                    content = await response.read()
                    content_type = response.headers.get('Content-Type', '')
                    
                    hash_key = self._compute_hash(content)
                    filename = f"{hash_key[:8]}_{self._get_filename(url, content_type)}"
                    file_path = folder / filename
                    
                    if file_path.exists():
                        return DownloadResult(
                            file_path=str(file_path),
                            file_size=len(content),
                            is_new=False
                        )
                    
                    file_path.write_bytes(content)
                    
                    return DownloadResult(
                        file_path=str(file_path),
                        file_size=len(content),
                        is_new=True
                    )
                    
            except Exception as e:
                return DownloadResult(
                    file_path="",
                    file_size=0,
                    is_new=False,
                    error=str(e)
                )
    
    async def download_batch(self, urls: list, subfolder: str = "") -> list[DownloadResult]:
        tasks = [self.download(url, subfolder) for url in urls]
        return await asyncio.gather(*tasks)


async def test_downloader():
    urls = [
        "https://example.com/image.jpg",
        "https://httpbin.org/image/jpeg",
    ]
    
    async with Downloader(output_dir="/tmp/mediaharbor_test") as downloader:
        results = await downloader.download_batch(urls, "images")
        
        for url, result in zip(urls, results):
            print(f"{url}")
            print(f"  Path: {result.file_path}")
            print(f"  Size: {result.file_size}")
            print(f"  New: {result.is_new}")
            print(f"  Error: {result.error}")


if __name__ == "__main__":
    asyncio.run(test_downloader())