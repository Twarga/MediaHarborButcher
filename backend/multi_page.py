import asyncio
import os
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
from playwright.async_api import async_playwright, Playwright
from network_intercept import MediaType
from dom_extractor import DOMExtractor
from downloader import Downloader


class MultiPageHarvester:
    def __init__(
        self,
        max_pages: int = 3,
        delay: float = 2.0,
        output_dir: str = "downloads"
    ):
        self.max_pages = max_pages
        self.delay = delay
        self.output_dir = output_dir
        self.playwright = None
        self.browser = None
        self.context = None
        self.page = None
    
    async def __aenter__(self):
        self.playwright = await async_playwright().start()
        from playwright_stealth import Stealth
        self.browser = await self.playwright.chromium.launch(
            headless=True,
            args=['--disable-blink-features=AutomationControlled', '--no-sandbox']
        )
        self.context = await self.browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        )
        stealth = Stealth()
        await stealth.apply_stealth_async(self.context)
        self.page = await self.context.new_page()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.page:
            await self.page.close()
        if self.context:
            await self.context.close()
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()
    
    async def harvest(self, url: str) -> dict:
        results = {
            "url": url,
            "pages_harvested": 0,
            "total_images": 0,
            "new_files": 0,
            "total_size": 0,
            "errors": []
        }
        
        all_image_urls = set()
        
        for page_num in range(1, self.max_pages + 1):
            try:
                page_url = self._make_page_url(url, page_num)
                print(f"Page {page_num}: {page_url[:60]}...")
                
                await self.page.goto(page_url, wait_until="domcontentloaded", timeout=25000)
                await asyncio.sleep(self.delay)
                
                html = await self.page.content()
                
                images = self._extract_images_from_html(html, page_url)
                all_image_urls.update(images)
                
                results["pages_harvested"] += 1
                
            except Exception as e:
                results["errors"].append(f"Page {page_num}: {str(e)}")
                break
        
        if all_image_urls:
            print(f"Downloading {len(all_image_urls)} images...")
            
            async with Downloader(output_dir=self.output_dir) as downloader:
                dl_results = await downloader.download_batch(list(all_image_urls)[:100])
            
            results["new_files"] = sum(1 for r in dl_results if r.is_new)
            results["total_size"] = sum(r.file_size for r in dl_results)
            results["total_images"] = len(all_image_urls)
        
        return results
    
    def _extract_images_from_html(self, html: str, base_url: str) -> set:
        import re
        from urllib.parse import urljoin
        
        images = set()
        
        img_pattern = re.compile(r'<img[^>]+src=["\']([^"\']+)["\']', re.IGNORECASE)
        for match in img_pattern.finditer(html):
            src = match.group(1)
            if src and not src.startswith('data:'):
                images.add(urljoin(base_url, src))
        
        srcset_pattern = re.compile(r'srcset=["\']([^"\']+)["\']', re.IGNORECASE)
        for match in srcset_pattern.finditer(html):
            srcset = match.group(1)
            for src in srcset.split(','):
                src = src.strip().split()[0]
                if src:
                    images.add(urljoin(base_url, src))
        
        data_src_pattern = re.compile(r'data-src=["\']([^"\']+)["\']', re.IGNORECASE)
        for match in data_src_pattern.finditer(html):
            src = match.group(1)
            if src and src.startswith('http'):
                images.add(src)
        
        og_pattern = re.compile(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']', re.IGNORECASE)
        for match in og_pattern.finditer(html):
            src = match.group(1)
            if src:
                images.add(src)
        
        return {u for u in images if u.startswith('http')}
    
    def _make_page_url(self, base: str, page: int) -> str:
        if page == 1:
            return base
        
        parsed = urlparse(base)
        query = parse_qs(parsed.query)
        
        if 'page' in query:
            query['page'][0] = str(page)
        elif 'p' in query:
            query['p'][0] = str(page)
        else:
            query['page'] = [str(page)]
        
        new_query = urlencode(query, doseq=True)
        return urlunparse((
            parsed.scheme, parsed.netloc, parsed.path,
            parsed.params, new_query, parsed.fragment
        ))


async def test():
    async with MultiPageHarvester(max_pages=2, delay=1, output_dir="/tmp/mp_test") as h:
        r = await h.harvest("https://unsplash.com")
        print(f"Pages: {r['pages_harvested']}, Images: {r['total_images']}, Files: {r['new_files']}")
        print(f"Size: {r['total_size']}")


if __name__ == "__main__":
    asyncio.run(test())