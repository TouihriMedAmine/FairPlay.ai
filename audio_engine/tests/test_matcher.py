import numpy as np

from db import init_db, insert_fingerprints, insert_song
from fingerprint import fingerprint_audio
from matcher import identify
from tests.helpers import make_test_waveform


def test_identify_finds_registered_song(tmp_path):
    db_path = tmp_path / "match.db"
    init_db(db_path)

    full_wave = make_test_waveform(duration_sec=12.0)
    song_id = insert_song("Match Target", "Test Band", 12000, db_path=db_path)
    fps = fingerprint_audio(full_wave, song_id=song_id)
    insert_fingerprints(song_id, fps, 12000, db_path=db_path)

    clip = full_wave[int(44100 * 2) : int(44100 * 7)]
    query_fps = fingerprint_audio(clip)
    matches = identify(query_fps, db_path=db_path, min_confidence=0.0)

    assert len(matches) >= 1
    assert matches[0].song_id == song_id
    assert matches[0].title == "Match Target"
    assert 0.0 <= matches[0].confidence <= 1.0


def test_identify_returns_no_match_for_absent_audio(tmp_path):
    """Querying audio not in the catalog should not produce a false match."""
    db_path = tmp_path / "match.db"
    init_db(db_path)

    indexed = make_test_waveform(duration_sec=12.0)
    song_id = insert_song("Indexed", "Band", 12000, db_path=db_path)
    insert_fingerprints(song_id, fingerprint_audio(indexed, song_id=song_id), 12000, db_path=db_path)

    rng = np.random.default_rng(123)
    noise = rng.standard_normal(int(44100 * 5)).astype(np.float32)
    query_fps = fingerprint_audio(noise)
    matches = identify(query_fps, db_path=db_path, min_confidence=0.15)

    assert matches == []
