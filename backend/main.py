from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from contextlib import asynccontextmanager
import sys
import os
sys.path.insert(0, 'backend')

from playwright_client import PlaywrightClient
from network_intercept import NetworkInterceptor, MediaType
from dom_extractor import DOMExtractor
from auto_scroll import AutoScroller
from downloader import Downloader
from pagination import PaginationDetector
from database import Database

class HarvestRequest(BaseModel):
    url: str
    scroll: bool = True
    max_scrolls: int = 10
    download: bool = True
    output_dir: str = "downloads"

class MultiHarvestRequest(BaseModel):
    url: str
    max_pages: int = 3
    delay: float = 2.0
    output_dir: str = "downloads"

class AnalyzeRequest(BaseModel):
    url: str
    scroll: bool = True
    max_scrolls: int = 10

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("MediaHarbor backend starting...")
    yield
    print("MediaHarbor backend shutting down...")

app = FastAPI(
    title="MediaHarbor API",
    description="Media harvesting web application",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:*", "http://127.0.0.1:*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "MediaHarbor API", "version": "1.0.0"}

@app.get("/history")
async def get_history(limit: int = 20):
    db = Database("mediaharbor.db")
    try:
        history = db.get_history(limit)
        return {"history": history}
    finally:
        db.close()

@app.get("/settings")
async def get_settings():
    db = Database("mediaharbor.db")
    try:
        return {
            "output_dir": db.get_setting("output_dir", "/home/twarga/Downloads/MediaHarbor"),
            "max_pages": int(db.get_setting("max_pages", "5")),
        }
    finally:
        db.close()

@app.post("/settings")
async def save_settings(output_dir: str = "/home/twarga/Downloads/MediaHarbor", max_pages: int = 5):
    db = Database("mediaharbor.db")
    try:
        db.set_setting("output_dir", output_dir)
        db.set_setting("max_pages", str(max_pages))
        return {"status": "saved"}
    finally:
        db.close()

@app.get("/health")
async def health():
    return {"status": "healthy"}

@app.post("/analyze")
async def analyze(request: AnalyzeRequest):
    try:
        async with PlaywrightClient(headless=True, stealth=True) as client:
            page = client.page
            await page.goto(request.url, wait_until="domcontentloaded", timeout=20000)
            
            pager = PaginationDetector()
            pagination = await pager.detect(page, request.url)
            
            if request.scroll:
                scroller = AutoScroller(max_scrolls=request.max_scrolls)
                await scroller.scroll_page(page)
            
            interceptor = NetworkInterceptor()
            page.on("request", interceptor.handle_request)
            page.on("response", interceptor.handle_response)
            
            await page.reload(wait_until="networkidle")
            
            extractor = DOMExtractor(base_url=request.url)
            await extractor.extract_from_page(page)
            
            image_count = len([r for r in interceptor.media_requests if r.media_type == MediaType.IMAGE])
            image_count += len([m for m in extractor.media_elements if 'image' in m.url.lower()])
            
            return {
                "url": request.url,
                "image_count": image_count,
                "has_pagination": pagination.has_pagination,
                "pagination_type": pagination.page_type,
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/harvest")
async def harvest(request: HarvestRequest):
    db = Database("mediaharbor.db")
    try:
        async with PlaywrightClient(headless=True, stealth=True) as client:
            page = client.page
            await page.goto(request.url, wait_until="domcontentloaded", timeout=20000)
            
            if request.scroll:
                scroller = AutoScroller(max_scrolls=request.max_scrolls)
                await scroller.scroll_page(page)
            
            interceptor = NetworkInterceptor()
            page.on("request", interceptor.handle_request)
            page.on("response", interceptor.handle_response)
            
            await page.reload(wait_until="networkidle")
            
            extractor = DOMExtractor(base_url=request.url)
            await extractor.extract_from_page(page)
            
            all_urls = [r.url for r in interceptor.media_requests if r.media_type == MediaType.IMAGE]
            all_urls += [m.url for m in extractor.media_elements if 'image' in m.url.lower()]
            all_urls = list(set(all_urls))
            
            new_files = 0
            total_size = 0
            
            if request.download and all_urls:
                output_path = os.path.join(request.output_dir, "images")
                os.makedirs(output_path, exist_ok=True)
                async with Downloader(output_dir=output_path) as downloader:
                    results = await downloader.download_batch(all_urls[:50])
                    new_files = sum(1 for r in results if r.is_new)
                    total_size = sum(r.file_size for r in results)
            
            db.save_harvest(
                url=request.url,
                image_count=len(all_urls),
                video_count=0,
                downloaded=len(all_urls),
                total_size=total_size,
                output_dir=request.output_dir
            )
            
            return {
                "url": request.url,
                "image_count": len(all_urls),
                "downloaded": len(all_urls),
                "new_files": new_files,
                "total_size": total_size,
                "output_dir": request.output_dir
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()