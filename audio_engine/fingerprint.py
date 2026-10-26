"""Spectrogram, peak detection, and Shazam-style fingerprint generation."""

import struct
import zlib
from collections import defaultdict

import numpy as np
from scipy import signal
from scipy.ndimage import maximum_filter

SAMPLE_RATE = 44100
N_FFT = 2048
HOP_LENGTH = 512
WIN_LENGTH = 2048
FREQ_MAX_HZ = 5000  # Most discriminative music band; ignore non-informative highs

FAN_VALUE = 8
MIN_HASH_TIME_MS = 100
MAX_HASH_TIME_MS = 1000
DELTA_T_BITS = 11
DELTA_T_MAX = (1 << DELTA_T_BITS) - 1
TARGET_FREQ_WINDOW_BINS = 64  # target-zone frequency span for anchor->target pairing

# Hash quantization absorbs the +/-1 frame/bin jitter that occurs when the same
# audio is analyzed at a different STFT frame offset (clip vs. full song) or
# after re-encoding. Coarser bins trade a little discriminative power for much
# higher fingerprint reproducibility.
FREQ_QUANT_BINS = 2  # merge adjacent frequency bins (~43 Hz at N_FFT=2048)
DT_QUANT_MS = 20  # quantize anchor->target time delta to 20 ms buckets

# Peak detection: local maxima grouped into log-spaced frequency bands and
# short time windows. Selection depends only on a local neighborhood, so a clip
# and the full song yield the same peaks in overlapping regions. Log spacing
# allocates finer resolution to lower frequencies, where most musical energy
# and discriminative content live.
NEIGHBORHOOD_TIME = 9
NEIGHBORHOOD_FREQ = 11
BAND_EDGES_HZ = tuple(int(round(f)) for f in np.geomspace(50, FREQ_MAX_HZ, num=7))
PEAK_TIME_WINDOW_MS = 300
PEAKS_PER_BAND_PER_WINDOW = 1
PEAK_AMP_FLOOR = 1e-4


def frame_to_ms(frame: int, sample_rate: int = SAMPLE_RATE, hop_length: int = HOP_LENGTH) -> int:
    return int(round(frame * hop_length / sample_rate * 1000))


def ms_to_frame(time_ms: int, sample_rate: int = SAMPLE_RATE, hop_length: int = HOP_LENGTH) -> int:
    return int(round(time_ms * sample_rate / (hop_length * 1000)))


def generate_spectrogram(
    waveform: np.ndarray,
    sample_rate: int = SAMPLE_RATE,
    n_fft: int = N_FFT,
    hop_length: int = HOP_LENGTH,
    win_length: int = WIN_LENGTH,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Compute log-magnitude STFT spectrogram.

    Returns:
        log_spec: 2D log-magnitude spectrogram (freq_bins x time_frames)
        freqs: frequency bin centers in Hz
        times: time frame centers in seconds
    """
    nperseg = min(win_length, len(waveform))
    noverlap = min(nperseg - 1, win_length - hop_length)
    freqs, times, stft = signal.stft(
        waveform,
        fs=sample_rate,
        nperseg=nperseg,
        noverlap=noverlap,
        nfft=n_fft,
        window="hann",
        boundary=None,
        padded=False,
    )
    magnitude = np.abs(stft)
    log_spec = np.log1p(magnitude)

    max_bin = int(np.searchsorted(freqs, FREQ_MAX_HZ, side="right"))
    log_spec = log_spec[:max_bin]
    freqs = freqs[:max_bin]

    return log_spec, freqs, times


def _frame_duration_sec(times: np.ndarray) -> float:
    if len(times) >= 2:
        return float(times[1] - times[0])
    return HOP_LENGTH / SAMPLE_RATE


def detect_peaks(
    log_spec: np.ndarray,
    freqs: np.ndarray,
    times: np.ndarray,
    neighborhood_time: int = NEIGHBORHOOD_TIME,
    neighborhood_freq: int = NEIGHBORHOOD_FREQ,
    band_edges_hz: tuple[int, ...] = BAND_EDGES_HZ,
    time_window_ms: int = PEAK_TIME_WINDOW_MS,
    peaks_per_band_per_window: int = PEAKS_PER_BAND_PER_WINDOW,
    amp_floor: float = PEAK_AMP_FLOOR,
) -> list[tuple[int, int, float, float]]:
    """
    Detect spectral peaks that are stable across clip vs. full-song context.

    A point is a candidate if it is a local maximum within a fixed
    (freq x time) neighborhood. Candidates are then grouped by log-spaced
    frequency band and short time window, keeping only the strongest few per
    group. Because every decision depends solely on a local neighborhood, the
    same audio region produces the same peaks whether analyzed as a clip or as
    part of a longer track (position invariance).

    Returns:
        List of (time_frame, freq_bin, time_sec, freq_hz) sorted by time.
    """
    n_freq, n_time = log_spec.shape
    if n_freq == 0 or n_time == 0:
        return []

    local_max = maximum_filter(
        log_spec,
        size=(neighborhood_freq, neighborhood_time),
        mode="constant",
        cval=0.0,
    )
    is_peak = (log_spec == local_max) & (log_spec > amp_floor)

    f_idxs, t_idxs = np.nonzero(is_peak)
    if f_idxs.size == 0:
        return []

    band_of_bin = np.searchsorted(np.asarray(band_edges_hz), freqs, side="right") - 1
    band_of_bin = np.clip(band_of_bin, 0, len(band_edges_hz) - 2)

    frame_dt = _frame_duration_sec(times)
    window_frames = max(1, int(round((time_window_ms / 1000.0) / frame_dt)))

    buckets: dict[tuple[int, int], list[tuple[float, int, int]]] = defaultdict(list)
    for f_idx, t_idx in zip(f_idxs, t_idxs):
        band = int(band_of_bin[f_idx])
        window = int(t_idx) // window_frames
        buckets[(band, window)].append((float(log_spec[f_idx, t_idx]), int(t_idx), int(f_idx)))

    peaks: list[tuple[int, int, float, float]] = []
    for group in buckets.values():
        group.sort(reverse=True)
        for _, t_idx, f_idx in group[:peaks_per_band_per_window]:
            peaks.append((t_idx, f_idx, float(times[t_idx]), float(freqs[f_idx])))

    peaks.sort(key=lambda item: (item[0], item[1]))
    return peaks


def _quantize_delta_t(delta_ms: int) -> int:
    bucket = delta_ms // DT_QUANT_MS
    return min(max(int(bucket), 0), DELTA_T_MAX)


def _hash_peaks(f1: int, f2: int, delta_t_ms: int) -> int:
    f1_q = f1 // FREQ_QUANT_BINS
    f2_q = f2 // FREQ_QUANT_BINS
    delta_q = _quantize_delta_t(delta_t_ms)
    packed = ((f1_q & 0x3FF) << 22) | ((f2_q & 0x7FF) << 11) | (delta_q & 0x7FF)
    return zlib.crc32(struct.pack(">I", packed)) & 0xFFFFFFFF


def generate_fingerprints(
    peaks: list[tuple[int, int, float, float]],
    song_id: int | None = None,
    sample_rate: int = SAMPLE_RATE,
    hop_length: int = HOP_LENGTH,
    fan_value: int = FAN_VALUE,
    min_dt_ms: int = MIN_HASH_TIME_MS,
    max_dt_ms: int = MAX_HASH_TIME_MS,
    freq_window_bins: int = TARGET_FREQ_WINDOW_BINS,
) -> list[tuple[int, int, int]]:
    """
    Pair each anchor peak with peaks inside its target zone to produce hashes.

    The target zone is bounded in time (min_dt_ms..max_dt_ms) and in frequency
    (within freq_window_bins of the anchor), matching the Shazam landmark
    scheme. Restricting the frequency span keeps hashes discriminative and
    stable under re-encoding.

    Returns:
        List of (hash, song_id, anchor_time_ms). song_id defaults to 0 when unknown.
    """
    sid = song_id if song_id is not None else 0
    fingerprints: list[tuple[int, int, int]] = []

    min_dt_frames = ms_to_frame(min_dt_ms, sample_rate, hop_length)
    max_dt_frames = ms_to_frame(max_dt_ms, sample_rate, hop_length)

    for i, (t1, f1, _, _) in enumerate(peaks):
        anchor_ms = frame_to_ms(t1, sample_rate, hop_length)
        paired = 0
        for j in range(i + 1, len(peaks)):
            t2, f2, _, _ = peaks[j]
            dt_frames = t2 - t1
            if dt_frames < min_dt_frames:
                continue
            if dt_frames > max_dt_frames:
                break
            if abs(f2 - f1) > freq_window_bins:
                continue
            delta_ms = frame_to_ms(dt_frames, sample_rate, hop_length)
            h = _hash_peaks(f1, f2, delta_ms)
            fingerprints.append((h, sid, anchor_ms))
            paired += 1
            if paired >= fan_value:
                break

    return fingerprints


def fingerprint_audio(
    waveform: np.ndarray,
    song_id: int | None = None,
    sample_rate: int = SAMPLE_RATE,
) -> list[tuple[int, int, int]]:
    """Full pipeline: spectrogram → peaks → fingerprints."""
    log_spec, freqs, times = generate_spectrogram(waveform, sample_rate=sample_rate)
    peaks = detect_peaks(log_spec, freqs, times)
    return generate_fingerprints(peaks, song_id=song_id, sample_rate=sample_rate)
