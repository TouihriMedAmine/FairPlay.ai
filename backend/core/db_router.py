"""Route the engine catalog's unmanaged models to the audio_engine database."""


class EngineDBRouter:
    engine_models = {'CatalogSong', 'CatalogSongStats'}

    def db_for_read(self, model, **hints):
        if model._meta.object_name in self.engine_models:
            return 'audio_engine'
        return None

    def db_for_write(self, model, **hints):
        return self.db_for_read(model, **hints)

    def allow_relation(self, obj1, obj2, **hints):
        allowed = self.engine_models
        if obj1._meta.object_name in allowed or obj2._meta.object_name in allowed:
            return obj1._meta.object_name in allowed and obj2._meta.object_name in allowed
        return None

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        if db == 'audio_engine':
            return False
        if model_name in {'catalogsong', 'catalogsongstats'}:
            return False
        return None
