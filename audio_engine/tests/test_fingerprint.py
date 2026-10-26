import numpy as np

from fingerprint import (
    SAMPLE_RATE,
    N_FFT,
    HOP_LENGTH,
    FREQ_MAX_HZ,
    BAND_EDGES_HZ,
    PEAK_TIME_WINDOW_MS,
    PEAKS_PER_BAND_PER_WINDOW,
    detect_peaks,
    fingerprint_audio,
    generate_fingerprints,
    generate_spectrogram,
)
from tests.helpers import make_test_waveform


def test_generate_spectrogram_shape():
    wave = make_test_waveform(duration_sec=2.0)
    log_spec, freqs, times = generate_spectrogram(wave, sample_rate=SAMPLE_RATE)

    assert log_spec.ndim == 2
    assert log_spec.shape[0] == len(freqs)
    assert log_spec.shape[1] == len(times)
    assert freqs[-1] <= FREQ_MAX_HZ + (freqs[1] - freqs[0])
    assert np.all(log_spec >= 0)


def test_detect_peaks_returns_time_freq_points():
    duration = 3.0
    wave = make_test_waveform(duration_sec=duration)
    log_spec, freqs, times = generate_spectrogram(wave, sample_rate=SAMPLE_RATE)
    peaks = detect_peaks(log_spec, freqs, times)

    assert len(peaks) > 0
    n_bands = len(BAND_EDGES_HZ) - 1
    n_windows = int(duration / (PEAK_TIME_WINDOW_MS / 1000.0)) + 2
    assert len(peaks) <= n_bands * n_windows * PEAKS_PER_BAND_PER_WINDOW
    t, f, time_sec, freq_hz = peaks[0]
    assert isinstance(t, int)
    assert isinstance(f, int)
    assert time_sec >= 0
    assert freq_hz >= 0


def _fingerprint_hashes(waveform):
    log_spec, freqs, times = generate_spectrogram(waveform)
    peaks = detect_peaks(log_spec, freqs, times)
    return {h for h, _, _ in generate_fingerprints(peaks)}


def test_peaks_are_position_invariant():
    """A clip's peaks should reproduce the full track's peaks in the overlap.

    Uses a transient-rich signal (well-localized peaks) and a frame-aligned
    clip start so the test isolates peak-selection invariance rather than
    STFT frame-grid effects.
    """
    rng = np.random.default_rng(0)
    sr = SAMPLE_RATE
    n = sr * 12
    t = np.arange(n) / sr
    wave = np.zeros(n, dtype=np.float32)
    for center in np.arange(0.1, 12.0, 0.2):
        freq = 200.0 + 3800.0 * rng.random()
        idx = int(center * sr)
        env = np.exp(-(((np.arange(n) - idx) / (0.02 * sr)) ** 2))
        wave += (np.sin(2 * np.pi * freq * t) * env).astype(np.float32)
    wave += 0.01 * rng.standard_normal(n).astype(np.float32)
    wave /= np.max(np.abs(wave))

    clip_start = 258 * HOP_LENGTH  # frame-aligned, ~3 s
    clip = wave[clip_start : clip_start + sr * 5]

    full_hashes = _fingerprint_hashes(wave)
    clip_hashes = _fingerprint_hashes(clip)

    assert clip_hashes
    overlap = len(clip_hashes & full_hashes) / len(clip_hashes)
    assert overlap >= 0.6


def test_generate_fingerprints_format():
    wave = make_test_waveform(duration_sec=5.0)
    fps = fingerprint_audio(wave, song_id=42, sample_rate=SAMPLE_RATE)

    assert len(fps) > 0
    h, song_id, anchor_ms = fps[0]
    assert isinstance(h, int)
    assert 0 <= h <= 0xFFFFFFFF
    assert song_id == 42
    assert anchor_ms >= 0


def test_fingerprint_constants_use_44100():
    assert SAMPLE_RATE == 44100
    assert N_FFT == 2048
    assert HOP_LENGTH == 512
