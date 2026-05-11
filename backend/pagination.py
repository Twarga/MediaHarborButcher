import re
from dataclasses import dataclass
from typing import Optional


@dataclass
class PaginationInfo:
    has_pagination: bool
    page_type: str  # url_pattern, next_button, infinite_scroll, none
    total_pages: Optional[int]
    current_page: int = 1
    next_url: Optional[str] = None


class PaginationDetector:
    URL_PATTERNS = [
        r'page[=/](\d+)',
        r'/page/(\d+)',
        r'/(\d+)\.html',
        r'\?p=(\d+)',
        r'offset=(\d+)',
    ]
    
    def __init__(self):
        self.base_url = ""
    
    async def detect(self, page, url: str) -> PaginationInfo:
        self.base_url = url
        
        page_type = "none"
        total_pages = None
        next_url = None
        
        if await self._check_infinite_scroll(page):
            page_type = "infinite_scroll"
        elif await self._check_next_button(page):
            page_type = "next_button"
        elif self._check_url_pattern(url):
            page_type = "url_pattern"
            total_pages = self._guess_total_pages(url)
        
        return PaginationInfo(
            has_pagination=page_type != "none",
            page_type=page_type,
            total_pages=total_pages,
            next_url=next_url
        )
    
    def _check_url_pattern(self, url: str) -> bool:
        for pattern in self.URL_PATTERNS:
            if re.search(pattern, url, re.IGNORECASE):
                return True
        return False
    
    def _guess_total_pages(self, url: str) -> int:
        match = re.search(r'page[=/](\d+)', url, re.IGNORECASE)
        if match:
            current = int(match.group(1))
            return current + 10
        return 10
    
    async def _check_next_button(self, page) -> bool:
        selectors = [
            'a:has-text("Next")',
            'a:has-text("next")',
            'button:has-text("Next")',
            'a[rel="next"]',
            '.next a',
            '.pagination-next',
        ]
        
        for selector in selectors[:3]:
            try:
                elem = await page.query_selector(selector)
                if elem:
                    return True
            except:
                pass
        return False
    
    async def _check_infinite_scroll(self, page) -> bool:
        try:
            has_more = await page.evaluate("""
                () => {
                    const scroll = document.querySelector('[data-infinite], .infinite-scroll, .infinite');
                    const observer = document.querySelectorAll('[data-scroll], [data-load-more]');
                    return scroll !== null || observer.length > 0;
                }
            """)
            return has_more
        except:
            return False


async def test_pagination():
    from playwright_client import PlaywrightClient
    
    async with PlaywrightClient(headless=True, stealth=True) as client:
        page = client.page
        
        urls = [
            "https://example.com",
            "https://unsplash.com",
            "https://www.pexels.com/search/nature/",
        ]
        
        for url in urls:
            print(f"\nTesting: {url}")
            await page.goto(url, wait_until="networkidle", timeout=15000)
            
            detector = PaginationDetector()
            info = await detector.detect(page, url)
            
            print(f"  Has pagination: {info.has_pagination}")
            print(f"  Type: {info.page_type}")
            print(f"  Total pages: {info.total_pages}")


if __name__ == "__main__":
    import asyncio
    asyncio.run(test_pagination())