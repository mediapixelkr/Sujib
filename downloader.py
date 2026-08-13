import asyncio
import os
import re
import logging
import json
import subprocess
import yt_dlp
from typing import Dict, Any, List, Callable, Optional
from database import get_options, get_profiles, update_queue_status, add_downloaded, remove_queue_item

logger = logging.getLogger("sujib.downloader")

class EventBroadcaster:
    def __init__(self):
        self.listeners: List[asyncio.Queue] = []

    def subscribe(self) -> asyncio.Queue:
        q = asyncio.Queue()
        self.listeners.append(q)
        return q

    def unsubscribe(self, q: asyncio.Queue):
        if q in self.listeners:
            self.listeners.remove(q)

    async def broadcast(self, data: Dict[str, Any]):
        for q in list(self.listeners):
            try:
                await q.put(data)
            except Exception:
                pass

broadcaster = EventBroadcaster()

def apply_rename_regex(filename: str, rules_text: str) -> str:
    if not rules_text or not rules_text.strip():
        return filename

    name, ext = os.path.splitext(filename)
    rules = [line.strip() for line in rules_text.strip().split("\n") if line.strip()]

    for rule in rules:
        if "||" not in rule:
            continue
        parts = rule.split("||", 1)
        pattern = parts[0].strip()
        replacement = parts[1] if len(parts) > 1 else ""

        # Remove leading/trailing delimiters if provided in PHP/JS style e.g. /pattern/flags
        flags = 0
        if pattern.startswith("/") and pattern.rfind("/") > 0:
            last_slash = pattern.rfind("/")
            flag_str = pattern[last_slash+1:]
            pattern = pattern[1:last_slash]
            if "i" in flag_str:
                flags |= re.IGNORECASE

        # Convert JS/PHP style $1, $2, $3... group references to Python \g<1>, \g<2>, \g<3>...
        py_replacement = re.sub(r'\$(\d+)', r'\\g<\1>', replacement)

        try:
            name = re.sub(pattern, py_replacement, name, flags=flags)
        except Exception as e:
            logger.warning(f"Regex replace error for pattern {pattern}: {e}")

    # Ensure filename is safe (prevent path traversal / invalid chars)
    name = os.path.basename(name.replace("/", "-").replace("\\", "-"))
    return f"{name}{ext}"

def extract_media_specs(filepath: str, info_dict: dict = None) -> dict:
    specs = {
        'vcodec': '',
        'acodec': '',
        'bitrate': '',
        'fps': '',
        'format_info': '',
        'resolution': '',
        'duration': '--'
    }

    if isinstance(info_dict, dict):
        vc = info_dict.get('vcodec', '')
        ac = info_dict.get('acodec', '')
        if vc and vc != 'none':
            specs['vcodec'] = vc.split('.')[0].upper()
        if ac and ac != 'none':
            specs['acodec'] = ac.split('.')[0].upper()
        
        tbr = info_dict.get('tbr') or info_dict.get('vbr') or info_dict.get('abr')
        if tbr:
            specs['bitrate'] = f"{int(tbr)} kbps"
            
        fps = info_dict.get('fps')
        if fps:
            specs['fps'] = f"{int(fps)} fps"

        height = info_dict.get('height')
        if height:
            specs['resolution'] = f"{height}p"

        dur = info_dict.get('duration')
        if dur:
            m, s = divmod(int(dur), 60)
            h, m = divmod(m, 60)
            specs['duration'] = f"{h:02d}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"

    if filepath and os.path.exists(filepath):
        try:
            cmd = ['ffprobe', '-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', filepath]
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
            if res.returncode == 0:
                data = json.loads(res.stdout)
                fmt = data.get('format', {})
                streams = data.get('streams', [])
                
                vstream = next((s for s in streams if s.get('codec_type') == 'video'), None)
                astream = next((s for s in streams if s.get('codec_type') == 'audio'), None)

                if vstream:
                    v_name = vstream.get('codec_name', '').upper()
                    if v_name: specs['vcodec'] = v_name
                    h = vstream.get('height')
                    if h: specs['resolution'] = f"{h}p"
                    r_fps = vstream.get('r_frame_rate', '')
                    if '/' in r_fps:
                        num, den = map(float, r_fps.split('/'))
                        if den > 0:
                            fps_val = round(num / den)
                            if fps_val > 0: specs['fps'] = f"{fps_val} fps"

                if astream:
                    a_name = astream.get('codec_name', '').upper()
                    if a_name: specs['acodec'] = a_name

                br = fmt.get('bit_rate')
                if br and str(br).isdigit():
                    kbps = int(br) // 1000
                    if kbps > 0: specs['bitrate'] = f"{kbps} kbps"

                dur_f = fmt.get('duration')
                if dur_f:
                    m, s = divmod(int(float(dur_f)), 60)
                    h, m = divmod(m, 60)
                    specs['duration'] = f"{h:02d}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"

        except Exception as e:
            logger.warning(f"ffprobe extraction failed for {filepath}: {e}")

    codecs = [c for c in [specs['vcodec'], specs['acodec']] if c]
    codec_str = ' / '.join(codecs) if codecs else ''
    summary_parts = [p for p in [codec_str, specs['bitrate'], specs['fps']] if p]
    specs['format_info'] = ' · '.join(summary_parts)

    return specs

def analyze_url(url: str) -> Dict[str, Any]:
    ydl_opts = {
        'quiet': True,
        'extract_flat': 'in_playlist',
        'skip_download': True,
        'no_warnings': True,
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)
        
    if not info:
        raise ValueError("Impossible d'extraire les informations de l'URL renseignée.")

    if info.get('_type') == 'playlist' or 'entries' in info:
        entries = []
        for entry in info.get('entries', []):
            if entry:
                vid = entry.get('id', '')
                entries.append({
                    'id': vid,
                    'title': entry.get('title', 'Sans titre'),
                    'url': f"https://www.youtube.com/watch?v={vid}" if vid else url,
                    'duration': entry.get('duration')
                })
        return {
            'type': 'playlist',
            'title': info.get('title', 'Playlist'),
            'id': info.get('id', ''),
            'videos': entries
        }
    else:
        vid = info.get('id', '')
        return {
            'type': 'video',
            'id': vid,
            'title': info.get('title', 'Sans titre'),
            'url': url,
            'duration': info.get('duration'),
            'thumbnail': info.get('thumbnail')
        }

class DownloadQueueManager:
    def __init__(self):
        self.queue: asyncio.Queue = asyncio.Queue()
        self.current_tasks: Dict[int, asyncio.Task] = {}
        self.is_running = False

    async def start(self):
        if self.is_running:
            return
        self.is_running = True
        asyncio.create_task(self._worker_loop())

    async def _worker_loop(self):
        while self.is_running:
            qid, task_info = await self.queue.get()
            try:
                task = asyncio.create_task(self._execute_download(qid, task_info))
                self.current_tasks[qid] = task
                await task
            except Exception as e:
                logger.error(f"Error processing qid {qid}: {e}")
            finally:
                if qid in self.current_tasks:
                    del self.current_tasks[qid]
                self.queue.task_done()

    async def add_job(self, qid: int, task_info: Dict[str, Any]):
        await self.queue.put((qid, task_info))
        await broadcaster.broadcast({"event": "queue_update", "qid": qid, "status": "pending"})

    def cancel_job(self, qid: int) -> bool:
        if qid in self.current_tasks:
            self.current_tasks[qid].cancel()
            update_queue_status(qid, status="cancelled", error_msg="Download cancelled by user")
            return True
        return False

    async def _execute_download(self, qid: int, task_info: Dict[str, Any]):
        url = task_info['url']
        profile = task_info['profile']
        options = get_options()
        # Use profile-specific dest_path if specified, otherwise fallback to options download_dir
        profile_dest = task_info.get('dest_path') or profile.get('dest_path', '')
        if profile_dest and profile_dest.strip():
            download_dir = profile_dest.strip()
        else:
            download_dir = options.get('download_dir', '/tmp')

        os.makedirs(download_dir, exist_ok=True)

        update_queue_status(qid, status="downloading", progress_pct=0.0, speed="Initialisation...", eta="--")
        await broadcaster.broadcast({"event": "progress", "qid": qid, "pct": 0, "speed": "Init", "eta": "--"})

        loop = asyncio.get_running_loop()

        def progress_hook(d):
            if d['status'] == 'downloading':
                downloaded = d.get('downloaded_bytes', 0)
                total = d.get('total_bytes') or d.get('total_bytes_estimate') or 1
                pct = round((downloaded / total) * 100, 1)
                
                speed_bytes = d.get('speed') or 0
                speed_str = f"{speed_bytes / 1024 / 1024:.1f} MB/s" if speed_bytes else "-- MB/s"
                
                eta_sec = d.get('eta')
                eta_str = f"{eta_sec}s" if eta_sec is not None else "--"

                filename = os.path.basename(d.get('filename', ''))

                update_queue_status(qid, status="downloading", progress_pct=pct, speed=speed_str, eta=eta_str, filename=filename)
                
                # Schedule async broadcast
                asyncio.run_coroutine_threadsafe(
                    broadcaster.broadcast({
                        "event": "progress",
                        "qid": qid,
                        "pct": pct,
                        "speed": speed_str,
                        "eta": eta_str,
                        "filename": filename
                    }),
                    loop
                )

        format_spec = profile.get('format_spec', 'bestvideo+bestaudio/best')
        container = profile.get('container', 'mkv')

        outtmpl = os.path.join(download_dir, '%(title)s.%(ext)s')

        ydl_opts = {
            'format': format_spec,
            'outtmpl': outtmpl,
            'merge_output_format': container if profile.get('audio_only') == 0 else None,
            'progress_hooks': [progress_hook],
            'quiet': True,
            'no_warnings': True,
        }

        # Subtitles option
        if options.get('subtitles', 0) > 0:
            sub_lang = options.get('sub_lang', 'en')
            ydl_opts['writesubtitles'] = True
            ydl_opts['subtitleslangs'] = [sub_lang]
            if options.get('subtitles') == 2:
                ydl_opts['embedsubtitles'] = True

        # Audio extract option if audio_only
        if profile.get('audio_only') == 1:
            ydl_opts['postprocessors'] = [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }]

        def sync_download():
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                prepared_fn = ydl.prepare_filename(info)
                vid = info.get('id', '') if isinstance(info, dict) else ''
                vtitle = info.get('title', '') if isinstance(info, dict) else ''
                return prepared_fn, vid, vtitle, info

        try:
            download_result = await loop.run_in_executor(None, sync_download)
            if isinstance(download_result, tuple):
                final_filepath, extracted_vid, extracted_title, raw_info = download_result
            else:
                final_filepath, extracted_vid, extracted_title, raw_info = download_result, '', '', {}

            if not os.path.exists(final_filepath):
                # Try finding matched file in dir if extension changed during merge
                base_name = os.path.splitext(final_filepath)[0]
                for ext in ['.mkv', '.mp4', '.mp3', '.webm']:
                    if os.path.exists(base_name + ext):
                        final_filepath = base_name + ext
                        break

            # Apply rename regex rules if configured
            rename_rules = options.get('rename_regex', '')
            final_filename = os.path.basename(final_filepath)
            
            if rename_rules and os.path.exists(final_filepath):
                new_filename = apply_rename_regex(final_filename, rename_rules)
                if new_filename != final_filename:
                    new_filepath = os.path.join(download_dir, new_filename)
                    os.rename(final_filepath, new_filepath)
                    final_filepath = new_filepath
                    final_filename = new_filename

            filesize = os.path.getsize(final_filepath) if os.path.exists(final_filepath) else 0

            # Extract detailed media technical specs (codecs, bitrate, fps, resolution, duration)
            media_specs = extract_media_specs(final_filepath, raw_info)

            # Prioritize extracted real video title over generic fallback titles
            raw_req_title = task_info.get('title', '')
            if extracted_title and extracted_title.strip():
                final_title = extracted_title
            elif raw_req_title and raw_req_title != "Vidéo YouTube":
                final_title = raw_req_title
            else:
                final_title = os.path.splitext(final_filename)[0]

            final_vid = extracted_vid or task_info.get('video_id', '') or ''

            add_downloaded(
                video_id=final_vid,
                title=final_title,
                resolution=media_specs.get('resolution') or profile.get('max_res', 'auto'),
                format_info=media_specs.get('format_info') or profile.get('name', 'Custom'),
                duration=media_specs.get('duration') or '--',
                filename=final_filename,
                filepath=final_filepath,
                filesize=filesize,
                vcodec=media_specs.get('vcodec', ''),
                acodec=media_specs.get('acodec', ''),
                bitrate=media_specs.get('bitrate', ''),
                fps=media_specs.get('fps', '')
            )

            update_queue_status(qid, status="completed", progress_pct=100.0, filename=final_filename, title=final_title)
            await broadcaster.broadcast({"event": "completed", "qid": qid, "filename": final_filename})

        except asyncio.CancelledError:
            update_queue_status(qid, status="cancelled", error_msg="Cancelled")
            await broadcaster.broadcast({"event": "cancelled", "qid": qid})
        except Exception as e:
            logger.error(f"Download failed for qid {qid}: {e}")
            update_queue_status(qid, status="failed", error_msg=str(e))
            await broadcaster.broadcast({"event": "failed", "qid": qid, "error": str(e)})

queue_manager = DownloadQueueManager()
