"""
Evaluate Shazam identification on Test clips.

Indexes full songs from Dataset/, then runs identify on every clip in every
folder under Test/ and writes a single aggregated results file.

Output line format:
    {file_name}_clip_{x}, song (from dataset): 1
    {file_name}_clip_{x}, song (from dataset): 0 -> predicted_song

Non-clip files in test folders are skipped.
Songs already in the database are not re-ingested.
"""

from __future__ import annotations

import argparse
import re
import sys
import time
from pathlib import Path

from audio import load_audio
from db import get_connection, init_db, insert_fingerprints, insert_song
from fingerprint import fingerprint_audio
from matcher import identify

ROOT = Path(__file__).resolve().parent
DATASET_DIR = ROOT / "Dataset"
TEST_DIR = ROOT / "Test"
DEFAULT_DB = ROOT / "evaluation.db"
DEFAULT_OUTPUT = ROOT / "global_clip_test_results.txt"

AUDIO_EXTENSIONS = {".mp3", ".wav", ".flac", ".ogg", ".m4a", ".opus"}
CLIP_PATTERN = re.compile(r"^(.+)_clip_(\d+)$", re.IGNORECASE)


def normalize_name(name: str) -> str:
    return name.strip().casefold()


def strip_track_number(name: str) -> str:
    """Remove a leading track-number prefix like '1. ' for display."""
    return re.sub(r"^\d+\.\s*", "", name).strip()


def song_count(db_path: Path) -> int:
    conn = get_connection(db_path)
    try:
        row = conn.execute("SELECT COUNT(*) AS n FROM songs").fetchone()
        return int(row["n"])
    finally:
        conn.close()


def find_dataset_songs(dataset_dir: Path) -> list[Path]:
    files = [
        p
        for p in dataset_dir.iterdir()
        if p.is_file() and p.suffix.lower() in AUDIO_EXTENSIONS
    ]
    return sorted(files, key=lambda p: p.name.casefold())


def get_test_folders(test_dir: Path) -> list[Path]:
    folders = sorted(
        (p for p in test_dir.iterdir() if p.is_dir()),
        key=lambda p: p.name.casefold(),
    )
    if not folders:
        raise FileNotFoundError(f"No song folders found in {test_dir}")
    return folders


def find_clips(folder: Path) -> list[Path]:
    clips = [
        p
        for p in folder.iterdir()
        if p.is_file() and p.suffix.lower() in AUDIO_EXTENSIONS and "_clip_" in p.stem
    ]
    return sorted(clips, key=lambda p: p.name.casefold())


def parse_clip_stem(stem: str) -> tuple[str, str] | None:
    match = CLIP_PATTERN.match(stem)
    if not match:
        return None
    return match.group(1), match.group(2)


def ingest_dataset(dataset_dir: Path, db_path: Path) -> int:
    songs = find_dataset_songs(dataset_dir)
    if not songs:
        raise FileNotFoundError(f"No audio files found in {dataset_dir}")

    # Determine which songs are already in the database.
    existing: set[str] = set()
    conn = get_connection(db_path)
    try:
        for row in conn.execute("SELECT title FROM songs").fetchall():
            existing.add(row["title"])
    finally:
        conn.close()

    to_process = [p for p in songs if p.stem not in existing]
    skipped = len(songs) - len(to_process)

    if skipped:
        print(f"Skipping {skipped} song(s) already in database")
    if not to_process:
        print("All songs already ingested — nothing to do.")
        return 0

    print(f"Ingesting {len(to_process)} song(s) from {dataset_dir} ...")
    ingested = 0
    start = time.perf_counter()

    for index, song_path in enumerate(to_process, start=1):
        title = song_path.stem
        print(f"  [{index}/{len(to_process)}] {title}", flush=True)

        waveform, sr = load_audio(song_path)
        duration_ms = int(len(waveform) / sr * 1000)
        song_id = insert_song(title, "Dataset", duration_ms, db_path=db_path)
        fingerprints = fingerprint_audio(waveform, song_id=song_id, sample_rate=sr)
        insert_fingerprints(song_id, fingerprints, duration_ms, db_path=db_path)
        ingested += 1

    elapsed = time.perf_counter() - start
    print(f"Ingestion complete: {ingested} song(s) in {elapsed:.1f}s")
    return ingested


def evaluate_clip(
    clip_path: Path,
    expected_song: str,
    db_path: Path,
    min_confidence: float,
) -> tuple[str, int, str | None]:
    stem = clip_path.stem
    parsed = parse_clip_stem(stem)
    if not parsed:
        raise ValueError(f"Clip name does not match expected pattern: {clip_path.name}")

    file_name, clip_index = parsed
    clip_label = f"{file_name}_clip_{clip_index}"

    waveform, sr = load_audio(clip_path)
    query_fps = fingerprint_audio(waveform, sample_rate=sr)
    matches = identify(
        query_fps,
        db_path=str(db_path),
        top_k=1,
        min_confidence=min_confidence,
    )

    predicted_title = matches[0].title if matches else None
    is_correct = (
        predicted_title is not None
        and normalize_name(predicted_title) == normalize_name(expected_song)
    )
    return clip_label, int(is_correct), predicted_title


def run_evaluation(
    test_folder: Path,
    db_path: Path,
    min_confidence: float,
    rebuild_db: bool,
) -> tuple[list[str], dict[str, int]]:
    if rebuild_db and db_path.exists():
        db_path.unlink()

    init_db(db_path)
    ingest_dataset(DATASET_DIR, db_path)

    expected_song = test_folder.name
    clips = find_clips(test_folder)
    if not clips:
        raise FileNotFoundError(f"No clips found in {test_folder}")

    print(f"\nEvaluating {len(clips)} clip(s) from: {test_folder.name}")
    print(f"Expected song: {expected_song}\n")

    lines: list[str] = []
    correct = 0
    start = time.perf_counter()

    for index, clip_path in enumerate(clips, start=1):
        clip_label, result, predicted = evaluate_clip(
            clip_path,
            expected_song=expected_song,
            db_path=db_path,
            min_confidence=min_confidence,
        )
        if result == 1:
            correct += 1

        song_display = strip_track_number(expected_song)
        if result == 1:
            line = f"{strip_track_number(clip_label)}, {song_display} (from dataset): 1"
        else:
            predicted_display = strip_track_number(predicted) if predicted else "no match"
            line = f"{strip_track_number(clip_label)}, {song_display} (from dataset): 0 -> {predicted_display}"
        lines.append(line)
        status = "OK" if result else "MISS"
        predicted_display = predicted or "no match"
        print(f"  [{index}/{len(clips)}] {status}  {clip_label}  ->  {predicted_display}")

    elapsed = time.perf_counter() - start

    summary = {
        "total": len(clips),
        "correct": correct,
        "incorrect": len(clips) - correct,
    }
    accuracy = (correct / len(clips) * 100) if clips else 0.0

    print(f"Accuracy: {correct}/{len(clips)} ({accuracy:.1f}%)")
    print(f"Evaluation time: {elapsed:.1f}s\n")
    return lines, summary


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Test Shazam clips against Dataset songs.")
    parser.add_argument(
        "--test-folder",
        type=Path,
        default=None,
        help="Single test song folder to evaluate (default: all folders under Test/)",
    )
    parser.add_argument(
        "--db",
        type=Path,
        default=DEFAULT_DB,
        help=f"SQLite database path (default: {DEFAULT_DB.name})",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"Global output results file (default: {DEFAULT_OUTPUT.name})",
    )
    parser.add_argument(
        "--min-confidence",
        type=float,
        default=0.0,
        help="Minimum confidence threshold for identify()",
    )
    parser.add_argument(
        "--rebuild",
        action="store_true",
        help="Delete and re-ingest the entire database from scratch",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    if not DATASET_DIR.is_dir():
        print(f"Dataset folder not found: {DATASET_DIR}", file=sys.stderr)
        return 1
    if not TEST_DIR.is_dir():
        print(f"Test folder not found: {TEST_DIR}", file=sys.stderr)
        return 1

    try:
        if args.test_folder:
            folders = [args.test_folder]
            if not args.test_folder.is_dir():
                print(f"Test folder not found: {args.test_folder}", file=sys.stderr)
                return 1
        else:
            folders = get_test_folders(TEST_DIR)

        all_lines: list[str] = []
        grand_total = 0
        grand_correct = 0

        for folder in folders:
            lines, summary = run_evaluation(
                test_folder=folder,
                db_path=args.db,
                min_confidence=args.min_confidence,
                rebuild_db=args.rebuild and folder == folders[0],
            )
            all_lines.extend(lines)
            grand_total += summary["total"]
            grand_correct += summary["correct"]

        args.output.write_text("\n".join(all_lines) + "\n", encoding="utf-8")

        if len(folders) > 1:
            grand_accuracy = (grand_correct / grand_total * 100) if grand_total else 0.0
            print(f"Global results written to: {args.output}")
            print(f"Global accuracy: {grand_correct}/{grand_total} ({grand_accuracy:.1f}%)")
        else:
            print(f"Results written to: {args.output}")

    except (FileNotFoundError, ValueError) as exc:
        print(str(exc), file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
