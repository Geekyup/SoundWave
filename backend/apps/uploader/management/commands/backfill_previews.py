from django.core.management.base import BaseCommand

from apps.uploader.audio_preview import ensure_audio_preview
from apps.uploader.models import Loop, Sample

PREVIEW_MODELS = (Loop, Sample)
PREVIEW_QUERYSET_FIELDS = ('id', 'audio_file', 'preview_file', 'preview_source_file')


class Command(BaseCommand):
    help = 'Generate missing/old preview audio files for loops and samples.'

    def handle(self, *args, **options):
        processed_count = 0
        success_count = 0
        failure_count = 0

        for model in PREVIEW_MODELS:
            queryset = model.objects.only(*PREVIEW_QUERYSET_FIELDS)
            for instance in queryset.iterator():
                if not instance.get_audio_file_name():
                    continue

                processed_count += 1

                try:
                    preview_is_ready = ensure_audio_preview(instance)
                except Exception as error:
                    failure_count += 1
                    self.stderr.write(
                        self.style.WARNING(
                            f'Failed to build preview for {model.__name__}:{instance.pk}: {error}',
                        ),
                    )
                    continue

                if preview_is_ready:
                    success_count += 1
                else:
                    failure_count += 1

        summary = (
            'Preview generation finished: '
            f'{success_count}/{processed_count} processed successfully.'
        )
        if failure_count:
            summary = f'{summary} Failures: {failure_count}.'

        self.stdout.write(self.style.SUCCESS(summary))
