from pathlib import Path

from django.contrib import admin

from .models import RadioStation, SongPlayed, SongDetails, DetailBackfillRequest
from .engine_models import CatalogSong
from . import backfill

DATASET_DIR = Path(__file__).resolve().parent.parent.parent / 'audio_engine' / 'Dataset'


def _fmt_ms(ms):
    s = int((ms or 0) / 1000)
    return f"{s // 60}:{s % 60:02d}"


def _enqueue_backfill(request_objs, source='catalog'):
    created = 0
    for obj in request_objs:
        title = getattr(obj, 'title', '')
        artist = getattr(obj, 'artist', '')
        if not title or not artist:
            continue
        _, was_created = DetailBackfillRequest.objects.get_or_create(
            title=title, artist=artist, status='pending', source=source)
        if was_created:
            created += 1
    if created:
        backfill.ensure_worker()
    return created


@admin.register(CatalogSong)
class CatalogSongAdmin(admin.ModelAdmin):
    list_display = ('title', 'artist', 'album', 'duration', 'fingerprint_count',
                    'mp3_present', 'engine_created_at')
    search_fields = ('title', 'artist', 'album')
    ordering = ('title',)
    actions = ('backfill_selected_action', 'backfill_all_action')

    @admin.action(description='Backfill details via Shazam (selected)')
    def backfill_selected_action(self, request, queryset):
        created = _enqueue_backfill(queryset)
        self.message_user(request, f"{created} backfill request(s) queued (skipped already-pending).")

    @admin.action(description='Backfill details via Shazam (ALL catalog songs)')
    def backfill_all_action(self, request, queryset):
        created = _enqueue_backfill(CatalogSong.objects.all())
        self.message_user(request, f"{created} backfill request(s) queued for the whole catalog.")

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.extra(select={
            'fc': 'SELECT fingerprint_count FROM song_stats '
                  'WHERE song_stats.song_id = songs.song_id',
            'engine_created': 'songs.created_at',
        })

    @admin.display(description='duration')
    def duration(self, obj):
        return _fmt_ms(getattr(obj, 'duration_ms', None))

    @admin.display(description='fingerprints', ordering=None)
    def fingerprint_count(self, obj):
        return getattr(obj, 'fc', None)

    @admin.display(description='created', ordering=None)
    def engine_created_at(self, obj):
        return getattr(obj, 'engine_created', None)

    @admin.display(description='mp3', boolean=True)
    def mp3_present(self, obj):
        return (
            (DATASET_DIR / f"{obj.title}.mp3").exists()
            or (DATASET_DIR / f"{obj.title} - {obj.artist}.mp3").exists()
            or any(DATASET_DIR.glob(f"*{obj.title.split(' (')[0]}*.mp3"))
        )

    # The engine DB is owned by the running fetcher; keep admin read-only
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(SongDetails)
class SongDetailsAdmin(admin.ModelAdmin):
    list_display = ('title', 'artist', 'album', 'label', 'released', 'updated_at')
    search_fields = ('title', 'artist', 'album', 'label')
    readonly_fields = ('shazam_key', 'raw', 'updated_at')
    fieldsets = (
        ('Song', {'fields': ('title', 'artist', 'album')}),
        ('Credits', {'fields': ('label', 'released', 'writers', 'performers', 'genres')}),
        ('Source', {'fields': ('artwork_url', 'shazam_key', 'raw', 'updated_at')}),
    )


@admin.register(RadioStation)
class RadioStationAdmin(admin.ModelAdmin):
    list_display = ('name', 'url', 'is_active', 'created_at')
    list_filter = ('is_active', 'created_at')
    search_fields = ('name', 'url')
    list_editable = ('is_active',)


@admin.register(SongPlayed)
class SongPlayedAdmin(admin.ModelAdmin):
    list_display = ('title', 'artist', 'radio_name', 'start_time', 'duration')
    search_fields = ('title', 'artist', 'radio_name')
    actions = ('backfill_selected_action',)

    @admin.action(description='Backfill details via Shazam (selected)')
    def backfill_selected_action(self, request, queryset):
        created = _enqueue_backfill(queryset, source='played')
        self.message_user(request, f"{created} backfill request(s) queued.")


@admin.register(DetailBackfillRequest)
class DetailBackfillRequestAdmin(admin.ModelAdmin):
    list_display = ('title', 'artist', 'source', 'status', 'note', 'updated_at')
    list_filter = ('status', 'source')
    search_fields = ('title', 'artist')
    actions = ('rerun_selected_action',)

    @admin.action(description='Re-run selected (back to pending)')
    def rerun_selected_action(self, request, queryset):
        updated = (queryset.exclude(status='pending')
                   .update(status='pending', note=''))
        backfill.ensure_worker()
        self.message_user(request, f"{updated} request(s) back to pending.")
