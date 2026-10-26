"""Audio preprocessing: load, mono conversion, resampling."""

from pathlib import Path

import librosa
import numpy as np

TARGET_SAMPLE_RATE = 44100


def load_audio(
    file_path: str | Path,
    target_sr: int = TARGET_SAMPLE_RATE,
) -> tuple[np.ndarray, int]:
    """
    Load an audio file, convert to mono, and resample to the target rate.

    Returns:
        waveform: 1D float32 array of normalized samples in [-1, 1]
        sample_rate: output sample rate in Hz
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Audio file not found: {path}")

    waveform, sample_rate = librosa.load(str(path), sr=None, mono=False)

    waveform = to_mono(waveform)
    waveform, sample_rate = resample(waveform, sample_rate, target_sr)

    return waveform.astype(np.float32), sample_rate


def to_mono(waveform: np.ndarray) -> np.ndarray:
    """Convert multi-channel audio to mono by averaging channels."""
    if waveform.ndim == 1:
        return waveform
    return librosa.to_mono(waveform)


def resample(
    waveform: np.ndarray,
    sample_rate: int,
    target_sr: int = TARGET_SAMPLE_RATE,
) -> tuple[np.ndarray, int]:
    """Resample waveform to target_sr if needed."""
    if sample_rate == target_sr:
        return waveform, sample_rate
    resampled = librosa.resample(waveform, orig_sr=sample_rate, target_sr=target_sr)
    return resampled, target_sr
