"""SQLite storage for songs and fingerprint inverted index."""

import sqlite3
from pathlib import Path

import config

DEFAULT_DB_PATH = config.DB_PATH

# SQLite bind-variable limit is 999 in older builds; stay well under it.
_MAX_SQL_VARIABLES = 900
# Hashes matching more rows than this are treated as non-discriminative
# ("stop words") and skipped during lookup to bound memory and latency.
MAX_ROWS_PER_HASH = 2000


def get_connection(db_path: str | Path = DEFAULT_DB_PATH) -> sqlite3.Connection:
    conn = sqlite3.connect(str(db_path), timeout=30.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA synchronous = NORMAL")
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def _chunked(items: list, size: int):
    for start in range(0, len(items), size):
        yield items[start : start + size]


def init_db(db_path: str | Path = DEFAULT_DB_PATH) -> None:
    conn = get_connection(db_path)
    try:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS songs (
                song_id       INTEGER PRIMARY KEY AUTOINCREMENT,
                title         TEXT NOT NULL,
                artist        TEXT NOT NULL,
                album         TEXT,
                duration_ms   INTEGER NOT NULL,
                fingerprint_version INTEGER DEFAULT 1,
                created_at    TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS fingerprints (
                hash          INTEGER NOT NULL,
                song_id       INTEGER NOT NULL REFERENCES songs(song_id) ON DELETE CASCADE,
                anchor_time   INTEGER NOT NULL,
                PRIMARY KEY (hash, song_id, anchor_time)
            );

            CREATE INDEX IF NOT EXISTS idx_fingerprints_hash ON fingerprints (hash);
            CREATE INDEX IF NOT EXISTS idx_fingerprints_song ON fingerprints (song_id);

            CREATE TABLE IF NOT EXISTS song_stats (
                song_id            INTEGER PRIMARY KEY REFERENCES songs(song_id) ON DELETE CASCADE,
                fingerprint_count  INTEGER NOT NULL,
                avg_peak_density   REAL NOT NULL
            );
            """
        )
        conn.commit()
    finally:
        conn.close()


def get_song_id_by_title(
    title: str,
    db_path: str | Path = DEFAULT_DB_PATH,
) -> int | None:
    conn = get_connection(db_path)
    try:
        row = conn.execute(
            "SELECT song_id FROM songs WHERE title = ?",
            (title,),
        ).fetchone()
        return row["song_id"] if row else None
    finally:
        conn.close()


def insert_song(
    title: str,
    artist: str,
    duration_ms: int,
    album: str | None = None,
    db_path: str | Path = DEFAULT_DB_PATH,
) -> int:
    conn = get_connection(db_path)
    try:
        cur = conn.execute(
            """
            INSERT INTO songs (title, artist, album, duration_ms)
            VALUES (?, ?, ?, ?)
            """,
            (title, artist, album, duration_ms),
        )
        conn.commit()
        return int(cur.lastrowid)
    finally:
        conn.close()


def insert_fingerprints(
    song_id: int,
    fingerprints: list[tuple[int, int, int]],
    duration_ms: int,
    db_path: str | Path = DEFAULT_DB_PATH,
) -> int:
    conn = get_connection(db_path)
    try:
        rows = [(h, song_id, anchor_time) for h, _, anchor_time in fingerprints]
        conn.executemany(
            "INSERT OR IGNORE INTO fingerprints (hash, song_id, anchor_time) VALUES (?, ?, ?)",
            rows,
        )
        count = len(rows)
        density = count / max(duration_ms / 1000.0, 0.001)
        conn.execute(
            """
            INSERT OR REPLACE INTO song_stats (song_id, fingerprint_count, avg_peak_density)
            VALUES (?, ?, ?)
            """,
            (song_id, count, density),
        )
        conn.commit()
        return count
    finally:
        conn.close()


def lookup_hashes(
    hashes: list[int],
    db_path: str | Path = DEFAULT_DB_PATH,
    max_rows_per_hash: int = MAX_ROWS_PER_HASH,
) -> dict[int, list[tuple[int, int]]]:
    """
    Return hash -> [(song_id, anchor_time_ms), ...].

    The query hash list is de-duplicated and issued in batches to respect
    SQLite's bind-variable limit. Hashes that resolve to an excessive number of
    rows are dropped as non-discriminative to bound memory and latency.
    """
    unique_hashes = list({int(h) for h in hashes})
    if not unique_hashes:
        return {}

    result: dict[int, list[tuple[int, int]]] = {}
    conn = get_connection(db_path)
    try:
        for batch in _chunked(unique_hashes, _MAX_SQL_VARIABLES):
            placeholders = ",".join("?" * len(batch))
            rows = conn.execute(
                f"""
                SELECT hash, song_id, anchor_time
                FROM fingerprints
                WHERE hash IN ({placeholders})
                """,
                batch,
            ).fetchall()
            for row in rows:
                result.setdefault(row["hash"], []).append((row["song_id"], row["anchor_time"]))
    finally:
        conn.close()

    return {h: rows for h, rows in result.items() if len(rows) <= max_rows_per_hash}


def get_songs_bulk(
    song_ids: list[int],
    db_path: str | Path = DEFAULT_DB_PATH,
) -> dict[int, dict]:
    """Fetch metadata + fingerprint_count for many songs in one round trip."""
    unique_ids = list({int(s) for s in song_ids})
    if not unique_ids:
        return {}

    result: dict[int, dict] = {}
    conn = get_connection(db_path)
    try:
        for batch in _chunked(unique_ids, _MAX_SQL_VARIABLES):
            placeholders = ",".join("?" * len(batch))
            rows = conn.execute(
                f"""
                SELECT s.song_id, s.title, s.artist, s.album, s.duration_ms,
                       COALESCE(st.fingerprint_count, 0) AS fingerprint_count
                FROM songs s
                LEFT JOIN song_stats st ON s.song_id = st.song_id
                WHERE s.song_id IN ({placeholders})
                """,
                batch,
            ).fetchall()
            for row in rows:
                result[row["song_id"]] = dict(row)
    finally:
        conn.close()
    return result


def get_song(song_id: int, db_path: str | Path = DEFAULT_DB_PATH) -> dict | None:
    conn = get_connection(db_path)
    try:
        row = conn.execute(
            """
            SELECT s.song_id, s.title, s.artist, s.album, s.duration_ms, s.created_at,
                   COALESCE(st.fingerprint_count, 0) AS fingerprint_count
            FROM songs s
            LEFT JOIN song_stats st ON s.song_id = st.song_id
            WHERE s.song_id = ?
            """,
            (song_id,),
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def delete_song(song_id: int, db_path: str | Path = DEFAULT_DB_PATH) -> bool:
    conn = get_connection(db_path)
    try:
        cur = conn.execute("DELETE FROM songs WHERE song_id = ?", (song_id,))
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()


def get_song_stats(song_id: int, db_path: str | Path = DEFAULT_DB_PATH) -> tuple[int, float] | None:
    conn = get_connection(db_path)
    try:
        row = conn.execute(
            "SELECT fingerprint_count, avg_peak_density FROM song_stats WHERE song_id = ?",
            (song_id,),
        ).fetchone()
        if not row:
            return None
        return row["fingerprint_count"], row["avg_peak_density"]
    finally:
        conn.close()
