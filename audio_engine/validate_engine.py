"""Validate fingerprint engine on real radio segments.

Usage: python validate_engine.py [N] — sizes a random sample of segments from
recordings/segments/*/ and reports match rate, confidences and errors.
"""

import sys
from pathlib import Path
from collections import Counter

ENGINE_DIR = Path(__file__).resolve().parent
repo_root = ENGINE_DIR.parent
segment_root = repo_root / "recordings" / "segments"

sys.path.insert(0, str(ENGINE_DIR))

import audio as engine_audio
import fingerprint as engine_fp
import matcher as engine_matcher

DB_PATH = str(ENGINE_DIR / "evaluation.db")
MIN_CONF = 0.15


def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 20
    files = sorted(segment_root.glob("*/*.wav"))
    if not files:
        print(f"No segments found under {segment_root}")
        return

    # deterministic spread across stations
    step = max(1, len(files) // n)
    sample = files[::step][:n]

    matched = 0
    confidences = []
    songs = Counter()
    fails = 0

    for f in sample:
        station = f.parent.name
        try:
            waveform, sr = engine_audio.load_audio(f)
            qfps = engine_fp.fingerprint_audio(waveform, sample_rate=sr)
            if not qfps:
                print(f"[no-fp] {station}/{f.name} ({len(waveform)//sr}s)")
                fails += 1
                continue
            results = engine_matcher.identify(qfps, db_path=DB_PATH, min_confidence=MIN_CONF)
            if results:
                b = results[0]
                matched += 1
                confidences.append(b.confidence)
                songs[f"{b.title} — {b.artist}"] += 1
                print(f"[MATCH {b.confidence:.2f}] {station}/{f.name} -> {b.title} - {b.artist} ({b.match_count} inliers)")
            else:
                print(f"[no-match] {station}/{f.name}")
        except Exception as e:
            fails += 1
            print(f"[ERROR] {station}/{f.name}: {e}")

    total = len(sample)
    print(f"\n=== {matched}/{total} matched ({100*matched/total:.0f}%), {fails} errors")
    if confidences:
        print(f"confidence: min={min(confidences):.2f} mean={sum(confidences)/len(confidences):.2f} max={max(confidences):.2f}")
    print("songs:")
    for s, c in songs.most_common(10):
        print(f"  {c}x {s}")


if __name__ == "__main__":
    main()
