from django.core.management.base import BaseCommand
from core.models import RadioStation


class Command(BaseCommand):
    help = 'Load radio stations from fetch.py into the database'

    def handle(self, *args, **options):
        # Radio stations from fetch.py
        radio_stations = [
            ("France Inter", "https://direct.franceinter.fr/live/franceinter-midfi.mp3"),
            ("Mosaique FM", "https://radio.mosaiquefm.net/mosalive"),
            ("Radio Nationale", "https://radio.radiotunisienne.tn/nationale"),
            ("Diwan FM", "https://streaming.diwanfm.net/stream"),
            ("Zaitouna FM", "https://radio.radiotunisienne.tn/radiozaitouna"),
            ("Express FM", "https://expressfm.ice.infomaniak.ch/expressfm-64.mp3"),
            ("Radio Jeunes", "http://rtstream.tanitweb.com/jeunes"),
            ("RTCI", "http://rtstream.tanitweb.com/rtci"),
            ("Radio Sfax", "http://rtstream.tanitweb.com/sfax"),
            ("Radio Monastir", "http://rtstream.tanitweb.com/monastir"),
            ("Oxygene FM", "https://streaming.radiooxygene.tn/oxygenefm"),
            ("Radio Le Kef", "https://radio.radiotunisienne.tn/kef"),
            ("Radio MFM", "https://stream.zeno.fm/ilg7ocmkwfgtv.m3u"),
            ("Culturelle RT", "http://rtstream.tanitweb.com/culturelle"),
            ("Knooz FM", "http://streaming.knoozfm.net:8000/knoozfm"),
            ("Misk FM", "https://live.misk.art/stream"),
            ("IFM", "https://live.ifm.tn/radio/8000/ifmlive"),
        ]

        created_count = 0
        updated_count = 0

        for name, url in radio_stations:
            radio_station, created = RadioStation.objects.get_or_create(
                name=name,
                defaults={'url': url, 'is_active': True}
            )
            
            if created:
                self.stdout.write(
                    self.style.SUCCESS(f'✅ Created radio station: {name}')
                )
                created_count += 1
            else:
                # Update URL if it's different
                if radio_station.url != url:
                    radio_station.url = url
                    radio_station.save()
                    self.stdout.write(
                        self.style.WARNING(f'🔄 Updated URL for: {name}')
                    )
                    updated_count += 1
                else:
                    self.stdout.write(
                        self.style.WARNING(f'⏩ Already exists: {name}')
                    )

        self.stdout.write(
            self.style.SUCCESS(
                f'\n🎉 Summary: {created_count} created, {updated_count} updated'
            )
        )
