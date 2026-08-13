import sqlite3
import os
import json
from typing import Dict, Any, List, Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "db.sqlite")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH, timeout=10.0)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Profiles table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        format_spec TEXT NOT NULL,
        container TEXT NOT NULL DEFAULT 'mkv',
        max_res TEXT,
        dest_path TEXT DEFAULT '',
        audio_only INTEGER DEFAULT 0,
        is_default INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1
    );
    """)

    # Ensure dest_path and is_active columns exist if migrating from older db
    cursor.execute("PRAGMA table_info(profiles)")
    columns = [col[1] for col in cursor.fetchall()]
    if 'dest_path' not in columns:
        cursor.execute("ALTER TABLE profiles ADD COLUMN dest_path TEXT DEFAULT ''")
    if 'is_active' not in columns:
        cursor.execute("ALTER TABLE profiles ADD COLUMN is_active INTEGER DEFAULT 1")

    # Options table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS options (
        id INTEGER PRIMARY KEY,
        download_dir TEXT NOT NULL,
        rename_regex TEXT DEFAULT '',
        show_last INTEGER DEFAULT 20,
        subtitles INTEGER DEFAULT 0,
        sub_lang TEXT DEFAULT 'en'
    );
    """)

    # Queue table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        video_id TEXT NOT NULL,
        title TEXT,
        url TEXT NOT NULL,
        profile_id INTEGER,
        profile_name TEXT,
        status TEXT DEFAULT 'pending', -- pending, downloading, completed, failed, cancelled
        progress_pct REAL DEFAULT 0.0,
        speed TEXT DEFAULT '',
        eta TEXT DEFAULT '',
        filename TEXT DEFAULT '',
        error_msg TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        dest_path TEXT
    );
    """)

    # Downloaded table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS downloaded (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        video_id TEXT NOT NULL,
        title TEXT,
        resolution TEXT,
        format_info TEXT,
        duration TEXT,
        filename TEXT NOT NULL,
        filepath TEXT NOT NULL,
        filesize INTEGER DEFAULT 0,
        vcodec TEXT DEFAULT '',
        acodec TEXT DEFAULT '',
        bitrate TEXT DEFAULT '',
        fps TEXT DEFAULT '',
        downloaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    for col in ["vcodec", "acodec", "bitrate", "fps"]:
        try:
            cursor.execute(f"ALTER TABLE downloaded ADD COLUMN {col} TEXT DEFAULT ''")
        except Exception:
            pass

    # Default options if missing
    cursor.execute("SELECT COUNT(*) FROM options")
    if cursor.fetchone()[0] == 0:
        default_dl_dir = os.path.join(os.path.dirname(__file__), "downloads")
        os.makedirs(default_dl_dir, exist_ok=True)
        cursor.execute(
            "INSERT INTO options (id, download_dir, rename_regex, show_last, subtitles, sub_lang) VALUES (1, ?, ?, 20, 0, 'en')",
            (default_dl_dir, "/[\"']/||\n/\\s+/||-")
        )

    # Default profiles if missing
    cursor.execute("SELECT COUNT(*) FROM profiles")
    if cursor.fetchone()[0] == 0:
        default_profiles = [
            (1, "4K (2160p)", "bestvideo[height<=2160]+bestaudio/best", "mkv", "2160p", 0, 1),
            (2, "1440p (2K)", "bestvideo[height<=1440]+bestaudio/best", "mkv", "1440p", 0, 0),
            (3, "1080p (Full HD)", "bestvideo[height<=1080]+bestaudio/best", "mkv", "1080p", 0, 0),
            (4, "720p (HD)", "bestvideo[height<=720]+bestaudio/best", "mp4", "720p", 0, 0),
            (5, "SD (480p)", "bestvideo[height<=480]+bestaudio/best", "mp4", "480p", 0, 0),
            (6, "Audio Only (MP3)", "bestaudio/best", "mp3", "audio", 1, 0)
        ]
        cursor.executemany(
            "INSERT INTO profiles (id, name, format_spec, container, max_res, audio_only, is_default) VALUES (?, ?, ?, ?, ?, ?, ?)",
            default_profiles
        )

    # Preset Paths table (for multi-layer destination dropdowns)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS preset_paths (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        label TEXT NOT NULL,
        path TEXT NOT NULL,
        icon TEXT DEFAULT '📁'
    );
    """)

    cursor.execute("SELECT COUNT(*) FROM preset_paths")
    if cursor.fetchone()[0] == 0:
        default_paths = [
            ("Dossier par défaut (Global)", "", "📁"),
            ("Albums US", "/var/www/html/sujib/downloads/Albums_US", "💿"),
            ("MV K-Pop", "/var/www/html/sujib/downloads/KPop_MV", "🎵"),
            ("Musique / EDM", "/var/www/html/sujib/downloads/EDM", "🎧")
        ]
        cursor.executemany(
            "INSERT INTO preset_paths (label, path, icon) VALUES (?, ?, ?)",
            default_paths
        )

    conn.commit()
    conn.close()

def get_options() -> Dict[str, Any]:
    conn = get_db_connection()
    row = conn.execute("SELECT * FROM options WHERE id = 1").fetchone()
    conn.close()
    if row:
        return dict(row)
    return {}

def update_options(download_dir: str, rename_regex: str, show_last: int, subtitles: int, sub_lang: str):
    conn = get_db_connection()
    conn.execute(
        "UPDATE options SET download_dir = ?, rename_regex = ?, show_last = ?, subtitles = ?, sub_lang = ? WHERE id = 1",
        (download_dir, rename_regex, show_last, subtitles, sub_lang)
    )
    conn.commit()
    conn.close()

def get_profiles(include_archived: bool = False) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    if include_archived:
        rows = conn.execute("SELECT * FROM profiles ORDER BY id ASC").fetchall()
    else:
        rows = conn.execute("SELECT * FROM profiles WHERE is_active = 1 ORDER BY id ASC").fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_queue() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM queue ORDER BY id DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]

def add_profile(name: str, format_spec: str, container: str, max_res: str, dest_path: str, audio_only: int) -> int:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO profiles (name, format_spec, container, max_res, dest_path, audio_only, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)",
        (name, format_spec, container, max_res, dest_path, audio_only)
    )
    pid = cursor.lastrowid
    conn.commit()
    conn.close()
    return pid

def update_profile(profile_id: int, name: str, format_spec: str, container: str, max_res: str, dest_path: str, audio_only: int, is_active: int = 1):
    conn = get_db_connection()
    conn.execute(
        "UPDATE profiles SET name = ?, format_spec = ?, container = ?, max_res = ?, dest_path = ?, audio_only = ?, is_active = ? WHERE id = ?",
        (name, format_spec, container, max_res, dest_path, audio_only, is_active, profile_id)
    )
    conn.commit()
    conn.close()

def delete_profile(profile_id: int):
    conn = get_db_connection()
    conn.execute("DELETE FROM profiles WHERE id = ?", (profile_id,))
    conn.commit()
    conn.close()

def toggle_profile_active(profile_id: int, is_active: int):
    conn = get_db_connection()
    conn.execute("UPDATE profiles SET is_active = ? WHERE id = ?", (is_active, profile_id))
    conn.commit()
    conn.close()

def add_to_queue(video_id: str, title: str, url: str, profile_id: int, profile_name: str, dest_path: str) -> int:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO queue (video_id, title, url, profile_id, profile_name, dest_path, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')",
        (video_id, title, url, profile_id, profile_name, dest_path)
    )
    qid = cursor.lastrowid
    conn.commit()
    conn.close()
    return qid

def update_queue_status(qid: int, status: str, progress_pct: float = 0.0, speed: str = "", eta: str = "", filename: str = "", error_msg: str = "", title: str = ""):
    conn = get_db_connection()
    if title:
        conn.execute(
            "UPDATE queue SET status = ?, progress_pct = ?, speed = ?, eta = ?, filename = ?, error_msg = ?, title = ? WHERE id = ?",
            (status, progress_pct, speed, eta, filename, error_msg, title, qid)
        )
    else:
        conn.execute(
            "UPDATE queue SET status = ?, progress_pct = ?, speed = ?, eta = ?, filename = ?, error_msg = ? WHERE id = ?",
            (status, progress_pct, speed, eta, filename, error_msg, qid)
        )
    conn.commit()
    conn.close()

def remove_queue_item(qid: int):
    conn = get_db_connection()
    conn.execute("DELETE FROM queue WHERE id = ?", (qid,))
    conn.commit()
    conn.close()

def add_downloaded(video_id: str, title: str, resolution: str, format_info: str, duration: str, filename: str, filepath: str, filesize: int, vcodec: str = "", acodec: str = "", bitrate: str = "", fps: str = ""):
    conn = get_db_connection()
    conn.execute(
        "INSERT INTO downloaded (video_id, title, resolution, format_info, duration, filename, filepath, filesize, vcodec, acodec, bitrate, fps) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (video_id, title, resolution, format_info, duration, filename, filepath, filesize, vcodec, acodec, bitrate, fps)
    )
    conn.commit()
    conn.close()

def get_downloaded(limit: int = 50) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM downloaded ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def remove_downloaded(item_id: int) -> Optional[str]:
    conn = get_db_connection()
    row = conn.execute("SELECT video_id, filename, filepath FROM downloaded WHERE id = ?", (item_id,)).fetchone()
    filepath = row["filepath"] if row else None
    vid = row["video_id"] if row else None
    fn = row["filename"] if row else None

    conn.execute("DELETE FROM downloaded WHERE id = ?", (item_id,))
    if vid:
        conn.execute("DELETE FROM queue WHERE video_id = ? AND status = 'completed'", (vid,))
    if fn:
        conn.execute("DELETE FROM queue WHERE filename = ? AND status = 'completed'", (fn,))
    conn.commit()
    conn.close()
    return filepath

def get_preset_paths() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM preset_paths ORDER BY id ASC").fetchall()
    conn.close()
    return [dict(r) for r in rows]

def add_preset_path(label: str, path: str, icon: str = '📁') -> int:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO preset_paths (label, path, icon) VALUES (?, ?, ?)",
        (label, path, icon)
    )
    pid = cursor.lastrowid
    conn.commit()
    conn.close()
    return pid

def update_preset_path(preset_id: int, label: str, path: str, icon: str = '📁'):
    conn = get_db_connection()
    conn.execute(
        "UPDATE preset_paths SET label = ?, path = ?, icon = ? WHERE id = ?",
        (label, path, icon, preset_id)
    )
    conn.commit()
    conn.close()

def clear_downloaded_history(delete_files: bool = False):
    conn = get_db_connection()
    if delete_files:
        rows = conn.execute("SELECT filepath FROM downloaded").fetchall()
        options = get_options()
        dl_dir = os.path.abspath(options.get("download_dir", ""))
        for r in rows:
            filepath = r[0]
            if filepath and os.path.exists(filepath):
                try:
                    real_path = os.path.abspath(filepath)
                    if real_path.startswith(dl_dir + os.sep) or real_path == dl_dir:
                        os.remove(real_path)
                except Exception:
                    pass
    conn.execute("DELETE FROM downloaded")
    conn.execute("DELETE FROM queue WHERE status IN ('completed', 'failed', 'cancelled')")
    conn.commit()
    conn.close()

def delete_preset_path(preset_id: int):
    conn = get_db_connection()
    conn.execute("DELETE FROM preset_paths WHERE id = ?", (preset_id,))
    conn.commit()
    conn.close()
