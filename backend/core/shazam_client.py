"""Shazam REST client used by the details backfill worker (server-side)."""
import base64
import json
import os
import tempfile
import time
from pathlib import Path

import requests

SHAZAM_DETECT_URL = "https://shazam.p.rapidapi.com/songs/detect"
SHAZAM_SEARCH_URL = "https://shazam.p.rapidapi.com/search"
SHAZAM_DETAILS_URL = "https://shazam.p.rapidapi.com/songs/v2/get-details"
COM_RECOGNIZE_URL = "https://shazam-api.com/api/v2/recognize"
COM_RESULTS_URL = "https://shazam-api.com/api/v2/results/"

_last_call = [0.0]
_CONFIG_FILE = Path(__file__).resolve().parent.parent.parent / 'config.json'


def _config_value(name: str) -> str | None:
    try:
        val = json.loads(_CONFIG_FILE.read_text(encoding='utf-8-sig')).get(name)
        return val if val else None
    except (OSError, ValueError):
        return None


def _api_key() -> str:
    # .env (RAPIDAPI_KEY) wins; config.json kept as legacy fallback
    return os.getenv('RAPIDAPI_KEY') or _config_value('API_KEY')


def _com_key() -> str:
    val = os.getenv('SHAZAM_API_COM_KEY') or _config_value('SHAZAM_API_COM_KEY')
    if not val:
        raise ShazamError('SHAZAM_API_COM_KEY missing: set it in .env')
    return val


def recognize_from_audio_com(wav_bytes: bytes, poll_seconds: int = 30) -> dict | None:
    """Recognize audio with shazam-api.com (separate quota pool).

    Returns a normalized track dict (title/artist/album/label/genre/isrc/...)
    or None when the API says no match."""
    import time as _time

    def _auth():
        return {'Authorization': f'Bearer {_com_key()}'}

    try:
        r = requests.post(COM_RECOGNIZE_URL, headers=_auth(),
                          files={'file': ('clip.wav', wav_bytes, 'audio/wav')},
                          timeout=30)
    except requests.RequestException as e:
        raise ShazamError(f'com recognize request failed: {e}')
    if r.status_code == 429:
        raise RateLimited('com recognize quota exhausted')
    if r.status_code in (401, 403):
        raise ShazamError(f'com key rejected ({r.status_code}): {r.text[:120]}')
    if r.status_code != 200:
        raise ShazamError(f'com recognize http {r.status_code}')

    body = r.json() if isinstance(r.json(), dict) else {}
    if body.get('status') == 'processing':
        uuid = body.get('uuid') or ''
        deadline = _time.time() + poll_seconds
        body = {}
        while uuid and _time.time() < deadline:
            _time.sleep(2)
            rr = requests.get(f'{COM_RESULTS_URL}{uuid}', headers=_auth(), timeout=30)
            if rr.status_code != 200:
                continue
            body = rr.json() if isinstance(rr.json(), dict) else {}
            if body.get('status') not in ('success', 'no_matches', 'processing'):
                body = None
                break
            if body.get('status') in ('success', 'no_matches'):
                break
        if body is None or body.get('status') not in ('success', 'no_matches'):
            raise ShazamError('com recognize polling timed out')

    if body.get('status') != 'success' or not body.get('results'):
        return None
    result = body['results'][0]
    return {**result, '_source': 'shazam-api.com'}


def _throttle(route: str):
    # Per-route light rate limit; detect shares the RapidAPI quota, search too
    now = time.time()
    wait = max(0.0, 1.2 - (now - _last_call[0]))
    if wait:
        time.sleep(wait)
    _last_call[0] = time.time()
    return route


class ShazamError(Exception):
    pass


class RateLimited(ShazamError):
    pass


def detect_from_audio(wav_bytes: bytes) -> dict | None:
    """Detect a track from raw wav audio bytes (base64-encoded)."""
    _throttle('detect')
    r = requests.post(
        SHAZAM_DETECT_URL,
        data=base64.b64encode(wav_bytes).decode(),
        headers={'content-type': 'text/plain',
                 'X-RapidAPI-Key': _api_key(),
                 'X-RapidAPI-Host': 'shazam.p.rapidapi.com'},
        timeout=15,
    )
    if r.status_code == 429:
        raise RateLimited(f'429 on detect: {r.text[:120]}')
    if r.status_code != 200:
        raise ShazamError(f'{r.status_code} on detect: {r.text[:160]}')
    body = r.json() if isinstance(r.json(), dict) else None
    if body and body.get('track'):
        return body['track']
    return None


def search_track(text: str) -> dict | object | None:
    """Search Shazam by free text; returns the first hit's (id, title, subtitle) or None"""
    _throttle('search')
    r = requests.get(
        SHAZAM_SEARCH_URL,
        params={'term': text, 'locale': 'en-US', 'offset': '0', 'limit': '5'},
        headers={'X-RapidAPI-Key': _api_key(),
                 'X-RapidAPI-Host': 'shazam.p.rapidapi.com'},
        timeout=15,
    )
    if r.status_code == 429:
        raise RateLimited(f'429 on search: {r.text[:120]}')
    if r.status_code != 200:
        raise ShazamError(f'{r.status_code} on search: {"(302 loop = key not subscribed to the Shazam API plan on RapidAPI)" if r.status_code == 302 else r.text[:160]}')
    try:
        hits = (r.json().get('tracks') or {}).get('hits') or []
        for hit in hits:
            res = hit.get('result') or {}
            if res.get('id'):
                return {'id': res['id'], 'title': res.get('title', ''),
                        'subtitle': res.get('subtitle', '')}
    except (ValueError, AttributeError):
        pass
    return None


def get_details(track_id: str) -> dict | object | None:
    """Fetch the detailed v2 track payload (sections: album/label/released/writer)."""
    _throttle('details')
    r = requests.get(
        SHAZAM_DETAILS_URL,
        params={'id': track_id, 'l': 'en-US'},
        headers={'X-RapidAPI-Key': _api_key(),
                 'X-RapidAPI-Host': 'shazam.p.rapidapi.com'},
        timeout=15,
    )
    if r.status_code == 429:
        raise RateLimited(f'429 on details: {r.text[:120]}')
    if r.status_code != 200:
        return None
    body = r.json() if isinstance(r.json(), dict) else None
    if body and body.get('data'):
        return body['data'][0]
    return body if body else None


def extract_wav_clip(source: Path, offset_sec: int = 60, length_sec: int = 5) -> bytes | None:
    """Cut a short wav clip out of a catalog mp3 for Shazam detect."""
    with tempfile.TemporaryDirectory() as td:
        out = Path(td) / 'clip.wav'
        import subprocess
        r = subprocess.run(
            ['ffmpeg', '-y', '-i', str(source), '-ss', str(offset_sec),
             '-t', str(length_sec), '-ac', '1', '-ar', '32000', str(out)],
            capture_output=True, text=True,
        )
        if r.returncode != 0 or not out.exists():
            return None
        return out.read_bytes()


def parse_track_payload(track: dict, engine_song_id=None) -> dict:
    """Normalize either a detect track, a v2 get-details track, or a flat
    shazam-api.com recognize result into a SongDetails dict."""
    if not track:
        return {}

    if track.get('_source') == 'shazam-api.com':
        import re as _re
        shazam_link = ((track.get('links') or {}).get('shazam')) or ''
        m = _re.search(r'/track/(\d+)/', shazam_link)
        return {
            'title': track.get('title') or '',
            'artist': track.get('artist') or '',
            'album': track.get('album') or '',
            'label': track.get('label') or '',
            'released': track.get('releaseDate') or '',
            'writers': [],
            'performers': [p for p in [track.get('artist')] if p],
            'genres': [track['genre']] if track.get('genre') else [],
            'artwork_url': track.get('artwork') or '',
            'shazam_key': m.group(1) if m else '',
            'raw': track,
        }

    # v2 get-details nests under data[0] with a slightly different shape
    title = track.get('title') or ''
    artist = track.get('subtitle') or ''
    if not title and isinstance(track.get('data'), list) and track['data']:
        track = track['data'][0]
        title = track.get('title', title)
        artist = track.get('subtitle', artist)
    details = {
        'title': title,
        'artist': artist,
        'album': '', 'label': '', 'released': '',
        'writers': [], 'performers': [], 'genres': [],
        'artwork_url': '', 'raw': track,
    }
    if track.get('key') or track.get('id'):
        key = track.get('key') or track.get('id')
        details['shazam_key'] = str(key)
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
        for a in track.get('artists') or []:
            name = a.get('name') if isinstance(a, dict) else None
            if name:
                details['performers'].append(name)
        images = track.get('images') or {}
        details['artwork_url'] = (images.get('coverarthq')
                                  or images.get('coverart')
                                  or images.get('background') or '')
    except Exception:
        pass
    return details


def catalog_song_audio_path(title: str):
    """Locate the mp3 backing a catalog song inside audio_engine/Dataset."""
    root = Path(__file__).resolve().parent.parent.parent / 'audio_engine' / 'Dataset'
    candidates = sorted(root.glob('*'))
    for pat in (f"{title}.mp3", f"{title} - *.mp3", f"*{title.split(' (')[0]}*.mp3"):
        hits = [c for c in candidates if c.is_file() and c.suffix == '.mp3' and c.match(pat)]
        if hits:
            return hits[0]
    return None
