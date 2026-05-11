import asyncio
import re
from dataclasses import dataclass, field
from typing import Optional
from urllib.parse import urljoin


@dataclass
class MediaElement:
    url: str
    source: str
    alt: Optional[str] = None


class DOMExtractor:
    def __init__(self, base_url: str = ""):
        self.base_url = base_url
        self.media_elements: list[MediaElement] = []
    
    def normalize_url(self, url: str) -> str:
        if not url:
            return ""
        url = url.strip()
        if not url:
            return ""
        if url.startswith('data:'):
            return ""
        if url.startswith('javascript:'):
            return ""
        if self.base_url and not url.startswith('http'):
            return urljoin(self.base_url, url)
        return url
    
    def is_valid_url(self, url: str) -> bool:
        if not url:
            return False
        if not url.startswith(('http://', 'https://')):
            return False
        return True
    
    async def extract_from_page(self, page):
        self.media_elements = []
        
        await self._extract_img_tags(page)
        await self._extract_srcset(page)
        await self._extract_picture_tags(page)
        await self._extract_css_backgrounds(page)
        await self._extract_meta_tags(page)
        await self._extract_video_tags(page)
        
        unique_urls = set()
        filtered = []
        for media in self.media_elements:
            if media.url and media.url not in unique_urls:
                unique_urls.add(media.url)
                filtered.append(media)
        
        self.media_elements = filtered
    
    async def _extract_img_tags(self, page):
        imgs = await page.query_selector_all('img')
        for img in imgs:
            src = await img.get_attribute('src')
            alt = await img.get_attribute('alt')
            
            if src:
                url = self.normalize_url(src)
                if self.is_valid_url(url):
                    self.media_elements.append(MediaElement(url=url, source='img.src', alt=alt))
            
            data_src = await img.get_attribute('data-src')
            if data_src:
                url = self.normalize_url(data_src)
                if self.is_valid_url(url):
                    self.media_elements.append(MediaElement(url=url, source='img.data-src', alt=alt))
            
            lazy = await img.get_attribute('data-lazy')
            if lazy:
                url = self.normalize_url(lazy)
                if self.is_valid_url(url):
                    self.media_elements.append(MediaElement(url=url, source='img.data-lazy', alt=alt))
    
    async def _extract_srcset(self, page):
        imgs = await page.query_selector_all('img[srcset]')
        for img in imgs:
            srcset = await img.get_attribute('srcset')
            if srcset:
                urls = self._parse_srcset(srcset)
                for url in urls:
                    if self.is_valid_url(url):
                        self.media_elements.append(MediaElement(url=url, source='img.srcset'))
    
    def _parse_srcset(self, srcset: str) -> list:
        urls = []
        parts = srcset.split(',')
        for part in parts:
            part = part.strip()
            if part:
                url = part.split()[0]
                url = self.normalize_url(url)
                if url:
                    urls.append(url)
        return urls
    
    async def _extract_picture_tags(self, page):
        sources = await page.query_selector_all('picture source')
        for source in sources:
            src = await source.get_attribute('srcset')
            if src:
                url = self.normalize_url(src)
                if self.is_valid_url(url):
                    self.media_elements.append(MediaElement(url=url, source='picture source'))
    
    async def _extract_css_backgrounds(self, page):
        css_selector = "*"
        
        bg = await page.evaluate(f"""() => {{
            const elements = document.querySelectorAll('{css_selector}');
            let urls = [];
            for (const elem of elements) {{
                try {{
                    const style = window.getComputedStyle(elem);
                    const bgImage = style.backgroundImage;
                    if (bgImage && bgImage !== 'none' && bgImage.includes('url')) {{
                        const match = bgImage.match(/url\\(["']([^"']+)["']\\)/);
                        if (match && match[1]) {{
                            urls.push(match[1]);
                        }}
                    }}
                }} catch (e) {{}}
            }}
            return urls;
        }}""")
        
        if bg:
            for url in bg:
                url = self.normalize_url(url)
                if self.is_valid_url(url):
                    self.media_elements.append(MediaElement(url=url, source='css.background'))
    
    def _extract_urls_from_css(self, css: str) -> list:
        urls = []
        pattern = r'url\(["\']?([^"\')]+)["\']?\)'
        matches = re.findall(pattern, css)
        for match in matches:
            url = self.normalize_url(match)
            if url:
                urls.append(url)
        return urls
    
    async def _extract_meta_tags(self, page):
        selectors = [
            'meta[property="og:image"]',
            'meta[name="twitter:image"]',
            'meta[property="og:image:url"]',
            'meta[property="og:video:thumbnail"]',
        ]
        
        for selector in selectors:
            metas = await page.query_selector_all(selector)
            for meta in metas:
                content = await meta.get_attribute('content')
                if content:
                    url = self.normalize_url(content)
                    if self.is_valid_url(url):
                        self.media_elements.append(MediaElement(url=url, source='meta'))
    
    async def _extract_video_tags(self, page):
        videos = await page.query_selector_all('video')
        for video in videos:
            poster = await video.get_attribute('poster')
            if poster:
                url = self.normalize_url(poster)
                if self.is_valid_url(url):
                    self.media_elements.append(MediaElement(url=url, source='video.poster'))
        
        sources = await page.query_selector_all('video source, video track')
        for source in sources:
            src = await source.get_attribute('src')
            if src:
                url = self.normalize_url(src)
                if self.is_valid_url(url):
                    self.media_elements.append(MediaElement(url=url, source='video.source'))


async def test_dom_extraction():
    from playwright_client import PlaywrightClient
    
    async with PlaywrightClient(headless=True, stealth=True) as client:
        page = client.page
        
        print("Loading unsplash.com...")
        await page.goto("https://unsplash.com", wait_until="networkidle", timeout=30000)
        
        extractor = DOMExtractor(base_url="https://unsplash.com")
        await extractor.extract_from_page(page)
        
        print(f"\nExtracted {len(extractor.media_elements)} media elements from DOM:")
        
        sources = {}
        for media in extractor.media_elements:
            sources[media.source] = sources.get(media.source, 0) + 1
        
        for source, count in sorted(sources.items(), key=lambda x: -x[1]):
            print(f"  {source}: {count}")
        
        print(f"\nFirst 5 URLs:")
        for media in extractor.media_elements[:5]:
            print(f"  [{media.source}] {media.url[:80]}")


if __name__ == "__main__":
    asyncio.run(test_dom_extraction())