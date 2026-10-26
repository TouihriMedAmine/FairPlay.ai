"""Fingerprint matching with time alignment and scoring."""

from collections import defaultdict
from dataclasses import dataclass

import config
from db import get_songs_bulk, lookup_hashes

MIN_MATCHES = 15
MIN_INLIERS = 8
MIN_SCORE = config.DEFAULT_MIN_CONFIDENCE
MAX_CANDIDATES = 100
OFFSET_BIN_MS = 50
INLIER_WINDOW_MS = 200


@dataclass
class MatchResult:
    song_id: int
    title: str
    artist: str
    album: str | None
    confidence: float
    offset_ms: int
    match_count: int


def _bin_offsets(offsets: list[int], bin_size: int = OFFSET_BIN_MS) -> dict[int, int]:
    histogram: dict[int, int] = defaultdict(int)
    for offset in offsets:
        histogram[offset // bin_size] += 1
    return histogram


def _find_peak_bin(histogram: dict[int, int]) -> tuple[int, int]:
    if not histogram:
        return 0, 0
    peak_bin = max(histogram, key=lambda b: histogram[b])
    return peak_bin, histogram[peak_bin]


def _count_inliers(offsets: list[int], peak_bin: int, window_ms: int = INLIER_WINDOW_MS) -> int:
    peak_offset = peak_bin * OFFSET_BIN_MS
    return sum(1 for o in offsets if abs(o - peak_offset) <= window_ms)


def _compute_confidence(inlier_count: int, query_fingerprint_count: int) -> float:
    """
    Confidence = fraction of query fingerprints that align to the candidate.

    This is length-independent (both terms scale with clip length) and lives in
    [0, 1], so the same value can be both reported and used as the admission
    threshold. It intentionally does NOT depend on the reference song's total
    fingerprint count, which previously biased scoring toward short tracks.
    """
    if query_fingerprint_count <= 0:
        return 0.0
    return min(inlier_count / query_fingerprint_count, 1.0)


def identify(
    query_fingerprints: list[tuple[int, int, int]],
    db_path: str = config.DB_PATH,
    top_k: int = config.DEFAULT_MAX_RESULTS,
    min_confidence: float = MIN_SCORE,
) -> list[MatchResult]:
    """
    Match query fingerprints against the database.

    query_fingerprints: list of (hash, _, query_time_ms)
    """
    if not query_fingerprints:
        return []

    hash_to_query_times: dict[int, list[int]] = defaultdict(list)
    for h, _, q_time in query_fingerprints:
        hash_to_query_times[h].append(q_time)

    lookup = lookup_hashes(list(hash_to_query_times.keys()), db_path=db_path)

    candidates: dict[int, list[tuple[int, int]]] = defaultdict(list)
    for h, q_times in hash_to_query_times.items():
        for song_id, s_time in lookup.get(h, []):
            for q_time in q_times:
                candidates[song_id].append((q_time, s_time))

    filtered = {sid: m for sid, m in candidates.items() if len(m) >= MIN_MATCHES}
    if not filtered:
        return []

    ranked_candidates = sorted(
        filtered.items(),
        key=lambda item: len(item[1]),
        reverse=True,
    )[:MAX_CANDIDATES]

    query_count = len(query_fingerprints)
    scored: list[tuple[int, int, int]] = []  # (song_id, inlier_count, offset_ms)

    for song_id, matches in ranked_candidates:
        offsets = [s_time - q_time for q_time, s_time in matches]
        histogram = _bin_offsets(offsets)
        peak_bin, _ = _find_peak_bin(histogram)
        inlier_count = _count_inliers(offsets, peak_bin)

        if inlier_count < MIN_INLIERS:
            continue
        if _compute_confidence(inlier_count, query_count) < min_confidence:
            continue

        scored.append((song_id, inlier_count, peak_bin * OFFSET_BIN_MS))

    if not scored:
        return []

    # Rank by raw aligned-inlier count (strongest evidence wins).
    scored.sort(key=lambda item: item[1], reverse=True)
    scored = scored[:top_k]

    metadata = get_songs_bulk([sid for sid, _, _ in scored], db_path=db_path)

    results: list[MatchResult] = []
    for song_id, inlier_count, offset_ms in scored:
        meta = metadata.get(song_id)
        if not meta:
            continue
        results.append(
            MatchResult(
                song_id=song_id,
                title=meta["title"],
                artist=meta["artist"],
                album=meta.get("album"),
                confidence=_compute_confidence(inlier_count, query_count),
                offset_ms=offset_ms,
                match_count=inlier_count,
            )
        )

    return results
