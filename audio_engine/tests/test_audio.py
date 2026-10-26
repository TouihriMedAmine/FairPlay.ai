"""Tests for audio preprocessing."""

import tempfile
from pathlib import Path

import numpy as np
import pytest
import soundfile as sf

from audio import TARGET_SAMPLE_RATE, load_audio, resample, to_mono


def test_to_mono_averages_channels():
    stereo = np.array([[1.0, 0.0, -1.0, 0.5], [3.0, 0.0, 1.0, 0.5]])
    mono = to_mono(stereo)
    assert mono.shape == (4,)
    np.testing.assert_allclose(mono, [2.0, 0.0, 0.0, 0.5])


def test_resample_changes_length():
    sr = 22050
    duration = 1.0
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    waveform = np.sin(2 * np.pi * 440 * t).astype(np.float32)

    resampled, out_sr = resample(waveform, sr, TARGET_SAMPLE_RATE)

    assert out_sr == TARGET_SAMPLE_RATE
    expected_len = int(len(waveform) * TARGET_SAMPLE_RATE / sr)
    assert abs(len(resampled) - expected_len) <= 1


def test_load_audio_mono_resampled(tmp_path: Path):
    sr = 22050
    duration = 0.5
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    stereo = np.stack([np.sin(2 * np.pi * 440 * t), np.sin(2 * np.pi * 880 * t)])

    wav_path = tmp_path / "test.wav"
    sf.write(wav_path, stereo.T, sr)

    waveform, out_sr = load_audio(wav_path)

    assert out_sr == TARGET_SAMPLE_RATE
    assert waveform.ndim == 1
    assert len(waveform) == pytest.approx(int(duration * TARGET_SAMPLE_RATE), abs=2)
    assert waveform.dtype == np.float32
    assert np.max(np.abs(waveform)) <= 1.0


def test_load_audio_file_not_found():
    with pytest.raises(FileNotFoundError):
        load_audio("nonexistent.wav")
