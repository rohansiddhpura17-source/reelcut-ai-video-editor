import os
from pathlib import Path
import imageio_ffmpeg

BASE_DIR = Path(__file__).resolve().parent.parent.parent
STORAGE_DIR = BASE_DIR / "storage"
UPLOADS_DIR = STORAGE_DIR / "uploads"
PROJECTS_DIR = STORAGE_DIR / "projects"
RENDERS_DIR = STORAGE_DIR / "renders"

# Ensure directories exist
for directory in [UPLOADS_DIR, PROJECTS_DIR, RENDERS_DIR]:
    directory.mkdir(parents=True, exist_ok=True)

# Locate FFmpeg binary
try:
    FFMPEG_BIN = imageio_ffmpeg.get_ffmpeg_exe()
except Exception:
    FFMPEG_BIN = "ffmpeg"

HOST = "0.0.0.0"
PORT = 8000
