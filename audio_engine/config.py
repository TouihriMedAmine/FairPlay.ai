"""Central configuration, overridable via environment variables."""

import os
from pathlib import Path

DB_PATH = Path(os.environ.get("SHAZAM_DB_PATH", "shazam.db"))

MAX_UPLOAD_BYTES = int(os.environ.get("SHAZAM_MAX_UPLOAD_BYTES", 50 * 1024 * 1024))
UPLOAD_CHUNK_BYTES = 1024 * 1024

ALLOWED_AUDIO_SUFFIXES = {".wav", ".mp3", ".flac", ".ogg", ".m4a", ".opus"}

# Comma-separated list of valid API keys. When empty, auth is DISABLED (dev
# mode) and a warning is logged at startup. Set SHAZAM_API_KEYS in production.
API_KEYS = {k.strip() for k in os.environ.get("SHAZAM_API_KEYS", "").split(",") if k.strip()}

# Simple in-process rate limiting (per client IP).
RATE_LIMIT_REQUESTS = int(os.environ.get("SHAZAM_RATE_LIMIT_REQUESTS", "120"))
RATE_LIMIT_WINDOW_SEC = float(os.environ.get("SHAZAM_RATE_LIMIT_WINDOW_SEC", "60"))

# Matching defaults.
DEFAULT_MIN_CONFIDENCE = float(os.environ.get("SHAZAM_MIN_CONFIDENCE", "0.15"))
DEFAULT_MAX_RESULTS = int(os.environ.get("SHAZAM_MAX_RESULTS", "5"))
