"""Background worker that drains DetailBackfillRequest rows via the Shazam API."""
import logging
import threading

from .models import SongDetails, DetailBackfillRequest
from . import shazam_client as sc

logger = logging.getLogger(__name__)
BACKFILL_RESULT_TIMEOUT = 10 * 60  # manual re-triggers stay valid this long

_worker_lock = threading.Lock()
_worker_thread = None
_wake = threading.Event()


def _upsert(details: dict):  # noqa: ARG001 - signature stable for stubs
    if not details.get('title'):
        return False
    SongDetails.objects.update_or_create(
        title=details['title'], artist=details['artist'],
        defaults={k: v for k, v in details.items() if k not in ('title', 'artist')},
    )
    return True


def _process_request(req: DetailBackfillRequest):
    source_path = None
    if req.source == 'catalog':
        source_path = sc.catalog_song_audio_path(req.title)

    track = None
    clip = None
    rate_limited_any = False

    if source_path:
        clip = sc.extract_wav_clip(source_path)

    # 1) shazam-api.com recognize on the real audio (separate quota pool)
    if clip:
        try:
            track = sc.recognize_from_audio_com(clip)
        except sc.RateLimited:
            rate_limited_any = True
        except sc.ShazamError as e:
            logger.warning(f"com-API recognize failed for '{req.title}': {e}")

    # 2) RapidAPI detect on the same audio
    if not track and clip:
        try:
            track = sc.detect_from_audio(clip)
        except sc.RateLimited:
            rate_limited_any = True
        except sc.ShazamError as e:
            logger.warning(f"RapidAPI detect failed for '{req.title}': {e}")

    # 3) RapidAPI text search -> detailed metadata (writers live only here)
    if not track:
        try:
            hit = sc.search_track(f"{req.artist} - {req.title}")
            if hit:
                track = sc.get_details(hit['id'])
        except sc.RateLimited:
            rate_limited_any = True
        except sc.ShazamError as e:
            logger.warning(f"RapidAPI search failed for '{req.title}': {e}")

    details = sc.parse_track_payload(track or {})
    if details.get('title'):
        req.status = 'success'
        req.note = 'via shazam-api.com audio' if (track or {}).get('_source') == 'shazam-api.com' else ''
    elif rate_limited_any:
        req.status = 'rate_limited'
        req.note = 'All providers hit their rate limit - re-run later'
    else:
        req.status = 'no_results'
        req.note = 'Shazam returned no match'
    _upsert({**details, 'title': req.title, 'artist': req.artist} if details.get('title') else details)
    req.save()


def _drain():
    while True:
        _wake.wait()
        _wake.clear()
        while True:
            req = (DetailBackfillRequest.objects
                   .filter(status='pending').order_by('created_at').first())
            if req is None:
                break
            try:
                _process_request(req)
                logger.info(f"Backfill OK: {req.title} ({req.status})")
            except sc.RateLimited as e:
                logger.warning(f"Backfill rate limit reached: {e}")
                req.status = 'rate_limited'
                req.note = 'Quota hit - re-run from admin later'
                req.save()
                break
            except Exception as e:
                req.status = 'failed'
                req.note = str(e)[:250]
                req.save()
                logger.error(f"Backfill failed on {req.title}: {e}")


def ensure_worker():
    global _worker_thread
    with _worker_lock:
        if _worker_thread is None or not _worker_thread.is_alive():
            _worker_thread = threading.Thread(target=_drain, name='backfill-worker', daemon=True)
            _worker_thread.start()
    _wake.set()
