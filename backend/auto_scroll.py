import asyncio
from dataclasses import dataclass
from typing import Optional, Callable


@dataclass
class ScrollResult:
    total_scrolls: int
    new_height: int
    final_height: int
    reached_bottom: bool


class AutoScroller:
    def __init__(
        self,
        scroll_delay: float = 1.0,
        max_scrolls: int = 50,
        scroll_amount: int = 800,
        progress_callback: Optional[Callable[[int, int], None]] = None
    ):
        self.scroll_delay = scroll_delay
        self.max_scrolls = max_scrolls
        self.scroll_amount = scroll_amount
        self.progress_callback = progress_callback
    
    async def scroll_page(self, page) -> ScrollResult:
        total_scrolls = 0
        last_height = 0
        final_height = 0
        same_count = 0
        
        while total_scrolls < self.max_scrolls:
            current_height = await page.evaluate("document.body.scrollHeight")
            
            if current_height == last_height and last_height > 0:
                same_count += 1
                if same_count >= 3:
                    break
            else:
                same_count = 0
            
            await page.evaluate(f"window.scrollBy(0, {self.scroll_amount})")
            await asyncio.sleep(self.scroll_delay)
            
            last_height = current_height
            total_scrolls += 1
            
            if self.progress_callback:
                self.progress_callback(total_scrolls, current_height)
        
        final_height = await page.evaluate("document.body.scrollHeight")
        
        return ScrollResult(
            total_scrolls=total_scrolls,
            new_height=current_height,
            final_height=final_height,
            reached_bottom=same_count >= 3
        )
    
    async def wait_for_infinite_scroll(
        self,
        page,
        load_more_selector: str = "button, .load-more, [data-load-more], .show-more",
        max_wait: int = 30
    ) -> bool:
        for _ in range(max_wait):
            await page.evaluate("window.scrollBy(0, 500)")
            await asyncio.sleep(0.5)
            
            button = await page.query_selector(load_more_selector)
            if button:
                await button.click()
                await asyncio.sleep(2)
            
            new_height = await page.evaluate("document.body.scrollHeight")
            if new_height > 0:
                continue
        
        return False


async def test_auto_scroll():
    from playwright_client import PlaywrightClient
    
    async with PlaywrightClient(headless=True, stealth=True) as client:
        page = client.page
        
        print("Loading unsplash.com...")
        await page.goto("https://unsplash.com", wait_until="networkidle", timeout=30000)
        
        scroller = AutoScroller(scroll_delay=0.5, max_scrolls=10)
        
        print("Auto-scrolling...")
        result = await scroller.scroll_page(page)
        
        print(f"\nScroll Results:")
        print(f"  Total scrolls: {result.total_scrolls}")
        print(f"  Final height: {result.final_height}")
        print(f"  Reached bottom: {result.reached_bottom}")


if __name__ == "__main__":
    asyncio.run(test_auto_scroll())