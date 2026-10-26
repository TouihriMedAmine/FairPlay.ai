import io

import numpy as np
import pytest
import soundfile as sf
from fastapi.testclient import TestClient

import config
from api import app
from db import init_db
from tests.helpers import make_test_waveform


@pytest.fixture
def client(tmp_path, monkeypatch):
    db_path = tmp_path / "api.db"
    monkeypatch.setattr("api.DB_PATH", db_path)
    monkeypatch.setattr(config, "API_KEYS", set())  # dev mode: auth disabled
    init_db(db_path)
    with TestClient(app) as test_client:
        yield test_client


def _wav_bytes(waveform: np.ndarray, sample_rate: int = 44100) -> bytes:
    buf = io.BytesIO()
    sf.write(buf, waveform, sample_rate, format="WAV")
    buf.seek(0)
    return buf.read()


def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
    assert resp.json()["sample_rate_hz"] == 44100


def test_upload_and_identify(client):
    full_wave = make_test_waveform(duration_sec=10.0)
    upload_resp = client.post(
        "/upload_song",
        data={"title": "E2E Song", "artist": "E2E Artist"},
        files={"audio_file": ("song.wav", _wav_bytes(full_wave), "audio/wav")},
    )
    assert upload_resp.status_code == 200
    body = upload_resp.json()
    assert body["song_id"] > 0
    assert body["fingerprint_count"] > 0
    assert body["sample_rate_hz"] == 44100

    clip = full_wave[int(44100 * 2) : int(44100 * 6)]
    identify_resp = client.post(
        "/identify",
        data={"max_results": "3", "min_confidence": "0.0"},
        files={"audio_file": ("clip.wav", _wav_bytes(clip), "audio/wav")},
    )
    assert identify_resp.status_code == 200
    result = identify_resp.json()
    assert result["query_duration_ms"] > 0
    assert len(result["matches"]) >= 1
    assert result["matches"][0]["title"] == "E2E Song"


def test_delete_requires_api_key_when_configured(tmp_path, monkeypatch):
    db_path = tmp_path / "auth.db"
    monkeypatch.setattr("api.DB_PATH", db_path)
    monkeypatch.setattr(config, "API_KEYS", {"secret-key"})
    init_db(db_path)

    with TestClient(app) as client:
        # No key -> rejected
        assert client.delete("/songs/1").status_code == 401
        # Wrong key -> rejected
        assert client.delete("/songs/1", headers={"X-API-Key": "nope"}).status_code == 401
        # Correct key -> reaches handler (404 because song does not exist)
        assert client.delete("/songs/1", headers={"X-API-Key": "secret-key"}).status_code == 404
