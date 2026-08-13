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
    add_profile, delete_profile, toggle_profile_active,
    get_preset_paths, add_preset_path, update_preset_path, delete_preset_path,
    get_queue, add_to_queue, remove_queue_item,
    get_downloaded, remove_downloaded, clear_downloaded_history
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
    is_active: int = 1

class PresetPathModel(BaseModel):
    label: str
    path: str
    icon: Optional[str] = "📁"

class AnalyzeModel(BaseModel):
    url: str

class DownloadRequestModel(BaseModel):
    url: str
    title: Optional[str] = "Sans titre"
    video_id: Optional[str] = ""
    profile_id: int = 1
    dest_path: Optional[str] = ""

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

@app.get("/api/preset-paths")
async def get_preset_paths_api():
    return get_preset_paths()

@app.post("/api/preset-paths")
async def create_preset_path_api(data: PresetPathModel):
    pid = add_preset_path(data.label.strip(), data.path.strip(), data.icon or "📁")
    return {"success": True, "id": pid, "preset_paths": get_preset_paths()}

@app.put("/api/preset-paths/{preset_id}")
async def update_preset_path_api(preset_id: int, data: PresetPathModel):
    update_preset_path(preset_id, data.label.strip(), data.path.strip(), data.icon or "📁")
    return {"success": True, "preset_paths": get_preset_paths()}

@app.delete("/api/preset-paths/{preset_id}")
async def delete_preset_path_api(preset_id: int):
    delete_preset_path(preset_id)
    return {"success": True, "preset_paths": get_preset_paths()}

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
async def get_profiles_api(include_archived: bool = False):
    return get_profiles(include_archived=include_archived)

@app.post("/api/profiles")
async def create_profile_api(data: ProfileUpdateModel):
    dest = data.dest_path.strip() if data.dest_path else ""
    if dest:
        os.makedirs(dest, exist_ok=True)
    pid = add_profile(data.name, data.format_spec, data.container, data.max_res or "", dest, data.audio_only)
    return {"success": True, "profile_id": pid, "profiles": get_profiles(include_archived=True)}

@app.post("/api/profiles/{profile_id}")
async def update_profile_api(profile_id: int, data: ProfileUpdateModel):
    dest = data.dest_path.strip() if data.dest_path else ""
    if dest:
        os.makedirs(dest, exist_ok=True)
    update_profile(profile_id, data.name, data.format_spec, data.container, data.max_res or "", dest, data.audio_only, data.is_active)
    return {"success": True, "profiles": get_profiles(include_archived=True)}

@app.delete("/api/profiles/{profile_id}")
async def delete_profile_api(profile_id: int):
    delete_profile(profile_id)
    return {"success": True, "profiles": get_profiles(include_archived=True)}

@app.post("/api/profiles/{profile_id}/toggle-active")
async def toggle_profile_active_api(profile_id: int, is_active: int = 1):
    toggle_profile_active(profile_id, is_active)
    return {"success": True, "profiles": get_profiles(include_archived=True)}

@app.post("/api/analyze")
async def analyze_url_api(data: AnalyzeModel):
    try:
        res = analyze_url(data.url)
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

import re

def extract_youtube_id(url: str) -> str:
    if not url:
        return ""
    m = re.search(r'(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})', str(url))
    return m.group(1) if m else ""

@app.post("/api/download")
async def add_download_api(data: DownloadRequestModel):
    profiles = get_profiles(include_archived=True)
    selected_profile = next((p for p in profiles if p["id"] == data.profile_id), None)
    if not selected_profile:
        raise HTTPException(status_code=400, detail="Profil de téléchargement invalide")

    options = get_options()
    dest = data.dest_path.strip() if data.dest_path and data.dest_path.strip() else selected_profile.get("dest_path", "")
    if not dest:
        dest = options.get("download_dir", "/var/www/html/sujib/downloads")
    
    os.makedirs(dest, exist_ok=True)

    extracted_id = data.video_id or extract_youtube_id(data.url) or "video"

    qid = add_to_queue(
        video_id=extracted_id,
        title=data.title or "Vidéo YouTube",
        url=data.url,
        profile_id=selected_profile["id"],
        profile_name=selected_profile["name"],
        dest_path=dest
    )

    task_info = {
        "url": data.url,
        "video_id": extracted_id,
        "title": data.title,
        "profile": selected_profile,
        "dest_path": dest
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

@app.delete("/api/downloaded")
async def clear_downloaded_api():
    clear_downloaded_history()
    return {"success": True}

@app.post("/api/update-ytdlp")
async def update_ytdlp_api():
    res = await update_ytdlp()
    return res

@app.post("/api/clear-cache")
async def clear_cache_api():
    try:
        process = await asyncio.create_subprocess_exec(
            "yt-dlp", "--rm-cache-dir",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await process.communicate()
        return {"success": True, "output": stdout.decode().strip() or "Cache yt-dlp vidé avec succès."}
    except Exception as e:
        return {"success": False, "error": str(e)}

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
