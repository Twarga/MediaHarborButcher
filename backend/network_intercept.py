import asyncio
import re
from dataclasses import dataclass, field
from typing import Optional, Callable
from enum import Enum


class MediaType(Enum):
    IMAGE = "image"
    VIDEO = "video"
    OTHER = "other"


@dataclass
class MediaRequest:
    url: str
    media_type: MediaType
    status: int
    response_headers: dict = field(default_factory=dict)
    post_data: Optional[str] = None
    

class NetworkInterceptor:
    IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico', '.bmp', '.avif', '.heic', '.heif'}
    VIDEO_EXTENSIONS = {'.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v', '.flv', '.wmv'}
    STREAM_EXTENSIONS = {'.m3u8', '.mpd'}
    
    def __init__(self):
        self.media_requests: list[MediaRequest] = []
        self._intercepted_urls: set[str] = set()
    
    def detect_media_type(self, url: str) -> MediaType:
        url_lower = url.lower()
        
        if any(url_lower.endswith(ext) for ext in self.VIDEO_EXTENSIONS):
            return MediaType.VIDEO
        
        if any(url_lower.endswith(ext) for ext in self.STREAM_EXTENSIONS):
            return MediaType.VIDEO
        
        if any(url_lower.endswith(ext) for ext in self.IMAGE_EXTENSIONS):
            return MediaType.IMAGE
        
        if '.jpg' in url_lower or '.jpeg' in url_lower or '.png' in url_lower or '.gif' in url_lower or '.webp' in url_lower:
            return MediaType.IMAGE
        
        if 'image' in url_lower and ('/' in url_lower or '?' in url_lower):
            return MediaType.IMAGE
        
        if 'video' in url_lower or 'video' in url_lower:
            return MediaType.VIDEO
        
        if 'blob:' in url_lower or 'data:' in url_lower:
            return MediaType.VIDEO
        
        return MediaType.OTHER
    
    async def handle_request(self, request):
        url = request.url
        
        if url in self._intercepted_urls:
            return
        self._intercepted_urls.add(url)
        
        media_type = self.detect_media_type(url)
        
        if media_type != MediaType.OTHER:
            media_req = MediaRequest(
                url=url,
                media_type=media_type,
                status=0,
            )
            self.media_requests.append(media_req)
    
    async def handle_response(self, response):
        url = response.url
        
        for req in self.media_requests:
            if req.url == url:
                req.status = response.status
                req.response_headers = dict(response.headers) if response.headers else {}
                break


async def test_network_interception():
    from playwright_client import PlaywrightClient
    
    async with PlaywrightClient(headless=True, stealth=True) as client:
        interceptor = NetworkInterceptor()
        
        page = client.page
        
        page.on("request", interceptor.handle_request)
        page.on("response", interceptor.handle_response)
        
        print("Loading unsplash.com...")
        await page.goto("https://unsplash.com", wait_until="networkidle", timeout=30000)
        
        print(f"\nCaptured {len(interceptor.media_requests)} media requests:")
        
        images = [r for r in interceptor.media_requests if r.media_type == MediaType.IMAGE]
        videos = [r for r in interceptor.media_requests if r.media_type == MediaType.VIDEO]
        
        print(f"Images: {len(images)}")
        print(f"Videos: {len(videos)}")
        
        for req in interceptor.media_requests[:10]:
            print(f"  [{req.media_type.value}] {req.url[:80]}")
        
        if len(interceptor.media_requests) > 10:
            print(f"  ... and {len(interceptor.media_requests) - 10} more")


if __name__ == "__main__":
    asyncio.run(test_network_interception())