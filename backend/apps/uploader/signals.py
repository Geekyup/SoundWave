from threading import Thread

from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from .audio_preview import ensure_audio_preview
from .models import Loop, Sample


def _schedule_preview_generation(instance):
    model = instance.__class__
    instance_id = instance.pk

    def _worker():
        obj = model.objects.filter(pk=instance_id).first()
        if not obj:
            return
        ensure_audio_preview(obj)

    Thread(target=_worker, daemon=True).start()


def _needs_preview_refresh(instance):
    audio_name = (getattr(getattr(instance, 'audio_file', None), 'name', None) or '').strip()
    if not audio_name:
        return False
    preview_name = (getattr(getattr(instance, 'preview_file', None), 'name', None) or '').strip()
    preview_source = (getattr(instance, 'preview_source_file', None) or '').strip()
    return not preview_name or preview_source != audio_name


@receiver(post_save, sender=Loop)
def loop_post_save_generate_preview(sender, instance, **kwargs):
    if not _needs_preview_refresh(instance):
        return
    transaction.on_commit(lambda: _schedule_preview_generation(instance))


@receiver(post_save, sender=Sample)
def sample_post_save_generate_preview(sender, instance, **kwargs):
    if not _needs_preview_refresh(instance):
        return
    transaction.on_commit(lambda: _schedule_preview_generation(instance))
