import json
import os
import subprocess
import sys
import uuid
from contextlib import asynccontextmanager
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from database import Database
from downloader import Downloader
from extractor import Extractor

# In-memory store for scan results keyed by scan_id
_scans: dict[str, list[dict]] = {}

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "mediaharbor.db")
FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")


@asynccontextmanager
async def lifespan(app: FastAPI):
    db = Database(DB_PATH)
    app.state.db = db
    yield
    db.close()


app = FastAPI(title="MediaHarbor", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db() -> Database:
    return app.state.db


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


# ── Settings ──────────────────────────────────────────────────────────────────

@app.get("/settings")
def get_settings():
    return get_db().get_settings()


@app.post("/settings")
def save_settings(data: dict):
    get_db().set_settings({k: str(v) for k, v in data.items()})
    return {"saved": True}


# ── Scan (SSE) ────────────────────────────────────────────────────────────────

@app.get("/scan")
async def scan(url: str):
    settings = get_db().get_settings()
    scan_id = str(uuid.uuid4())[:8]
    _scans[scan_id] = []

    async def generate():
        async def on_status(msg: str):
            yield {"event": "status", "data": json.dumps({"msg": msg})}

        async def on_found(item):
            d = {"url": item.url, "type": item.type, "ext": item.ext,
                 "source": item.source, "is_stream": item.is_stream}
            _scans[scan_id].append(d)
            yield {"event": "found", "data": json.dumps(d)}

        counts = {"images": 0, "videos": 0}

        async def _on_status(msg):
            async for ev in on_status(msg):
                yield ev

        async def _on_found(item):
            if item.type == "image":
                counts["images"] += 1
            else:
                counts["videos"] += 1
            async for ev in on_found(item):
                yield ev

        try:
            extractor = Extractor()
            status_queue: list[str] = []
            found_queue: list = []

            async def collect_status(msg):
                status_queue.append(msg)

            async def collect_found(item):
                found_queue.append(item)

            # Run extractor — it calls callbacks synchronously during scan
            # We stream by yielding after each callback fires via a queue approach
            import asyncio

            status_events = []
            found_events = []

            async def on_s(msg):
                status_events.append({"event": "status", "data": json.dumps({"msg": msg})})

            async def on_f(item):
                if item.type == "image":
                    counts["images"] += 1
                else:
                    counts["videos"] += 1
                d = {"url": item.url, "type": item.type, "ext": item.ext,
                     "source": item.source, "is_stream": item.is_stream}
                _scans[scan_id].append(d)
                found_events.append({"event": "found", "data": json.dumps(d)})

            await Extractor().scan(url, settings, on_f, on_s)

            for ev in status_events + found_events:
                yield ev

        except Exception as e:
            yield {"event": "status", "data": json.dumps({"msg": f"Error: {e}"})}

        yield {
            "event": "done",
            "data": json.dumps({
                "total_images": counts["images"],
                "total_videos": counts["videos"],
                "scan_id": scan_id,
            }),
        }

    return EventSourceResponse(generate())


# ── Download (SSE) ────────────────────────────────────────────────────────────

class DownloadRequest(BaseModel):
    scan_id: str
    urls: list[dict]   # [{"url", "type", "is_stream"}, ...]
    output_dir: str
    images_subfolder: str = "images"
    videos_subfolder: str = "videos"
    per_site_folder: bool = True
    site_name: str = ""


@app.post("/download")
async def download(req: DownloadRequest):
    settings = get_db().get_settings()
    concurrent = int(settings.get("concurrent_downloads", 5))

    downloader = Downloader(
        output_dir=req.output_dir,
        images_subfolder=req.images_subfolder,
        videos_subfolder=req.videos_subfolder,
        per_site_folder=req.per_site_folder,
        site_name=req.site_name,
        concurrent=concurrent,
    )

    progress_events: list[dict] = []
    total_size = 0
    downloaded = skipped = errors = 0

    async def generate():
        nonlocal total_size, downloaded, skipped, errors

        async def on_progress(done, total, result):
            nonlocal total_size, downloaded, skipped, errors
            if result.error:
                errors += 1
            elif result.is_new:
                downloaded += 1
                total_size += result.file_size
            else:
                skipped += 1

            speed = round(result.file_size / 1024 / 1024, 2) if result.file_size else 0
            yield {
                "event": "progress",
                "data": json.dumps({
                    "done": done,
                    "total": total,
                    "current_file": result.file_path.split("/")[-1] if result.file_path else "",
                    "speed_mbps": speed,
                }),
            }
            yield {
                "event": "file_done",
                "data": json.dumps({
                    "url": result.url,
                    "path": result.file_path,
                    "size": result.file_size,
                    "is_new": result.is_new,
                    "error": result.error,
                }),
            }

        prog_events: list[dict] = []

        async def _on_progress(done, total, result):
            nonlocal total_size, downloaded, skipped, errors
            if result.error:
                errors += 1
            elif result.is_new:
                downloaded += 1
                total_size += result.file_size
            else:
                skipped += 1
            speed = round(result.file_size / 1024 / 1024, 2) if result.file_size else 0
            prog_events.append({
                "event": "progress",
                "data": json.dumps({
                    "done": done, "total": total,
                    "current_file": result.file_path.split("/")[-1] if result.file_path else "",
                    "speed_mbps": speed,
                }),
            })
            prog_events.append({
                "event": "file_done",
                "data": json.dumps({
                    "url": result.url, "path": result.file_path,
                    "size": result.file_size, "is_new": result.is_new, "error": result.error,
                }),
            })

        try:
            await downloader.download_batch(req.urls, _on_progress)
        except Exception as e:
            yield {"event": "status", "data": json.dumps({"msg": f"Error: {e}"})}

        for ev in prog_events:
            yield ev

        # Save to history
        domain = urlparse(req.urls[0]["url"]).netloc if req.urls else ""
        get_db().save_harvest(
            url=req.urls[0]["url"] if req.urls else "",
            domain=domain,
            image_count=sum(1 for u in req.urls if u.get("type") == "image"),
            video_count=sum(1 for u in req.urls if u.get("type") == "video"),
            downloaded_files=downloaded,
            total_size_mb=round(total_size / 1024 / 1024, 2),
            output_dir=req.output_dir,
        )

        yield {
            "event": "complete",
            "data": json.dumps({
                "downloaded": downloaded,
                "skipped": skipped,
                "errors": errors,
                "total_size_mb": round(total_size / 1024 / 1024, 2),
                "output_dir": req.output_dir,
            }),
        }

    return EventSourceResponse(generate())


# ── History ───────────────────────────────────────────────────────────────────

@app.get("/history")
def get_history():
    return {"history": get_db().get_history()}


@app.delete("/history/{id}")
def delete_history(id: int):
    get_db().delete_harvest(id)
    return {"deleted": True}


# ── Open folder ───────────────────────────────────────────────────────────────

class FolderRequest(BaseModel):
    path: str


@app.post("/open-folder")
def open_folder(req: FolderRequest):
    path = req.path
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Path not found")
    if sys.platform == "linux":
        subprocess.Popen(["xdg-open", path])
    elif sys.platform == "darwin":
        subprocess.Popen(["open", path])
    else:
        subprocess.Popen(["explorer", path])
    return {"opened": True}


# ── Serve frontend (production) ───────────────────────────────────────────────

if os.path.isdir(FRONTEND_DIST):
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="static")
