import asyncio
from typing import Optional
from playwright.async_api import async_playwright, Browser, Page, PlaywrightContextManager

class PlaywrightClient:
    def __init__(self, headless: bool = True, stealth: bool = True):
        self.headless = headless
        self.stealth = stealth
        self.playwright: Optional[PlaywrightContextManager] = None
        self.browser: Optional[Browser] = None
        self.page: Optional[Page] = None

    async def __aenter__(self):
        await self.start()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()

    async def start(self):
        self.playwright = await async_playwright().start()
        
        if self.stealth:
            from playwright_stealth import Stealth
            self.browser = await self.playwright.chromium.launch(
                headless=self.headless,
                args=[
                    '--disable-blink-features=AutomationControlled',
                    '--no-sandbox',
                ]
            )
            context = await self.browser.new_context(
                viewport={'width': 1920, 'height': 1080},
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            )
            self.page = await context.new_page()
            stealth = Stealth()
            await stealth.apply_stealth_async(self.page)
        else:
            self.browser = await self.playwright.chromium.launch(
                headless=self.headless
            )
            self.page = await self.browser.new_page()

    async def close(self):
        if self.page:
            await self.page.close()
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()

    async def navigate(self, url: str, wait_until: str = "networkidle"):
        if not self.page:
            raise RuntimeError("Browser not started. Use async with PlaywrightClient() as client:")
        
        await self.page.goto(url, wait_until=wait_until, timeout=30000)
        return await self.get_content()

    async def get_content(self) -> str:
        if not self.page:
            raise RuntimeError("Browser not started")
        return await self.page.content()

    async def get_title(self) -> str:
        if not self.page:
            raise RuntimeError("Browser not started")
        return await self.page.title()

    async def get_url(self) -> str:
        if not self.page:
            raise RuntimeError("Browser not started")
        return self.page.url


async def create_client(headless: bool = True, stealth: bool = True) -> PlaywrightClient:
    client = PlaywrightClient(headless=headless, stealth=stealth)
    await client.start()
    return client


async def test_playwright():
    async with PlaywrightClient(headless=True, stealth=True) as client:
        url = "https://example.com"
        print(f"Loading {url}...")
        
        content = await client.navigate(url)
        title = await client.get_title()
        current_url = await client.get_url()
        
        print(f"Title: {title}")
        print(f"URL: {current_url}")
        print(f"Content length: {len(content)} characters")
        print("Success!")


if __name__ == "__main__":
    asyncio.run(test_playwright())