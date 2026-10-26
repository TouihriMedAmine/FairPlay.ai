#!/usr/bin/env python3
"""
Improved Radio Music Detection and Song Identification System
- Fixed audio format consistency (16kHz for YAMNet compatibility)
- Better error handling and resource management
- Improved song boundary detection logic
- Rate limiting for API calls
- More robust file handling
"""

import os
import re
import subprocess
import uuid
import datetime
import time
import requests
import numpy as np
from pydub import AudioSegment
import librosa
from tensorflow.keras.models import load_model
import tensorflow_hub as hub
import base64
import json
import logging
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
import threading
import queue
from contextlib import contextmanager
from typing import Optional, Tuple, Dict, List
import shutil

# Configure logging (UTF-8 safe on Windows console and log file)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('radio_detector.log', encoding='utf-8'),
        logging.StreamHandler(stream=sys.stdout)
    ],
    force=True,
)
logger = logging.getLogger(__name__)

# Ensure stdout/stderr can handle Unicode; avoid cp1252 encode errors on Windows
try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

# Constants - Standardized to 16kHz for YAMNet compatibility
SAMPLE_RATE = 16000  # Changed from 22050 to match YAMNet
DURATION = 5
MFCC_FEATURES = 40
MAX_PAD_LEN = 130
RECORDINGS_DIR = "recordings"
SEGMENTS_ROOT = Path(RECORDINGS_DIR) / "segments"

def station_segment_dir(radio_name: str) -> Path:
    """Per-station segment directory (slugified station name)"""
    slug = re.sub(r'[^a-z0-9]+', '_', radio_name.strip().lower()).strip('_')
    return SEGMENTS_ROOT / slug

# Create base directories
os.makedirs(RECORDINGS_DIR, exist_ok=True)
os.makedirs(SEGMENTS_ROOT, exist_ok=True)

# Configuration loading with error handling
def load_config():
    # Secrets live in .env (git-ignored); config.json holds only non-secret config
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass
    try:
        with open('config.json') as f:
            return json.load(f)
    except FileNotFoundError:
        logger.error("config.json not found")
        raise
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in config.json: {e}")
        raise

config = load_config()
API_KEY = os.getenv('RAPIDAPI_KEY') or config.get('API_KEY')
if not API_KEY:
    raise ValueError("RAPIDAPI_KEY missing: set it in .env (RAPIDAPI_KEY=...)")

# Environment variables with validation
YAMNET_SIM_THRESHOLD = float(os.getenv('YAMNET_SIM_THRESHOLD', '0.5'))
YAMNET_MIN_MISMATCHES = int(os.getenv('YAMNET_MIN_MISMATCHES', '3'))
YAMNET_HARD_CUTOFF = float(os.getenv('YAMNET_HARD_CUTOFF', '0.4'))
MUSIC_THRESHOLD = float(os.getenv('MUSIC_THRESHOLD', '0.8'))
NON_MUSIC_END_STREAK = int(os.getenv('NON_MUSIC_END_STREAK', '2'))   # consecutive non-music windows to close a song
SONG_MERGE_WINDOW = int(os.getenv('SONG_MERGE_WINDOW', '120'))       # seconds: merge same-song fragments into one row

# Validate thresholds
if not (0 <= YAMNET_SIM_THRESHOLD <= 1):
    raise ValueError("YAMNET_SIM_THRESHOLD must be between 0 and 1")
if not (0 <= MUSIC_THRESHOLD <= 1):
    raise ValueError("MUSIC_THRESHOLD must be between 0 and 1")

# Radio stations configuration
DEFAULT_STATIONS = [
    ("France Inter", "https://direct.franceinter.fr/live/franceinter-midfi.mp3"),
    ("Mosaique FM", "https://radio.mosaiquefm.net/mosalive"),
    ("Radio Nationale", "https://radio.radiotunisienne.tn/nationale"),
    ("Diwan FM", "https://streaming.diwanfm.net/stream"),
    ("Zaitouna FM", "https://radio.radiotunisienne.tn/radiozaitouna"),
    ("Express FM", "https://expressfm.ice.infomaniak.ch/expressfm-64.mp3"),
    ("Radio Jeunes", "http://rtstream.tanitweb.com/jeunes"),
    ("RTCI", "http://rtstream.tanitweb.com/rtci"),
    ("Radio Sfax", "http://rtstream.tanitweb.com/sfax"),
    ("Radio Monastir", "http://rtstream.tanitweb.com/monastir"),
    ("Oxygene FM", "https://streaming.radiooxygene.tn/oxygenefm"),
    ("Radio Le Kef", "https://radio.radiotunisienne.tn/kef"),
    ("Radio MFM", "https://stream.zeno.fm/ilg7ocmkwfgtv.m3u"),
    ("Culturelle RT", "http://rtstream.tanitweb.com/culturelle"),
    ("Knooz FM", "http://streaming.knoozfm.net:8000/knoozfm"),
    ("Misk FM", "https://live.misk.art/stream"),
    ("IFM", "https://live.ifm.tn/radio/8000/ifmlive"),
]

# Select radio station
ENV_RADIO_NAME = os.getenv("RADIO_NAME")
ENV_RADIO_URL = os.getenv("RADIO_URL")
if ENV_RADIO_NAME and ENV_RADIO_URL:
    SINGLE_STATION = (ENV_RADIO_NAME, ENV_RADIO_URL)
else:
    SINGLE_STATION = ("IFM", "https://live.ifm.tn/radio/8000/ifmlive")

# Shazam API configuration
SHAZAM_API_URL = "https://shazam.p.rapidapi.com/songs/detect"
SHAZAM_HEADERS = {
    "content-type": "text/plain",
    "X-RapidAPI-Key": API_KEY,
    "X-RapidAPI-Host": "shazam.p.rapidapi.com"
}

# Local catalog fingerprint engine (Shazam-style landmark matching)
AUDIO_ENGINE_DIR = Path(__file__).resolve().parent / 'audio_engine'
AUDIO_ENGINE_DB = os.getenv('AUDIO_ENGINE_DB', str(AUDIO_ENGINE_DIR / 'evaluation.db'))
ENGINE_MIN_CONFIDENCE = float(os.getenv('ENGINE_MIN_CONFIDENCE', '0.15'))
sys.path.insert(0, str(AUDIO_ENGINE_DIR))
engine_infer_lock = threading.Lock()

# Catalog expansion: when the engine misses a song but Shazam finds it,
# download the song (yt-dlp) and fingerprint it into the local DB so the
# next airplay is matched locally without any external API call.
CATALOG_DOWNLOADS_DIR = AUDIO_ENGINE_DIR / 'Dataset'
CATALOG_INDEXING_DIR = AUDIO_ENGINE_DIR / '.indexing'
CATALOG_MAX_DURATION_S = int(os.getenv('CATALOG_MAX_DURATION_S', '900'))
catalog_queue: "queue.Queue" = queue.Queue()
catalog_pending_jobs = set()
catalog_pending_lock = threading.Lock()
engine_db_lock = threading.Lock()

# Rate limiting for API calls
class RateLimiter:
    def __init__(self, min_interval: float = 1.0):
        self.min_interval = min_interval
        self.last_call = 0
        self._lock = threading.Lock()
    
    def wait_if_needed(self):
        with self._lock:
            now = time.time()
            elapsed = now - self.last_call
            if elapsed < self.min_interval:
                sleep_time = self.min_interval - elapsed
                time.sleep(sleep_time)
            self.last_call = time.time()

shazam_rate_limiter = RateLimiter(1.5)  # 1.5 seconds between Shazam calls

# Model loading with better error handling
class ModelManager:
    def __init__(self):
        self.music_model = None
        self.yamnet_model = None
        self._yamnet_lock = threading.Lock()
        # Use a project-local TF Hub cache to avoid system Temp corruption
        self.tfhub_cache_dir = Path('./backend/model/tfhub_cache').resolve()
    
    def load_music_model(self):
        model_path = os.getenv('MODEL_PATH', './backend/model/music_classifier_model.h5')
        if not os.path.exists(model_path):
            raise FileNotFoundError(
                f"Music classifier not found at {model_path}. "
                "Set MODEL_PATH or copy music_classifier_model.h5 into backend/model/."
            )
        try:
            logger.info(f"Loading music classifier from {model_path}")
            self.music_model = load_model(model_path, compile=False)
            logger.info("Music classifier loaded successfully")
            return self.music_model
        except Exception as e:
            logger.error(f"Failed to load model from {model_path}: {e}")
            raise
    
    def load_yamnet_model(self):
        if self.yamnet_model is None:
            with self._yamnet_lock:
                if self.yamnet_model is None:
                    try:
                        # Ensure local TF Hub cache directory
                        try:
                            self.tfhub_cache_dir.mkdir(parents=True, exist_ok=True)
                            os.environ['TFHUB_CACHE_DIR'] = str(self.tfhub_cache_dir)
                            logger.info(f"Loading YAMNet model... (cache={self.tfhub_cache_dir})")
                        except Exception:
                            logger.info("Loading YAMNet model...")
                        self.yamnet_model = hub.load('https://tfhub.dev/google/yamnet/1')
                        logger.info("YAMNet model loaded successfully")
                    except Exception as e:
                        logger.error(f"Failed to load YAMNet: {e}")
                        # If cache is corrupted, clear local cache and retry once
                        try:
                            if self.tfhub_cache_dir.exists():
                                shutil.rmtree(self.tfhub_cache_dir, ignore_errors=True)
                                self.tfhub_cache_dir.mkdir(parents=True, exist_ok=True)
                                os.environ['TFHUB_CACHE_DIR'] = str(self.tfhub_cache_dir)
                                logger.info("Retrying YAMNet load after clearing local TF Hub cache...")
                                self.yamnet_model = hub.load('https://tfhub.dev/google/yamnet/1')
                                logger.info("YAMNet model loaded successfully on retry")
                            else:
                                self.yamnet_model = None
                        except Exception as e2:
                            logger.error(f"Second attempt to load YAMNet failed: {e2}")
                            self.yamnet_model = None
        return self.yamnet_model

model_manager = ModelManager()
music_model = model_manager.load_music_model()
music_infer_lock = threading.Lock()   # serialize classifier calls across station threads
yamnet_infer_lock = threading.Lock()  # serialize YAMNet inference across station threads

# Audio processing utilities
def resolve_playlist_url(url: str, timeout: int = 5) -> str:
    """Resolve .m3u playlist URLs to direct stream URLs"""
    if not url.endswith(".m3u"):
        return url
    
    try:
        logger.info(f"Resolving playlist URL: {url}")
        response = requests.get(url, timeout=timeout)
        response.raise_for_status()
        
        for line in response.text.splitlines():
            line = line.strip()
            if line.startswith("http"):
                logger.info(f"Resolved to: {line}")
                return line
    except Exception as e:
        logger.error(f"Failed to resolve .m3u playlist: {e}")
    
    return url

def start_ffmpeg_segmenter(station_name: str, url: str, segment_dir: Path) -> Optional[subprocess.Popen]:
    """Start FFmpeg process for continuous audio segmentation"""
    url = resolve_playlist_url(url)
    output_pattern = str(segment_dir / "seg_%09d.wav")
    
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error",
        "-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "5",
        "-i", url,
        "-vn", "-ac", "1", "-ar", str(SAMPLE_RATE),  # Use consistent 16kHz
        "-f", "segment", "-segment_time", "1", "-reset_timestamps", "1",
        output_pattern
    ]
    
    try:
        proc = subprocess.Popen(cmd)
        logger.info(f"Started FFmpeg segmenter for {station_name}")
        return proc
    except Exception as e:
        logger.error(f"Failed to start segmenter: {e}")
        return None

@contextmanager
def temporary_file(suffix: str = ".wav"):
    """Context manager for temporary files"""
    tmp_path = Path(RECORDINGS_DIR) / f"temp_{uuid.uuid4().hex[:8]}{suffix}"
    try:
        yield tmp_path
    finally:
        try:
            tmp_path.unlink(missing_ok=True)
        except Exception as e:
            logger.warning(f"Failed to cleanup temporary file {tmp_path}: {e}")

def wait_for_file_stable(filepath: Path, timeout: float = 2.0) -> bool:
    """Wait for file to be completely written"""
    try:
        if not filepath.exists():
            return False
        
        initial_size = filepath.stat().st_size
        time.sleep(0.1)
        final_size = filepath.stat().st_size
        
        return initial_size == final_size and final_size > 0
    except Exception:
        return False

def get_stable_segments(n: int = 5, retries: int = 3, segment_dir: Optional[Path] = None) -> List[Path]:
    """Get n stable segment files, avoiding the most recent one"""
    segment_dir = segment_dir or SEGMENTS_ROOT
    for attempt in range(retries):
        try:
            files = list(segment_dir.glob("seg_*.wav"))
            files.sort()
            
            if len(files) < n + 1:
                time.sleep(0.3)
                continue
            
            # Skip the newest file to avoid partial writes
            candidates = files[-(n+1):-1]
            
            # Check if all files are stable
            if all(wait_for_file_stable(f) for f in candidates):
                return candidates
                
        except Exception as e:
            logger.warning(f"Error getting stable segments (attempt {attempt + 1}): {e}")
        
        time.sleep(0.2)
    
    return []

def build_five_second_window(segment_files: List[Path], out_dir: Optional[Path] = None) -> Optional[Path]:
    """Concatenate 1-second segments into a 5-second window"""
    try:
        combined = None
        for file_path in segment_files:
            segment = AudioSegment.from_wav(str(file_path))
            combined = segment if combined is None else combined + segment
        
        if combined is None:
            return None
        
        with temporary_file() as tmp_path:
            combined.export(str(tmp_path), format="wav")
            # Return a permanent file instead of temporary
            permanent_path = (out_dir or Path(RECORDINGS_DIR)) / f"window_{uuid.uuid4().hex}.wav"
            tmp_path.rename(permanent_path)
            return permanent_path
            
    except Exception as e:
        logger.error(f"Failed to build 5-second window: {e}")
        return None

def cleanup_old_segments(keep_recent: int = 30, segment_dir: Optional[Path] = None):
    """Clean up old segment files, keeping only the most recent ones.
    Skips very recent files and gracefully ignores locked files on Windows.
    """
    try:
        files = list((segment_dir or SEGMENTS_ROOT).glob("seg_*.wav"))
        files.sort()

        to_delete = files[:-keep_recent]
        now = time.time()

        for file_path in to_delete:
            try:
                # Skip files modified in the last 3 seconds to avoid lock races
                if now - file_path.stat().st_mtime < 3:
                    continue
                file_path.unlink()
            except PermissionError as e:
                # Likely locked (e.g., ffmpeg still finalizing). Retry once shortly, then skip
                try:
                    time.sleep(0.2)
                    file_path.unlink()
                except Exception:
                    logger.debug(f"Skip locked file {file_path}: {e}")
            except Exception as e:
                logger.warning(f"Failed to delete {file_path}: {e}")
    except Exception as e:
        logger.warning(f"Cleanup failed: {e}")

# Feature extraction
def extract_mfcc_features(file_path: Path) -> Optional[np.ndarray]:
    """Extract MFCC features from audio file"""
    try:
        signal, sr = librosa.load(str(file_path), sr=SAMPLE_RATE, duration=DURATION)
        
        if len(signal) == 0:
            logger.warning(f"Empty audio signal from {file_path}")
            return None
        
        mfcc = librosa.feature.mfcc(y=signal, sr=sr, n_mfcc=MFCC_FEATURES)
        
        # Pad or truncate to consistent length
        if mfcc.shape[1] < MAX_PAD_LEN:
            padding = MAX_PAD_LEN - mfcc.shape[1]
            mfcc = np.pad(mfcc, ((0, 0), (0, padding)), mode='constant')
        else:
            mfcc = mfcc[:, :MAX_PAD_LEN]
        
        return mfcc.T
        
    except Exception as e:
        logger.error(f"Feature extraction failed for {file_path}: {e}")
        return None

def convert_audio_to_base64(file_path: Path) -> Optional[str]:
    """Convert audio file to base64 for Shazam API"""
    try:
        audio = AudioSegment.from_wav(str(file_path))
        
        # Ensure format compatibility for Shazam
        audio = audio[:5000].set_channels(1).set_frame_rate(44100).set_sample_width(2)
        
        raw_data = np.frombuffer(audio.raw_data, dtype=np.int16)
        return base64.b64encode(raw_data.tobytes()).decode()
        
    except Exception as e:
        logger.error(f"Base64 conversion failed for {file_path}: {e}")
        return None

# YAMNet utilities
def compute_yamnet_embedding(file_path: Path) -> Optional[np.ndarray]:
    """Compute YAMNet embedding for audio similarity"""
    try:
        yamnet_model = model_manager.load_yamnet_model()
        if yamnet_model is None:
            return None
        
        # Load audio at YAMNet's expected sample rate
        waveform, _ = librosa.load(str(file_path), sr=16000, mono=True, duration=DURATION)
        waveform = waveform.astype('float32')
        if len(waveform) == 0:
            return None
        
        with yamnet_infer_lock:
            _, embeddings, _ = yamnet_model(waveform)
        embeddings_np = embeddings.numpy()
        
        if embeddings_np.size == 0:
            return None
        
        # Return mean embedding across time patches
        return np.mean(embeddings_np, axis=0)
        
    except Exception as e:
        logger.error(f"YAMNet embedding failed for {file_path}: {e}")
        return None

def cosine_similarity(vec_a: Optional[np.ndarray], vec_b: Optional[np.ndarray]) -> float:
    """Compute cosine similarity between two vectors"""
    try:
        if vec_a is None or vec_b is None:
            return 0.0
        
        norm_a = np.linalg.norm(vec_a)
        norm_b = np.linalg.norm(vec_b)
        
        if norm_a == 0 or norm_b == 0:
            return 0.0
        
        return float(np.dot(vec_a, vec_b) / (norm_a * norm_b))
        
    except Exception as e:
        logger.error(f"Cosine similarity calculation failed: {e}")
        return 0.0

# Shazam API utilities
def call_shazam_api(audio_base64: str) -> Optional[Dict]:
    """Call Shazam API with rate limiting and error handling"""
    try:
        shazam_rate_limiter.wait_if_needed()
        
        response = requests.post(
            SHAZAM_API_URL,
            data=audio_base64,
            headers=SHAZAM_HEADERS,
            timeout=10
        )
        
        if response.status_code == 200:
            return response.json()
        elif response.status_code == 429:
            logger.warning("Shazam API rate limit hit")
            time.sleep(5)  # Back off on rate limit
        else:
            logger.error(f"Shazam API error: {response.status_code}")
        
        return None
        
    except Exception as e:
        logger.error(f"Shazam API call failed: {e}")
        return None

# Local fingerprint engine utilities
def identify_with_shazam_com(file_path) -> Optional[Dict]:
    """shazam-api.com recognize fallback (independent quota pool from RapidAPI).

    Returns a Shazam-shaped dict or None."""
    try:
        import tempfile
        import subprocess as _sp
        import requests as _requests

        with tempfile.TemporaryDirectory() as td:
            out = Path(td) / 'clip.wav'
            cmd = ['ffmpeg', '-y', '-i', str(file_path), '-ss', '0', '-t', '12',
                   '-ac', '1', '-ar', '32000', str(out)]
            _sp.run(cmd, capture_output=True)
            if not out.exists():
                return None
            wav = out.read_bytes()

        com_key = os.getenv('SHAZAM_API_COM_KEY') or config.get('SHAZAM_API_COM_KEY')
        if not com_key:
            return None
        r = _requests.post(
            'https://shazam-api.com/api/v2/recognize',
            headers={'Authorization': f'Bearer {com_key}'},
            files={'file': ('clip.wav', wav, 'audio/wav')},
            timeout=40,
        )
        body = r.json() if r.status_code == 200 and r.json().get('status') else {}
        uuid = body.get('uuid') or ''
        poll = 0
        while body.get('status') == 'processing' and poll < 5:
            time.sleep(1.5)
            rr = _requests.get(f'https://shazam-api.com/api/v2/results/{uuid}',
                               headers={'Authorization': f'Bearer {com_key}'},
                               timeout=15)
            body = rr.json() if rr.status_code == 200 else {}
            poll += 1
        if body.get('status') != 'success' or not body.get('results'):
            return None
        res = body['results'][0]
        track = {
            'title': res.get('title', ''),
            'subtitle': res.get('artist', ''),
            'sections': [{'metadata': (
                ([{'title': 'Album', 'text': res['album']}] if res.get('album') else []) +
                ([{'title': 'Label', 'text': res['label']}] if res.get('label') else [])
            )}],
        }
        logger.info(f"🎯 shazam-api.com identified: '{track['title']}' - {track['subtitle']}")
        return {'track': track, 'matches': [{}]}
    except Exception as e:
        logger.error(f"shazam-api.com identification failed: {e}")
        return None

def identify_with_engine(file_path) -> Optional[Dict]:
    """Identify a segment against the local catalog database.

    Returns a Shazam-shaped dict ({'track': {...}, 'matches': [...]}) plus an
    'engine_song_id' key, or None when the engine finds no confident match
    (caller should fall back to the Shazam API)."""
    try:
        import audio as engine_audio
        import fingerprint as engine_fp
        import matcher as engine_matcher

        with engine_infer_lock:
            waveform, sample_rate = engine_audio.load_audio(file_path)
            query_fingerprints = engine_fp.fingerprint_audio(waveform, sample_rate=sample_rate)
            if not query_fingerprints:
                logger.info("🔎 Engine produced no fingerprints for segment")
                return None
            results = engine_matcher.identify(
                query_fingerprints,
                db_path=AUDIO_ENGINE_DB,
                min_confidence=ENGINE_MIN_CONFIDENCE,
            )

        if not results:
            return None

        best = results[0]
        logger.info(f"🎯 Engine match: '{best.title}' - '{best.artist}' "
                    f"(song_id={best.song_id}, confidence={best.confidence:.2f}, "
                    f"inliers={best.match_count}, offset={best.offset_ms}ms)")
        return {
            'track': {
                'title': best.title,
                'subtitle': best.artist,
                'sections': [{'metadata': [{'text': best.album or 'Unknown Album'}]}],
            },
            'engine_song_id': best.song_id,
            'matches': [{'confidence': best.confidence}],
        }
    except Exception as e:
        logger.error(f"Fingerprint engine identification failed: {e}")
        return None

# Catalog expansion: Shazam metadata -> yt-dlp download -> fingerprint into local DB
def _engine_song_id_for_title(title: str) -> Optional[int]:
    import db as engine_db
    with engine_db_lock:
        return engine_db.get_song_id_by_title(title, db_path=AUDIO_ENGINE_DB)

def enqueue_catalog_job(title: str, artist: str, album: Optional[str] = None):
    """Queue a download-catalog job for a Shazam-identified song missing from the local DB"""
    title = (title or '').strip()
    artist = (artist or '').strip()
    if not title or not artist:
        return False
    job_key = f"{title}|{artist}".lower()
    with catalog_pending_lock:
        if job_key in catalog_pending_jobs:
            return False
        catalog_pending_jobs.add(job_key)
        catalog_queue.put((title, artist, album))
    return True

def _sanitize_filename(name: str) -> str:
    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', name).strip().strip('.')
    return name[:150] or 'untitled'

def _ytdlp_json(search_query: str, work_dir: Path) -> list:
    """Query YouTube search results metadata (id, duration, title) without downloading"""
    import subprocess as _subprocess
    cmd = [
        sys.executable, '-m', 'yt_dlp',
        search_query,
        '--flat-playlist', '--dump-json',
        '--no-warnings',
    ]
    try:
        proc = _subprocess.run(cmd, capture_output=True, text=True, timeout=120,
                               cwd=str(work_dir))
    except Exception as e:
        logger.error(f"Catalog: search failed for '{search_query}': {e}")
        return []

    import json as _json
    results = []
    for line in (proc.stdout or '').splitlines():
        line = line.strip()
        if not line.startswith('{'):
            continue
        try:
            entry = _json.loads(line)
        except _json.JSONDecodeError:
            continue
        results.append({
            'id': entry.get('id'),
            'duration': entry.get('duration'),
            'title': entry.get('title', ''),
        })
    return results

def _tokenize_for_match(text: str) -> set:
    words = re.findall(r'[a-z0-9\u0600-\u06ff\u00c0-\u024f]{3,}', (text or '').lower())
    stop = {'video', 'official', 'lyrics', 'audio', 'hd', 'hq', 'feat', 'music', 'clip',
            'remaster', 'remastered', 'version', 'full', 'the'}
    return {w for w in words if w not in stop}

def _pick_candidate_url(results: list, title: str, artist: str) -> Optional[str]:
    """Choose the result whose video title best overlaps with the query artist+title.
    Requires at least one meaningful token from the song title to be present."""
    title_tokens = _tokenize_for_match(title)
    query_tokens = _tokenize_for_match(f"{artist} {title}")

    def score(r):
        video_tokens = _tokenize_for_match(r.get('title', ''))
        song_overlap = len(title_tokens & video_tokens)
        artist_overlap = len(query_tokens & video_tokens)
        return (song_overlap, artist_overlap, -abs(220 - (r.get('duration') or 0)))

    candidates = [r for r in results
                  if r.get('id') and r.get('duration') is not None
                  and 80 <= r['duration'] <= CATALOG_MAX_DURATION_S]
    # Veto requires a non-numeric title token so shared "2010" alone can't admit a wrong track
    alpha_title_tokens = {t for t in title_tokens if not t.isdigit()}
    viable = [r for r in candidates
              if alpha_title_tokens & _tokenize_for_match(r.get('title', ''))]
    if not viable:
        logger.warning(f"Catalog: no title-overlapping YouTube candidate for '{artist} - {title}' "
                       f"(had {len(candidates)} duration-viable results)")
        return None
    best = max(viable, key=score)
    logger.info(f"Catalog: chose YouTube candidate '{best['title']}' "
                f"({best['duration']}s, id={best['id']})")
    return f"https://www.youtube.com/watch?v={best['id']}"

def download_and_catalog(title: str, artist: str, album: Optional[str] = None) -> Optional[int]:
    """Download a song with yt-dlp, fingerprint it, and add it to the engine DB.

    Returns the new song_id, or None on any failure / if already cataloged."""
    import subprocess as _subprocess
    import audio as engine_audio
    import fingerprint as engine_fp
    import db as engine_db

    # Dedupe (also re-checked later inside the DB lock to close any race)
    existing = _engine_song_id_for_title(title)
    if existing is not None:
        logger.info(f"📥 Catalog: '{title}' already in engine DB (song_id={existing}) - skipping")
        return None

    work_dir = CATALOG_INDEXING_DIR / uuid.uuid4().hex
    work_dir.mkdir(parents=True, exist_ok=True)

    query = f"ytsearch5:{artist} - {title}"
    results = _ytdlp_json(query, work_dir)
    target_url = _pick_candidate_url(results, title, artist)
    if not target_url:
        logger.warning(f"Catalog: no plausible YouTube candidate for '{artist} - {title}'")
        return None

    out_template = str(work_dir / '%(title).150s [%(id)s].%(ext)s')
    cmd = [
        sys.executable, '-m', 'yt_dlp',
        target_url,
        '--extract-audio', '--audio-format', 'mp3', '--audio-quality', '0',
        '--no-playlist', '--no-warnings',
        '-o', out_template,
    ]
    logger.info(f"📥 Catalog: downloading '{artist} - {title}'")
    try:
        proc = _subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        downloaded = list(work_dir.glob('*.mp3'))
        if proc.returncode != 0 or not downloaded:
            logger.warning(f"Catalog: yt-dlp failed for '{artist} - {title}' "
                           f"(code={proc.returncode}): {(proc.stderr or '')[-300:]}")
            return None
        audio_file = downloaded[0]

        waveform, sample_rate = engine_audio.load_audio(audio_file)
        duration_ms = int(len(waveform) / sample_rate * 1000)
        if duration_ms < 15_000:
            logger.warning(f"Catalog: downloaded file too short ({duration_ms}ms) - discarding")
            return None
        if duration_ms > CATALOG_MAX_DURATION_S * 1000:
            logger.warning(f"Catalog: downloaded file too long ({duration_ms}ms) - discarding")
            return None

        with engine_db_lock:
            # Re-check for a concurrent insert of the same title
            existing = engine_db.get_song_id_by_title(title, db_path=AUDIO_ENGINE_DB)
            if existing is not None:
                logger.info(f"📥 Catalog: '{title}' already in engine DB (song_id={existing})")
                return None
            song_id = engine_db.insert_song(title, artist, duration_ms, album=album,
                                            db_path=AUDIO_ENGINE_DB)
            fingerprints = engine_fp.fingerprint_audio(waveform, song_id=song_id,
                                                       sample_rate=sample_rate)
            inserted = engine_db.insert_fingerprints(song_id, fingerprints, duration_ms,
                                                     db_path=AUDIO_ENGINE_DB)

        final_path = CATALOG_DOWNLOADS_DIR / f"{_sanitize_filename(title)}.mp3"
        if final_path.exists():
            final_path = CATALOG_DOWNLOADS_DIR / f"{_sanitize_filename(title)} - {artist}.mp3"
        shutil.move(str(audio_file), str(final_path))

        logger.info(f"📦 Catalog: added '{title}' - '{artist}' (song_id={song_id}, "
                    f"{inserted} fingerprints, {duration_ms/1000:.0f}s)")
        return song_id

    except Exception as e:
        logger.error(f"Catalog: failed to catalog '{artist} - {title}': {e}")
        return None
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)

def _catalog_startup_check() -> bool:
    """Check that yt-dlp is importable; log a warning when cataloging is disabled"""
    import importlib.util
    if importlib.util.find_spec('yt_dlp') is None:
        logger.warning("yt-dlp is not installed - catalog expansion disabled")
        return False
    return True

def catalog_worker():
    """Background worker: drains the catalog queue (downloads + fingerprinting)"""
    logger.info("📦 Catalog worker started")
    while True:
        job = None
        try:
            title, artist, album = catalog_queue.get()
            job = (title, artist, album)
            download_and_catalog(title, artist, album)
        except Exception as e:
            logger.error(f"Catalog worker error on {job}: {e}")
        finally:
            if job:
                with catalog_pending_lock:
                    catalog_pending_jobs.discard(f"{job[0]}|{job[1]}".lower())
            catalog_queue.task_done()

def start_catalog_worker():
    t = threading.Thread(target=catalog_worker, name='catalog-worker', daemon=True)
    t.start()

# Extended song details: capture Shazam's writers/label/release/genres/artwork
SONG_DETAILS_API = "http://127.0.0.1:8000/api/songdetails/"
details_queue: "queue.Queue" = queue.Queue()
details_sent = set()
details_sent_lock = threading.Lock()

def _extract_extended_details(track: Dict) -> Dict:
    """Parse everything useful out of a Shazam track payload (detect response)."""
    details = {
        'title': track.get('title', ''),
        'artist': track.get('subtitle', ''),
        'album': '', 'label': '', 'released': '',
        'writers': [], 'performers': [], 'genres': [],
        'artwork_url': '', 'shazam_key': str(track.get('key', '') or ''),
        'raw': track,
    }
    try:
        sections = track.get('sections', [])
        if sections:
            for item in sections[0].get('metadata', []):
                key = (item.get('title') or item.get('Title') or '').lower()
                text = item.get('text') or item.get('Text') or ''
                if key == 'album':
                    details['album'] = text
                elif key in ('label', 'record label'):
                    details['label'] = text
                elif key in ('released', 'releasedate', 'release date'):
                    details['released'] = text
                elif key == 'writer':
                    if text and text not in details['writers']:
                        details['writers'].append(text)
        artists = track.get('artists') or []
        for a in artists:
            name = a.get('name') if isinstance(a, dict) else None
            if name:
                details['performers'].append(name)
        images = track.get('images') or {}
        details['artwork_url'] = (images.get('coverarthq')
                                  or images.get('coverart') or '')
    except Exception as e:
        logger.error(f"Details parse failed for '{details['title']}': {e}")
    return details

def enqueue_details_job(track: Dict):
    details = _extract_extended_details(track)
    if not details['title'] or not details['artist']:
        return
    key = (details['title'], details['artist'])
    with details_sent_lock:
        if key in details_sent:
            return
        details_sent.add(key)
    details_queue.put(details)

def details_worker():
    """Background worker: POST extracted details to /api/songdetails/"""
    logger.info("💿 Details worker started")
    while True:
        job = None
        try:
            details = details_queue.get()
            job = details
            resp = requests.post(
                SONG_DETAILS_API,
                json=details,
                headers={"Content-Type": "application/json"},
                timeout=5,
            )
            if resp.status_code in (200, 201):
                logger.info(f"💿 Details stored for '{details['title']} - {details['artist']}'")
            else:
                logger.warning(f"Details POST failed ({resp.status_code}): {resp.text[:200]}")
        except Exception as e:
            logger.error(f"Details worker error on {job}: {e}")
        finally:
            if job:
                with details_sent_lock:
                    details_sent.discard((job['title'], job['artist']))
            details_queue.task_done()

def start_details_worker():
    t = threading.Thread(target=details_worker, name='details-worker', daemon=True)
    t.start()

def get_song_identity(song_data: Dict) -> str:
    """Extract unique song identity from Shazam response"""
    try:
        engine_song_id = song_data.get('engine_song_id')
        if engine_song_id is not None:
            return f"engine:{engine_song_id}"

        track = song_data.get('track', {})
        
        # Try Shazam's unique identifiers first
        for key in ['key', 'adamid', 'isrc']:
            value = track.get(key)
            if value:
                return f"{key}:{value}"
        
        # Fallback to title + artist
        title = (track.get('title', '') or '').strip().lower()
        artist = (track.get('subtitle', '') or '').strip().lower()
        
        if title or artist:
            return f"title:{title}|artist:{artist}"
        
        return ""
        
    except Exception as e:
        logger.error(f"Failed to extract song identity: {e}")
        return ""

# Database utilities
def _extract_track_info(track: Dict) -> Tuple[str, str, str]:
    """Extract (title, artist, album) safely from a Shazam track object"""
    title = track.get('title', 'Unknown Title')
    artist = track.get('subtitle', 'Unknown Artist')
    album = "Unknown Album"
    try:
        sections = track.get("sections", [])
        if sections:
            metadata = sections[0].get("metadata", [])
            if metadata:
                album = metadata[0].get("text", "Unknown Album")
    except (IndexError, KeyError, TypeError):
        pass
    return title, artist, album

# (radio_name, song_identity) -> latest saved row {id, start_time, last_end}
# Used to merge re-detected fragments of the same song into a single DB row
song_row_registry = {}
song_row_registry_lock = threading.Lock()

def _upsert_song_row(song_data: Dict, radio_name: str, start_time: datetime, 
                     end_time: datetime, duration: timedelta) -> Optional[int]:
    """Save a completed song play. If the same song on the same radio was saved
    very recently, extend (PATCH) the previous row instead of inserting a
    duplicate fragment."""
    try:
        track = song_data['track']
        title, artist, album = _extract_track_info(track)
        identity = get_song_identity(song_data)
        base_payload = lambda st, et, du: {
            "title": title,
            "artist": artist,
            "album": album,
            "radio_name": radio_name,
            "start_time": st.isoformat(),
            "end_time": et.isoformat(),
            "duration": str(du),
        }

        # Try merging with a recent row of the same song on the same station
        key = (radio_name, identity)
        with song_row_registry_lock:
            recent = song_row_registry.get(key)
        if (recent and identity and recent.get('id') and
                start_time - recent['last_end'] < timedelta(seconds=SONG_MERGE_WINDOW)
                and start_time - recent['last_end'] >= timedelta(0)):
            try:
                merged_start = min(recent['start_time'], start_time)
                merged_end = max(recent['last_end'], end_time)
                merged_duration = merged_end - merged_start
                response = requests.patch(
                    f"http://127.0.0.1:8000/api/songplayed/{recent['id']}/",
                    json=base_payload(merged_start, merged_end, merged_duration),
                    headers={"Content-Type": "application/json"},
                    timeout=5)
                if response.status_code == 200:
                    logger.info(f"🔗 Merged fragment: {title} on {radio_name} "
                                f"(total {merged_duration})")
                    with song_row_registry_lock:
                        song_row_registry[key] = {
                            'id': recent['id'],
                            'start_time': merged_start,
                            'last_end': merged_end,
                        }
                    return recent['id']
                logger.warning(f"Merge PATCH failed ({response.status_code}) - inserting new row")
            except Exception as e:
                logger.warning(f"Merge PATCH exception: {e} - inserting new row")

        response = requests.post(
            "http://127.0.0.1:8000/api/songplayed/",
            json=base_payload(start_time, end_time, duration),
            headers={"Content-Type": "application/json"},
            timeout=5
        )
        
        if response.status_code == 201:
            data = response.json()
            row_id = data.get("id")
            if identity:
                with song_row_registry_lock:
                    song_row_registry[key] = {
                        'id': row_id,
                        'start_time': start_time,
                        'last_end': end_time,
                    }
            logger.info(f"✅ Saved: {title} by {artist} on {radio_name} (duration {duration})")
            return row_id
        else:
            logger.error(f"Database save failed: {response.status_code} - {response.text}")
            return None
            
    except Exception as e:
        logger.error(f"Database save exception: {e}")
        return None

# Main processing class
class RadioMusicDetector:
    def __init__(self, radio_name: str, radio_url: str):
        self.radio_name = radio_name
        self.radio_url = radio_url
        self.segmenter_process = None
        self.segment_dir = station_segment_dir(radio_name)
        self.segment_dir.mkdir(parents=True, exist_ok=True)
        self._restart_cooldown = 0.0
        
        # State tracking
        self.is_music_playing = False
        self.song_start_time = None
        self.current_song_data = None
        self.current_song_identity = None
        self.reference_embedding = None
        self.mismatch_count = 0
        self.last_processed_index = -1
        self.non_music_streak = 0
        
        # Start segmenter
        self.segmenter_process = start_ffmpeg_segmenter(radio_name, radio_url, self.segment_dir)
        if self.segmenter_process is None:
            raise RuntimeError("Failed to start audio segmenter")
    
    def cleanup(self):
        """Clean up resources"""
        if self.segmenter_process:
            self.segmenter_process.terminate()
            try:
                self.segmenter_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.segmenter_process.kill()
    
    def classify_music_segment(self, file_path: Path) -> Tuple[bool, Optional[float]]:
        """Classify if audio segment contains music"""
        mfcc = extract_mfcc_features(file_path)
        if mfcc is None:
            return False, None
        
        try:
            with music_infer_lock:
                prediction = music_model.predict(np.expand_dims(mfcc, axis=0), verbose=0)
            
            # Extract music probability
            music_prob = float(prediction[0][1]) if prediction.shape[1] > 1 else float(prediction[0][0])
            is_music = music_prob >= MUSIC_THRESHOLD
            
            return is_music, music_prob
            
        except Exception as e:
            logger.error(f"Music classification failed: {e}")
            return False, None
    
    def handle_music_start(self, file_path: Path):
        """Handle transition from non-music to music"""
        self.song_start_time = datetime.now(timezone.utc)
        self.is_music_playing = True
        self.current_song_data = None
        self.current_song_identity = None
        self.reference_embedding = None
        self.mismatch_count = 0
        
        logger.info(f"🎵 Song started at {self.song_start_time.isoformat()}")

        # Set reference embedding and try identification (engine first, Shazam fallback)
        self.reference_embedding = compute_yamnet_embedding(file_path)

        song_data = identify_with_engine(file_path)
        if song_data and song_data.get('matches'):
            self.current_song_data = song_data
            self.current_song_identity = get_song_identity(song_data)
            logger.info("🎯 Engine identified the song at start")
        else:
            song_data = identify_with_shazam_com(file_path)
            audio_base64 = None
            if not song_data:
                audio_base64 = convert_audio_to_base64(file_path)
                if audio_base64:
                    song_data = call_shazam_api(audio_base64)
            if song_data and song_data.get('matches'):
                self.current_song_data = song_data
                self.current_song_identity = get_song_identity(song_data)
                track = song_data.get('track', {})
                enqueue_catalog_job(track.get('title'), track.get('subtitle'),
                                    _extract_track_info(track)[2])
                enqueue_details_job(track)
                logger.info("🎯 Shazam identified the song at start")
            else:
                logger.info("❌ No engine or Shazam match at song start")
        
        cleanup_old_segments(keep_recent=10, segment_dir=self.segment_dir)
    
    def handle_music_end(self):
        """Handle transition from music to non-music"""
        if not self.is_music_playing:
            return
        
        end_time = datetime.now(timezone.utc)
        duration = end_time - self.song_start_time if self.song_start_time else timedelta(0)
        
        logger.info(f"🏁 Song ended at {end_time.isoformat()} (duration {duration})")
        
        # Save to database if identified
        if self.current_song_data:
            _upsert_song_row(
                self.current_song_data,
                self.radio_name,
                self.song_start_time,
                end_time,
                duration
            )
        
        # Reset state
        self.is_music_playing = False
        self.song_start_time = None
        self.current_song_data = None
        self.current_song_identity = None
        self.reference_embedding = None
        self.mismatch_count = 0
        self.non_music_streak = 0
        
        cleanup_old_segments(keep_recent=5, segment_dir=self.segment_dir)
    
    def handle_song_boundary(self, file_path: Path, boundary_type: str):
        """Handle detected song boundary within music segment"""
        # Try to identify the new segment (engine first, Shazam fallback)
        new_song_data = identify_with_engine(file_path)
        if new_song_data is None:
            new_song_data = identify_with_shazam_com(file_path)
            if new_song_data is None:
                audio_base64 = convert_audio_to_base64(file_path)
                if audio_base64:
                    fallback = call_shazam_api(audio_base64)
                    if fallback and fallback.get('matches'):
                        new_song_data = fallback
        new_identity = get_song_identity(new_song_data) if new_song_data else None
        
        # Check if it's the same song
        if (new_identity and self.current_song_identity and 
            new_identity == self.current_song_identity):
            # Same song continues
            self.reference_embedding = compute_yamnet_embedding(file_path)
            self.mismatch_count = 0
            logger.info(f"🔄 {boundary_type} boundary ignored (same song identified)")
            return
        
        # Different song - close current and start new
        if self.current_song_data:
            end_time = datetime.now(timezone.utc)
            duration = end_time - self.song_start_time if self.song_start_time else timedelta(0)
            
            _upsert_song_row(
                self.current_song_data,
                self.radio_name,
                self.song_start_time,
                end_time,
                duration
            )
        
        # Start new song
        self.song_start_time = datetime.now(timezone.utc)
        self.reference_embedding = compute_yamnet_embedding(file_path)
        self.mismatch_count = 0
        
        if new_song_data:
            self.current_song_data = new_song_data
            self.current_song_identity = new_identity
            track = new_song_data.get('track', {})
            if new_song_data.get('engine_song_id') is None:
                enqueue_catalog_job(track.get('title'), track.get('subtitle'),
                                    _extract_track_info(track)[2])
                enqueue_details_job(track)
            logger.info("🎯 Shazam identified the new song")
        else:
            self.current_song_data = None
            self.current_song_identity = None
            logger.info("❌ No identification for new song segment")
    
    def process_music_segment(self, file_path: Path):
        """Process a music segment for song boundary detection"""
        current_embedding = compute_yamnet_embedding(file_path)
        
        if self.reference_embedding is None:
            self.reference_embedding = current_embedding
            return
        
        if current_embedding is None:
            return
        
        similarity = cosine_similarity(current_embedding, self.reference_embedding)
        logger.info(f"🧭 YAMNet similarity: {similarity:.3f}")
        
        # Hard cutoff check
        if similarity < YAMNET_HARD_CUTOFF:
            logger.info("🚨 Hard cutoff hit - checking for song change")
            self.handle_song_boundary(file_path, "Hard-cut")
            return
        
        # Strike-based detection
        if similarity >= YAMNET_SIM_THRESHOLD:
            self.mismatch_count = 0
        else:
            self.mismatch_count += 1
            logger.info(f"⚠️ Dissimilar segment (strike {self.mismatch_count}/{YAMNET_MIN_MISMATCHES})")
            
            if self.mismatch_count >= YAMNET_MIN_MISMATCHES:
                logger.info("🔁 Strike threshold reached - checking for song change")
                self.handle_song_boundary(file_path, "Strike-based")
    
    def run(self):
        """Main processing loop"""
        logger.info(f"🎙️ Starting detection for {self.radio_name}")
        
        # Wait for initial segments
        time.sleep(3)
        
        try:
            while True:
                # Restart the segmenter if ffmpeg died (dead stream, dropped connection)
                if self.segmenter_process.poll() is not None:
                    if time.time() >= self._restart_cooldown:
                        logger.warning(f"Segmenter for {self.radio_name} exited "
                                       f"(code {self.segmenter_process.returncode}) - restarting")
                        self.segmenter_process = start_ffmpeg_segmenter(
                            self.radio_name, self.radio_url, self.segment_dir)
                        self._restart_cooldown = time.time() + 30
                        self.last_processed_index = -1  # force re-sync with new segment stream
                    time.sleep(2)
                    continue

                segment_files = get_stable_segments(5, segment_dir=self.segment_dir)
                if len(segment_files) < 5:
                    time.sleep(0.5)
                    continue

                # Check if we have new segments to process
                newest_index = int(segment_files[-1].stem.split('_')[1])
                if newest_index == self.last_processed_index:
                    time.sleep(0.2)
                    continue

                self.last_processed_index = newest_index
                
                # Build 5-second window
                window_file = build_five_second_window(segment_files, out_dir=self.segment_dir)
                if not window_file:
                    time.sleep(0.1)
                    continue

                try:
                    # Classify music vs non-music
                    is_music, music_prob = self.classify_music_segment(window_file)
                    
                    prob_str = f"prob={music_prob:.3f}" if music_prob is not None else "prob=N/A"
                    logger.info(f"🔎 {'MUSIC' if is_music else 'NON-MUSIC'} | {prob_str} | thr={MUSIC_THRESHOLD}")
                    
                    if is_music:
                        self.non_music_streak = 0
                        if not self.is_music_playing:
                            self.handle_music_start(window_file)
                        else:
                            self.process_music_segment(window_file)
                    else:
                        # Debounce: only end the song after several consecutive
                        # non-music windows, so one weak window doesn't split it
                        if self.is_music_playing:
                            self.non_music_streak += 1
                            if self.non_music_streak >= NON_MUSIC_END_STREAK:
                                self.handle_music_end()
                                self.non_music_streak = 0
                        else:
                            self.non_music_streak = 0
                    
                finally:
                    # Clean up window file
                    try:
                        window_file.unlink()
                    except Exception:
                        pass
                
                # Periodic cleanup
                if newest_index % 30 == 0:
                    cleanup_old_segments(keep_recent=30, segment_dir=self.segment_dir)
                    
        except KeyboardInterrupt:
            logger.info("Received interrupt signal, shutting down...")
        except Exception as e:
            logger.error(f"Unexpected error in main loop: {e}")
            raise
        finally:
            self.cleanup()

def _run_station(thread_name: str, radio_name: str, radio_url: str):
    """Thread worker: run a detector for one station, restarting on fatal errors"""
    backoff = 5
    while True:
        try:
            logger.info(f"🎙️ Initializing detector for {radio_name} -> {radio_url}")
            detector = RadioMusicDetector(radio_name, radio_url)
            backoff = 5
            detector.run()  # returns only if loop ended without exception
            logger.info(f"Detection loop for {radio_name} ended")
            break
        except Exception as e:
            logger.error(f"[{thread_name}] Detector for {radio_name} crashed: {e} - retry in {backoff}s")
            time.sleep(backoff)
            backoff = min(backoff * 2, 300)

def main():
    """Main entry point: detect on ALL stations simultaneously"""
    stations = [("Mosaique FM", "https://radio.mosaiquefm.net/mosalive")]
    
    if os.getenv("SINGLE") or (os.getenv("RADIO_NAME") and os.getenv("RADIO_URL")):
        stations = [(os.getenv("RADIO_NAME") or "Mosaique FM",
                     os.getenv("RADIO_URL") or "https://radio.mosaiquefm.net/mosalive")]
    else:
        # Skip stations explicitly disabled via RADIO_DISABLE="IFM,Jawhara FM"
        disabled = {s.strip().lower() for s in os.getenv("RADIO_DISABLE", "").split(",") if s.strip()}
        stations = [st for st in DEFAULT_STATIONS if st[0].strip().lower() not in disabled]

    if _catalog_startup_check():
        start_catalog_worker()
    start_details_worker()

    logger.info(f"🚀 Starting multi-station detector over {len(stations)} stations: "
                f"{', '.join(name for name, _ in stations)}")

    threads = []
    for name, url in stations:
        t = threading.Thread(target=_run_station, args=(name, name, url), daemon=True)
        t.start()
        threads.append(t)
        time.sleep(0.5)  # stagger startups

    try:
        while any(t.is_alive() for t in threads):
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("Received interrupt signal, shutting down...")

    logger.info("All station threads stopped")

if __name__ == "__main__":
    main()