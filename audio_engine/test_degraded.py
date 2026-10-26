"""Simulate FM degradation on catalog songs and measure match rate.

Takes a few songs from Dataset/, converts them through the same ffmpeg chain
used for radio capture (16kHz mono low-bitrate), slices 5s windows, then
checks whether the engine still identifies them against evaluation.db.
"""

import random
import subprocess
import sys
import tempfile
from pathlib import Path

ENGINE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(ENGINE_DIR))

import audio as engine_audio
import fingerprint as engine_fp
import matcher as engine_matcher

DB_PATH = str(ENGINE_DIR / "evaluation.db")
FFMPEG = "ffmpeg"


def run(ffmpeg_args):
    """Run ffmpeg to produce a degraded 5s clip. Returns (waveform, sr) or None."""
    out_path, src = ffmpeg_args
    cmd = [
        FFMPEG, "-y",
        "-i", str(src),
        "-ss", "30", "-t", "5",
        "-ac", "1", "-ar", "16000",
        "-b:a", "64k", "-vbr", "3",
        str(out_path),
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        return None
    return engine_audio.load_audio(out_path)


def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    dataset = ENGINE_DIR / "Dataset"
    songs = sorted(dataset.glob("*.mp3"))
    if not songs:
        print(f"No mp3 files under {dataset}")
        return

    random.seed(7)
    sample = random.sample(songs, min(n, len(songs)))

    matched = 0
    for src in sample:
        with tempfile.TemporaryDirectory() as td:
            out = Path(td) / "clip.wav"
            res = run((out, src))
            if res is None:
                print(f"[ffmpeg-fail] {src.name}")
                continue
            waveform, sr = res
            qfps = engine_fp.fingerprint_audio(waveform, sample_rate=sr)
            results = engine_matcher.identify(qfps, db_path=DB_PATH, min_confidence=0.01)
            ground_truth = src.stem
            if results:
                b = results[0]
                ok = b.title == ground_truth
                print(f"[{'OK ' if ok else 'WRONG'} {b.confidence:.2f}] {ground_truth} -> {b.title} ({b.match_count} inliers)")
                if ok:
                    matched += 1
            else:
                print(f"[NO-MATCH] {ground_truth}")

    print(f"\n=== {matched}/{len(sample)} correct on degraded clips")


if __name__ == "__main__":
    main()
