import os
import json
import asyncio
from typing import Optional, List
from fastapi import FastAPI, HTTPException, Request, Response, BackgroundTasks
from fastapi.responses import HTMLResponse, StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl

from database import (
    init_db, get_options, update_options, get_profiles, update_profile,
    get_queue, add_to_queue, remove_queue_item,
    get_downloaded, remove_downloaded
)
from downloader import analyze_url, queue_manager, broadcaster
from updater import get_ytdlp_version, update_ytdlp

app = FastAPI(title="Sujib - YouTube Video Download Manager", version="2.0.0")

# Security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["Content-Security-Policy"] = "default-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com;"
    return response

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In local dev/homelab
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "PUT", "OPTIONS"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    init_db()
    await queue_manager.start()

# Data models
class OptionsUpdateModel(BaseModel):
    download_dir: str
    rename_regex: str
    show_last: int = 20
    subtitles: int = 0
    sub_lang: str = "en"

class ProfileUpdateModel(BaseModel):
    name: str
    format_spec: str
    container: str = "mkv"
    max_res: Optional[str] = ""
    dest_path: Optional[str] = ""
    audio_only: int = 0

class AnalyzeModel(BaseModel):
    url: str

class DownloadRequestModel(BaseModel):
    url: str
    title: Optional[str] = "Sans titre"
    video_id: Optional[str] = ""
    profile_id: int = 1

class RenameFileModel(BaseModel):
    new_name: str

# API Endpoints
@app.get("/api/status")
async def get_status():
    options = get_options()
    ytdlp_ver = get_ytdlp_version()
    queue = get_queue()
    downloaded = get_downloaded()
    return {
        "app_name": "Sujib",
        "version": "2.0.0",
        "ytdlp_version": ytdlp_ver,
        "queue_count": len([q for q in queue if q["status"] in ["pending", "downloading"]]),
        "downloaded_count": len(downloaded),
        "options": options
    }

@app.get("/api/options")
async def get_options_api():
    return get_options()

@app.post("/api/options")
async def update_options_api(data: OptionsUpdateModel):
    # Ensure directory exists or can be created safely
    path = os.path.abspath(data.download_dir)
    os.makedirs(path, exist_ok=True)
    update_options(path, data.rename_regex, data.show_last, data.subtitles, data.sub_lang)
    return {"success": True, "options": get_options()}

@app.get("/api/profiles")
async def get_profiles_api():
    return get_profiles()

@app.post("/api/profiles/{profile_id}")
async def update_profile_api(profile_id: int, data: ProfileUpdateModel):
    dest = data.dest_path.strip() if data.dest_path else ""
    if dest:
        os.makedirs(dest, exist_ok=True)
    update_profile(profile_id, data.name, data.format_spec, data.container, data.max_res or "", dest, data.audio_only)
    return {"success": True, "profiles": get_profiles()}

@app.post("/api/analyze")
async def analyze_url_api(data: AnalyzeModel):
    try:
        res = analyze_url(data.url)
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/download")
async def add_download_api(data: DownloadRequestModel):
    profiles = get_profiles()
    selected_profile = next((p for p in profiles if p["id"] == data.profile_id), None)
    if not selected_profile:
        raise HTTPException(status_code=400, detail="Profil de téléchargement invalide")

    options = get_options()
    dest_path = options.get("download_dir", "/tmp")

    qid = add_to_queue(
        video_id=data.video_id or "video",
        title=data.title or "Vidéo YouTube",
        url=data.url,
        profile_id=selected_profile["id"],
        profile_name=selected_profile["name"],
        dest_path=dest_path
    )

    task_info = {
        "url": data.url,
        "video_id": data.video_id,
        "title": data.title,
        "profile": selected_profile
    }

    await queue_manager.add_job(qid, task_info)
    return {"success": True, "qid": qid}

@app.get("/api/queue")
async def get_queue_api():
    return get_queue()

@app.delete("/api/queue/{qid}")
async def cancel_queue_item_api(qid: int):
    cancelled = queue_manager.cancel_job(qid)
    remove_queue_item(qid)
    await broadcaster.broadcast({"event": "queue_remove", "qid": qid})
    return {"success": True, "cancelled": cancelled}

@app.get("/api/downloaded")
async def get_downloaded_api(limit: int = 50):
    return get_downloaded(limit=limit)

@app.delete("/api/downloaded/{item_id}")
async def remove_downloaded_api(item_id: int, delete_file: bool = False):
    filepath = remove_downloaded(item_id)
    if delete_file and filepath and os.path.exists(filepath):
        try:
            # Ensure path is safely within download_dir
            options = get_options()
            dl_dir = os.path.abspath(options.get("download_dir", ""))
            real_path = os.path.abspath(filepath)
            if real_path.startswith(dl_dir + os.sep) or real_path == dl_dir:
                os.remove(real_path)
        except Exception as e:
            pass
    return {"success": True}

@app.post("/api/update-ytdlp")
async def update_ytdlp_api():
    res = await update_ytdlp()
    return res

@app.get("/api/events")
async def sse_events(request: Request):
    async def event_generator():
        q = broadcaster.subscribe()
        try:
            while True:
                if await request.is_disconnected():
                    break
                data = await q.get()
                yield f"data: {json.dumps(data)}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            broadcaster.unsubscribe(q)

    return StreamingResponse(event_generator(), media_type="text/event-stream")

# Mount Static Files & SPA
static_dir = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(static_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/", response_class=HTMLResponse)
async def serve_spa():
    index_file = os.path.join(static_dir, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return HTMLResponse("<h1>Sujib API is running</h1>")
