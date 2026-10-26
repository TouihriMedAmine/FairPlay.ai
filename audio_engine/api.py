"""FastAPI service for song upload and audio identification."""

import logging
import tempfile
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, Security, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse
from fastapi.security import APIKeyHeader
from pydantic import BaseModel

import config
from audio import TARGET_SAMPLE_RATE, load_audio
from db import delete_song, get_song, init_db, insert_fingerprints, insert_song
from fingerprint import fingerprint_audio
from matcher import identify

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("shazam.api")

DB_PATH = config.DB_PATH


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db(DB_PATH)
    if not config.API_KEYS:
        logger.warning(
            "SHAZAM_API_KEYS is not set: authentication is DISABLED (dev mode). "
            "Set SHAZAM_API_KEYS in production."
        )
    yield


app = FastAPI(title="Shazam-like Audio Recognition", version="1.1.0", lifespan=lifespan)

_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def require_api_key(api_key: str | None = Security(_api_key_header)) -> None:
    """Enforce API key on mutating endpoints when keys are configured."""
    if not config.API_KEYS:
        return  # dev mode: auth disabled (warned at startup)
    if api_key not in config.API_KEYS:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


# --- Simple in-process rate limiting (per client IP) -----------------------
_request_log: dict[str, deque] = defaultdict(deque)


@app.middleware("http")
async def rate_limit(request: Request, call_next):
    client_ip = request.client.host if request.client else "unknown"
    now = time.monotonic()
    window_start = now - config.RATE_LIMIT_WINDOW_SEC

    bucket = _request_log[client_ip]
    while bucket and bucket[0] < window_start:
        bucket.popleft()

    if len(bucket) >= config.RATE_LIMIT_REQUESTS:
        logger.warning("Rate limit exceeded for %s", client_ip)
        return JSONResponse(status_code=429, content={"detail": "Rate limit exceeded"})

    bucket.append(now)
    return await call_next(request)


# --- Response models --------------------------------------------------------
class UploadResponse(BaseModel):
    song_id: int
    title: str
    artist: str
    duration_ms: int
    fingerprint_count: int
    sample_rate_hz: int


class Match(BaseModel):
    song_id: int
    title: str
    artist: str
    album: str | None
    confidence: float
    offset_ms: int
    match_count: int


class IdentifyResponse(BaseModel):
    matches: list[Match]
    query_duration_ms: int
    processing_time_ms: int
    sample_rate_hz: int


async def _save_upload_to_temp(audio_file: UploadFile) -> str:
    """Stream an upload to a temp file, enforcing the size limit as we go."""
    suffix = Path(audio_file.filename or "audio").suffix.lower()
    if suffix and suffix not in config.ALLOWED_AUDIO_SUFFIXES:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {suffix}")
    if not suffix:
        suffix = ".wav"

    tmp_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp_path = tmp.name
            size = 0
            while chunk := await audio_file.read(config.UPLOAD_CHUNK_BYTES):
                size += len(chunk)
                if size > config.MAX_UPLOAD_BYTES:
                    raise HTTPException(status_code=413, detail="File too large")
                tmp.write(chunk)
        return tmp_path
    except Exception:
        if tmp_path:
            Path(tmp_path).unlink(missing_ok=True)
        raise


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "sample_rate_hz": TARGET_SAMPLE_RATE}


@app.post("/upload_song", response_model=UploadResponse)
async def upload_song(
    audio_file: UploadFile = File(...),
    title: str = Form(..., min_length=1, max_length=255),
    artist: str = Form(..., min_length=1, max_length=255),
    album: str | None = Form(None, max_length=255),
    _: None = Depends(require_api_key),
) -> UploadResponse:
    tmp_path = await _save_upload_to_temp(audio_file)
    try:
        waveform, sr = await run_in_threadpool(load_audio, tmp_path)
        duration_ms = int(len(waveform) / sr * 1000)

        song_id = await run_in_threadpool(
            insert_song, title, artist, duration_ms, album, DB_PATH
        )
        fingerprints = await run_in_threadpool(
            fingerprint_audio, waveform, song_id, sr
        )
        fp_count = await run_in_threadpool(
            insert_fingerprints, song_id, fingerprints, duration_ms, DB_PATH
        )

        logger.info("Ingested song_id=%s '%s' (%d fingerprints)", song_id, title, fp_count)
        return UploadResponse(
            song_id=song_id,
            title=title,
            artist=artist,
            duration_ms=duration_ms,
            fingerprint_count=fp_count,
            sample_rate_hz=sr,
        )
    except HTTPException:
        raise
    except FileNotFoundError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception("upload_song failed")
        raise HTTPException(status_code=500, detail="Internal processing error") from exc
    finally:
        Path(tmp_path).unlink(missing_ok=True)


@app.post("/identify", response_model=IdentifyResponse)
async def identify_audio(
    audio_file: UploadFile = File(...),
    max_results: int = Form(config.DEFAULT_MAX_RESULTS, ge=1, le=50),
    min_confidence: float = Form(config.DEFAULT_MIN_CONFIDENCE, ge=0.0, le=1.0),
) -> IdentifyResponse:
    start = time.perf_counter()
    tmp_path = await _save_upload_to_temp(audio_file)
    try:
        waveform, sr = await run_in_threadpool(load_audio, tmp_path)
        duration_ms = int(len(waveform) / sr * 1000)
        query_fps = await run_in_threadpool(fingerprint_audio, waveform, None, sr)
        matches = await run_in_threadpool(
            identify, query_fps, str(DB_PATH), max_results, min_confidence
        )
        elapsed_ms = int((time.perf_counter() - start) * 1000)

        logger.info(
            "identify: %d match(es) in %dms (query %dms)",
            len(matches), elapsed_ms, duration_ms,
        )
        return IdentifyResponse(
            matches=[
                Match(
                    song_id=m.song_id,
                    title=m.title,
                    artist=m.artist,
                    album=m.album,
                    confidence=round(m.confidence, 4),
                    offset_ms=m.offset_ms,
                    match_count=m.match_count,
                )
                for m in matches
            ],
            query_duration_ms=duration_ms,
            processing_time_ms=elapsed_ms,
            sample_rate_hz=sr,
        )
    except HTTPException:
        raise
    except FileNotFoundError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception("identify failed")
        raise HTTPException(status_code=500, detail="Internal processing error") from exc
    finally:
        Path(tmp_path).unlink(missing_ok=True)


@app.get("/songs/{song_id}")
def get_song_metadata(song_id: int) -> dict:
    song = get_song(song_id, db_path=DB_PATH)
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    return song


@app.delete("/songs/{song_id}")
def remove_song(song_id: int, _: None = Depends(require_api_key)) -> dict:
    if not delete_song(song_id, db_path=DB_PATH):
        raise HTTPException(status_code=404, detail="Song not found")
    logger.info("Deleted song_id=%s", song_id)
    return {"deleted": True, "song_id": song_id}
