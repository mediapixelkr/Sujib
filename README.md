# Sujib (수집) - YouTube Video Download Manager v2.0

**Sujib** (수집, meaning "collection" in Korean) is a modern, high-performance web-based YouTube video and playlist download manager powered by **Python (FastAPI)** and **yt-dlp**.

---

## 🌟 Key Features

- **Python Native**: Seamless integration with `yt-dlp`'s internal API & progress hooks.
- **Modern Dark UI**: Sleek glassmorphism interface with Google Fonts (Outfit / Inter).
- **Drag & Drop Target Cards**: Drag YouTube video or playlist links directly onto quality profile cards (4K, 1440p, 1080p, 720p, SD, MP3 audio).
- **Real-Time Progress (SSE)**: Visual filling card progress animation driven by Server-Sent Events (SSE).
- **Playlist Inspector**: View and select individual videos inside YouTube playlists before queuing.
- **Integrated yt-dlp Updates**: 1-click update tool for `yt-dlp` directly from the navigation bar.
- **Advanced Auto-Renaming Engine**: Regex replace rules (`pattern||replacement`).
- **SQLite Database**: Persistent options, profiles, queue, and download history.

---

## 🛠️ Architecture

```
/var/www/html/sujib/
├── main.py            # FastAPI REST API & SSE event streams
├── downloader.py      # Async download queue worker & yt-dlp wrapper
├── database.py        # SQLite schema & database queries
├── updater.py         # In-app yt-dlp version & update manager
├── requirements.txt   # Python package dependencies
├── sujib.service      # Systemd service unit template
├── static/
│   ├── index.html     # Single Page Application
│   ├── css/style.css  # Modern glassmorphism dark theme
│   └── js/app.js      # Frontend logic & SSE listener
└── db.sqlite          # SQLite database
```

---

## 🚀 Quick Start

### Installation & Run

```bash
cd /var/www/html/sujib
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
./venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
```

### Systemd Service

```bash
cp sujib.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now sujib.service
```

### Nginx Configuration

```nginx
location /sujib/ {
    proxy_pass http://127.0.0.1:8000/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
    proxy_read_timeout 86400s;
}
```
