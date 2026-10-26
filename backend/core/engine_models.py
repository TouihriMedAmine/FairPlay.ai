from django.db import models


class CatalogSong(models.Model):
    """Row in the fingerprint engine's songs table (read-only mirror).

    Backed by audio_engine/evaluation.db -> songs table; the mp3 files live in
    audio_engine/Dataset and are owned by the engine."""

    song_id = models.AutoField(primary_key=True)
    title = models.CharField(max_length=255)
    artist = models.CharField(max_length=255)
    album = models.CharField(max_length=255, blank=True, null=True)
    duration_ms = models.BigIntegerField()
    fingerprint_version = models.IntegerField(default=1)
    created_at = models.CharField(max_length=64, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'songs'
        ordering = ('title',)
        verbose_name = 'Catalog song'
        verbose_name_plural = 'Catalog songs'

    def __str__(self):
        return f"{self.title} - {self.artist}"


class CatalogSongStats(models.Model):
    song_id = models.AutoField(primary_key=True)
    fingerprint_count = models.BigIntegerField()
    avg_peak_density = models.FloatField()

    class Meta:
        managed = False
        db_table = 'song_stats'
        verbose_name = 'Catalog song stats'
        verbose_name_plural = 'Catalog song stats'

    def __str__(self):
        return f"song_id={self.song_id}: {self.fingerprint_count}"
