import subprocess
import sys
import logging
import yt_dlp

logger = logging.getLogger("sujib.updater")

def get_ytdlp_version() -> str:
    try:
        return yt_dlp.version.__version__
    except Exception:
        return "Unknown"

async def update_ytdlp() -> dict:
    try:
        # Run pip update for yt-dlp in the current python environment
        cmd = [sys.executable, "-m", "pip", "install", "--upgrade", "yt-dlp"]
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        
        if proc.returncode == 0:
            new_ver = get_ytdlp_version()
            return {"success": True, "message": f"yt-dlp updated successfully to version {new_ver}", "output": proc.stdout}
        else:
            return {"success": False, "message": "Update failed", "output": proc.stderr}
    except Exception as e:
        logger.error(f"Failed to update yt-dlp: {e}")
        return {"success": False, "message": str(e), "output": ""}
