"""Shared test helpers."""

import numpy as np

from audio import TARGET_SAMPLE_RATE


def make_test_waveform(duration_sec: float = 10.0, sample_rate: int = TARGET_SAMPLE_RATE) -> np.ndarray:
    """Generate a spectrally rich waveform for fingerprint tests."""
    n = int(duration_sec * sample_rate)
    t = np.linspace(0, duration_sec, n, endpoint=False)
    wave = np.zeros(n, dtype=np.float32)
    for freq in [220, 440, 880, 1320, 1760, 2200]:
        wave += np.sin(2 * np.pi * freq * t * (1 + 0.05 * np.sin(2 * np.pi * 0.5 * t)))
    wave += 0.3 * np.sin(2 * np.pi * (440 + 80 * t) * t)
    wave /= np.max(np.abs(wave))
    return wave
