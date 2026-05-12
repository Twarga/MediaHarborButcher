import asyncio
import json
import os
import subprocess
import sys
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from database import Database
from downloader import Downloader
from extractor import Extractor


# Keyed by scan_id. Each entry holds the item list + ScanContext (cookies, UA).
_scans: dict[str, dict] = {}
_scan_times: dict[str, float] = {}
_running_tasks: set[asyncio.Task] = set()

DB_PATH = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "mediaharbor.db"))
FRONTEND_DIST = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))
SCAN_TTL_SECONDS = 3600


def _prune_old_scans() -> None:
    now = time.monotonic()
    expired = [sid for sid, t in _scan_times.items() if now - t > SCAN_TTL_SECONDS]
    for sid in expired:
        _scans.pop(sid, None)
        _scan_times.pop(sid, None)


def _track_task(task: asyncio.Task) -> None:
    _running_tasks.add(task)
    task.add_done_callback(_running_tasks.discard)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.db = Database(DB_PATH)
    yield
    app.state.db.close()


app = FastAPI(title="MediaHarbor", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_methods=["*"],
    allow_headers=["*"],
)


def db() -> Database:
    return app.state.db


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


# ── Settings ──────────────────────────────────────────────────────────────────

@app.get("/settings")
def get_settings():
    return db().get_settings()


@app.post("/settings")
def save_settings(data: dict):
    db().set_settings({k: str(v) for k, v in data.items()})
    return {"saved": True}


# ── Scan (SSE) ────────────────────────────────────────────────────────────────

@app.get("/scan")
async def scan(url: str):
    if not url.startswith(("http://", "https://")):
        raise HTTPException(400, "URL must start with http:// or https://")

    _prune_old_scans()
    settings = db().get_settings()
    scan_id = str(uuid.uuid4())[:8]
    _scans[scan_id] = {"items": [], "context": None}
    _scan_times[scan_id] = time.monotonic()
    queue: asyncio.Queue = asyncio.Queue()

    async def run_scan():
        async def on_status(msg: str):
            await queue.put({"event": "status", "data": json.dumps({"msg": msg})})

        async def on_found(item):
            d = {
                "url": item.url,
                "type": item.type,
                "ext": item.ext,
                "source": item.source,
                "is_stream": item.is_stream,
                "width": item.width,
                "height": item.height,
                "poster": item.poster,
            }
            _scans[scan_id]["items"].append(d)
            await queue.put({"event": "found", "data": json.dumps(d)})

        try:
            ctx = await Extractor().scan(url, settings, on_found, on_status)
            _scans[scan_id]["context"] = {
                "cookies": ctx.cookies,
                "user_agent": ctx.user_agent,
                "referer": ctx.referer,
            }
        except Exception as e:
            await queue.put({"event": "status", "data": json.dumps({"msg": f"Error: {e}"})})
        finally:
            items = _scans[scan_id]["items"]
            images = sum(1 for i in items if i["type"] == "image")
            videos = sum(1 for i in items if i["type"] == "video")
            await queue.put({"event": "done", "data": json.dumps(
                {"total_images": images, "total_videos": videos, "scan_id": scan_id}
            )})
            await queue.put(None)

    _track_task(asyncio.create_task(run_scan()))

    async def generate():
        while True:
            item = await queue.get()
            if item is None:
                break
            yield item

    return EventSourceResponse(generate())


# ── Download (SSE) ────────────────────────────────────────────────────────────

class DownloadRequest(BaseModel):
    scan_id: str = ""
    urls: list[dict]
    output_dir: str
    images_subfolder: str = "images"
    videos_subfolder: str = "videos"
    per_site_folder: bool = True
    site_name: str = ""
    source_url: str = ""


@app.post("/download")
async def download(req: DownloadRequest):
    if not req.urls:
        raise HTTPException(400, "urls list is empty")

    settings = db().get_settings()
    concurrent = int(settings.get("concurrent_downloads", 5))
    queue: asyncio.Queue = asyncio.Queue()

    # Pull cookies/UA from the cached scan context if we still have it.
    cookies = []
    user_agent = ""
    scan_referer = ""
    if req.scan_id and req.scan_id in _scans:
        ctx = _scans[req.scan_id].get("context") or {}
        cookies = ctx.get("cookies") or []
        user_agent = ctx.get("user_agent") or ""
        scan_referer = ctx.get("referer") or ""

    downloader = Downloader(
        output_dir=req.output_dir,
        images_subfolder=req.images_subfolder,
        videos_subfolder=req.videos_subfolder,
        per_site_folder=req.per_site_folder,
        site_name=req.site_name,
        concurrent=concurrent,
        referer=req.source_url or scan_referer,
        user_agent=user_agent,
        cookies=cookies,
    )

    async def run_download():
        downloaded = skipped = errors = 0
        total_size = 0
        speed_window: list[tuple[float, int]] = []
        start_time = time.monotonic()
        failed_items: list[dict] = []

        async def on_progress(done, total, result):
            nonlocal downloaded, skipped, errors, total_size
            if result.error:
                errors += 1
                failed_items.append({
                    "url": result.url,
                    "error": result.error,
                    "attempts": result.attempts,
                    "engine": result.engine,
                })
            elif result.is_new:
                downloaded += 1
                total_size += result.file_size
                speed_window.append((time.monotonic(), result.file_size))
                if len(speed_window) > 30:
                    speed_window.pop(0)
            else:
                skipped += 1

            if len(speed_window) >= 2:
                span = max(0.001, speed_window[-1][0] - speed_window[0][0])
                speed_mbps = round((sum(b for _, b in speed_window) / span) / (1024 * 1024), 2)
            elif result.file_size and result.elapsed > 0:
                speed_mbps = round((result.file_size / result.elapsed) / (1024 * 1024), 2)
            else:
                speed_mbps = 0.0

            await queue.put({"event": "progress", "data": json.dumps({
                "done": done, "total": total,
                "current_file": os.path.basename(result.file_path) if result.file_path else "",
                "speed_mbps": speed_mbps,
            })})
            await queue.put({"event": "file_done", "data": json.dumps({
                "url": result.url,
                "path": result.file_path,
                "size": result.file_size,
                "is_new": result.is_new,
                "error": result.error,
                "attempts": result.attempts,
                "engine": result.engine,
            })})

        try:
            await downloader.download_batch(req.urls, on_progress)
        except Exception as e:
            await queue.put({"event": "status", "data": json.dumps({"msg": f"Error: {e}"})})

        domain = req.site_name or (
            urlparse(req.urls[0]["url"]).netloc if req.urls else ""
        )
        db().save_harvest(
            url=req.source_url or (req.urls[0]["url"] if req.urls else ""),
            domain=domain,
            image_count=sum(1 for u in req.urls if u.get("type") == "image"),
            video_count=sum(1 for u in req.urls if u.get("type") == "video"),
            downloaded_files=downloaded,
            total_size_mb=round(total_size / 1024 / 1024, 2),
            output_dir=str(downloader.img_dir.parent),
        )

        total_elapsed = max(0.001, time.monotonic() - start_time)
        await queue.put({"event": "complete", "data": json.dumps({
            "downloaded": downloaded,
            "skipped": skipped,
            "errors": errors,
            "total_size_mb": round(total_size / 1024 / 1024, 2),
            "output_dir": str(downloader.img_dir.parent),
            "elapsed_seconds": round(total_elapsed, 1),
            "failed_items": failed_items,
        })})
        await queue.put(None)

    _track_task(asyncio.create_task(run_download()))

    async def generate():
        while True:
            item = await queue.get()
            if item is None:
                break
            yield item

    return EventSourceResponse(generate())


# ── History ───────────────────────────────────────────────────────────────────

@app.get("/history")
def get_history():
    return {"history": db().get_history()}


@app.delete("/history/{id}")
def delete_history(id: int):
    db().delete_harvest(id)
    return {"deleted": True}


@app.delete("/history")
def clear_history():
    db().clear_history()
    return {"cleared": True}


# ── Open folder ───────────────────────────────────────────────────────────────

class FolderRequest(BaseModel):
    path: str


def _is_safe_folder(path: str) -> bool:
    try:
        p = Path(path).expanduser().resolve(strict=True)
    except (OSError, RuntimeError):
        return False
    return p.is_dir()


@app.post("/open-folder")
def open_folder(req: FolderRequest):
    if not _is_safe_folder(req.path):
        raise HTTPException(400, "Folder does not exist or path is invalid")
    resolved = str(Path(req.path).expanduser().resolve())
    try:
        if sys.platform == "linux":
            subprocess.Popen(["xdg-open", resolved])
        elif sys.platform == "darwin":
            subprocess.Popen(["open", resolved])
        else:
            subprocess.Popen(["explorer", resolved])
    except FileNotFoundError as e:
        raise HTTPException(500, f"Opener not available: {e}")
    return {"opened": True}


# ── Serve frontend ────────────────────────────────────────────────────────────

if os.path.isdir(FRONTEND_DIST):
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="static")
