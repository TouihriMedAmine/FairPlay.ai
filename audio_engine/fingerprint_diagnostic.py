"""
Diagnostic: measure clip-vs-song fingerprint reproducibility (position invariance).

Fingerprints a full song, then fingerprints a short slice taken from its middle,
and reports what fraction of the clip's hashes also appear in the full song.
A high overlap means the engine produces stable fingerprints regardless of
whether audio is analyzed as a clip or as part of a longer track.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from audio import load_audio
from fingerprint import fingerprint_audio

ROOT = Path(__file__).resolve().parent
DATASET_DIR = ROOT / "Dataset"
AUDIO_EXTENSIONS = {".mp3", ".wav", ".flac", ".ogg", ".m4a", ".opus"}


def first_dataset_song(dataset_dir: Path) -> Path:
    songs = sorted(
        (p for p in dataset_dir.iterdir() if p.is_file() and p.suffix.lower() in AUDIO_EXTENSIONS),
        key=lambda p: p.name.casefold(),
    )
    if not songs:
        raise FileNotFoundError(f"No audio files found in {dataset_dir}")
    return songs[0]


def hash_set(fingerprints) -> set[int]:
    return {h for h, _, _ in fingerprints}


def run(song_path: Path, clip_start_sec: float, clip_len_sec: float) -> float:
    waveform, sr = load_audio(song_path)
    duration_sec = len(waveform) / sr
    print(f"Song: {song_path.name}  ({duration_sec:.1f}s @ {sr} Hz)")

    full_fps = fingerprint_audio(waveform, sample_rate=sr)
    full_hashes = hash_set(full_fps)

    start = int(clip_start_sec * sr)
    end = min(int((clip_start_sec + clip_len_sec) * sr), len(waveform))
    clip = waveform[start:end]
    clip_fps = fingerprint_audio(clip, sample_rate=sr)
    clip_hashes = hash_set(clip_fps)

    if not clip_hashes:
        print("No clip hashes generated.")
        return 0.0

    shared = clip_hashes & full_hashes
    overlap = len(shared) / len(clip_hashes)

    print(f"Full song hashes:  {len(full_hashes)}")
    print(f"Clip hashes:       {len(clip_hashes)}  (from {clip_start_sec:.0f}-{clip_start_sec + clip_len_sec:.0f}s)")
    print(f"Shared hashes:     {len(shared)}")
    print(f"Overlap ratio:     {overlap:.1%}")
    return overlap


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Clip-vs-song fingerprint overlap diagnostic.")
    parser.add_argument("--song", type=Path, default=None, help="Audio file (default: first in Dataset/)")
    parser.add_argument("--start", type=float, default=30.0, help="Clip start in seconds")
    parser.add_argument("--length", type=float, default=5.0, help="Clip length in seconds")
    return parser.parse_args()


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    args = parse_args()
    try:
        song_path = args.song or first_dataset_song(DATASET_DIR)
        overlap = run(song_path, args.start, args.length)
    except FileNotFoundError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    if overlap < 0.5:
        print("\nWARNING: low overlap; fingerprints are not reproducible enough.")
        return 2
    print("\nOK: fingerprints are reproducible between clip and full song.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
