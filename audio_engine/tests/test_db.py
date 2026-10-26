import pytest

from db import (
    get_song,
    init_db,
    insert_fingerprints,
    insert_song,
    lookup_hashes,
    delete_song,
)


@pytest.fixture
def db_path(tmp_path):
    path = tmp_path / "test.db"
    init_db(path)
    return path


def test_insert_and_lookup_fingerprints(db_path):
    song_id = insert_song("Test Song", "Test Artist", 30000, db_path=db_path)
    fingerprints = [(12345, song_id, 1000), (67890, song_id, 2000)]
    count = insert_fingerprints(song_id, fingerprints, 30000, db_path=db_path)

    assert count == 2
    result = lookup_hashes([12345, 67890, 99999], db_path=db_path)
    assert result[12345] == [(song_id, 1000)]
    assert result[67890] == [(song_id, 2000)]
    assert 99999 not in result


def test_get_and_delete_song(db_path):
    song_id = insert_song("Delete Me", "Artist", 10000, album="Album", db_path=db_path)
    song = get_song(song_id, db_path=db_path)

    assert song["title"] == "Delete Me"
    assert song["artist"] == "Artist"
    assert song["album"] == "Album"
    assert delete_song(song_id, db_path=db_path) is True
    assert get_song(song_id, db_path=db_path) is None
