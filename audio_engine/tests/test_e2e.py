"""End-to-end pipeline test with a generated sample audio file."""

import tempfile
from pathlib import Path

import numpy as np
import pytest
import soundfile as sf

from audio import TARGET_SAMPLE_RATE, load_audio
from db import get_song, init_db, insert_fingerprints, insert_song
from fingerprint import fingerprint_audio
from matcher import identify
from tests.helpers import make_test_waveform


def test_full_pipeline_with_sample_file(tmp_path):
    db_path = tmp_path / "e2e.db"
    init_db(db_path)

    full_wave = make_test_waveform(duration_sec=15.0)
    wav_path = tmp_path / "sample.wav"
    sf.write(wav_path, full_wave, TARGET_SAMPLE_RATE)

    waveform, sr = load_audio(wav_path)
    assert sr == TARGET_SAMPLE_RATE

    song_id = insert_song(
        "Pipeline Song",
        "Pipeline Artist",
        int(len(waveform) / sr * 1000),
        db_path=db_path,
    )
    fps = fingerprint_audio(waveform, song_id=song_id, sample_rate=sr)
    assert len(fps) > 0
    insert_fingerprints(song_id, fps, int(len(waveform) / sr * 1000), db_path=db_path)

    clip_start = int(sr * 5)
    clip_end = int(sr * 10)
    clip_path = tmp_path / "clip.wav"
    sf.write(clip_path, waveform[clip_start:clip_end], sr)

    clip_wave, clip_sr = load_audio(clip_path)
    query_fps = fingerprint_audio(clip_wave, sample_rate=clip_sr)
    matches = identify(query_fps, db_path=db_path, min_confidence=0.0)

    assert len(matches) >= 1
    assert matches[0].song_id == song_id

    song = get_song(song_id, db_path=db_path)
    assert song["title"] == "Pipeline Song"
    assert song["fingerprint_count"] > 0
