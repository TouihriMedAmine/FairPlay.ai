# Shazam-like Audio Recognition

A compact Shazam-style audio fingerprinting and recognition system: spectral
peak fingerprinting, an inverted-index store, offset-histogram matching, and a
FastAPI service.

## Architecture

```
Audio → Preprocess (mono, 44.1 kHz) → Spectrogram (STFT) → Peaks → Hashes
                                                                      │
                                              Storage (SQLite inverted index)
                                                                      │
Query clip → Hashes → Hash lookup → Offset alignment → Scoring → Top match
```

| Module | Responsibility |
|--------|----------------|
| `audio.py` | Load, mono conversion, resample to 44.1 kHz |
| `fingerprint.py` | STFT spectrogram, position-invariant peak detection, landmark hashing |
| `db.py` | SQLite schema, inverted index, batched lookups |
| `matcher.py` | Hash lookup, time alignment, confidence scoring |
| `api.py` | FastAPI endpoints (upload, identify, health, CRUD) |
| `config.py` | Environment-overridable configuration |

## Setup

```bash
pip install -r requirements.txt
```

## Run the API

```bash
uvicorn api:app --reload
```

Interactive docs at `http://localhost:8000/docs`.

### Endpoints

- `GET /health` — liveness + configured sample rate
- `POST /upload_song` — register a song (multipart: `audio_file`, `title`, `artist`, optional `album`)
- `POST /identify` — identify a clip (multipart: `audio_file`, optional `max_results`, `min_confidence`)
- `GET /songs/{song_id}` — song metadata
- `DELETE /songs/{song_id}` — remove a song

## Configuration (environment variables)

| Variable | Default | Purpose |
|----------|---------|---------|
| `SHAZAM_DB_PATH` | `shazam.db` | SQLite database path |
| `SHAZAM_MAX_UPLOAD_BYTES` | `52428800` (50 MB) | Max upload size |
| `SHAZAM_API_KEYS` | *(empty)* | Comma-separated API keys. Empty = auth **disabled** (dev only) |
| `SHAZAM_RATE_LIMIT_REQUESTS` | `120` | Requests per window per IP |
| `SHAZAM_RATE_LIMIT_WINDOW_SEC` | `60` | Rate-limit window (seconds) |
| `SHAZAM_MIN_CONFIDENCE` | `0.15` | Default match confidence threshold |
| `SHAZAM_MAX_RESULTS` | `5` | Default number of results |

When `SHAZAM_API_KEYS` is set, mutating endpoints (`/upload_song`, `DELETE /songs`)
require the `X-API-Key` header.

## Testing

```bash
pytest -q
```

## Evaluation harness

Index the songs in `Dataset/` and evaluate clips under a `Test/` folder:

```bash
python test_clips.py                                                # all Test folders, append new songs
python test_clips.py --rebuild                                      # re-ingest everything from scratch
python test_clips.py --test-folder "Test/<song>" --output results.txt  # single folder
```

Fingerprint reproducibility diagnostic (clip vs. full song hash overlap):

```bash
python fingerprint_diagnostic.py --start 30 --length 5
```

## Notes & limitations

- Storage is single-node SQLite (WAL mode). For catalogs beyond ~100K songs,
  migrate to a sharded store (PostgreSQL/Citus or Cassandra) behind a repository
  abstraction, add a Redis cache tier, and move ingestion to a job queue.
- Preprocessing does not yet include noise reduction / gain normalization, so
  robustness to microphone-captured / noisy audio is untested.
