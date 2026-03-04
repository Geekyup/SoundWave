from django.core.management.base import BaseCommand

from apps.uploader.audio_preview import ensure_audio_preview
from apps.uploader.models import Loop, Sample


class Command(BaseCommand):
    help = 'Generate missing/old preview audio files for loops and samples.'

    def handle(self, *args, **options):
        total = 0
        ok = 0

        for model in (Loop, Sample):
            queryset = model.objects.all().only('id', 'audio_file', 'preview_file', 'preview_source_file')
            for instance in queryset.iterator():
                audio_name = (instance.audio_file.name or '').strip()
                if not audio_name:
                    continue
                total += 1
                if ensure_audio_preview(instance):
                    ok += 1

        self.stdout.write(self.style.SUCCESS(f'Preview generation finished: {ok}/{total} processed successfully.'))
