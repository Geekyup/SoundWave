from threading import Thread

from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from .audio_preview import ensure_audio_preview
from .models import Loop, Sample


def load_instance_and_generate_preview(model_class, instance_id):
    saved_instance = model_class.objects.filter(pk=instance_id).first()
    if saved_instance is None:
        return

    ensure_audio_preview(saved_instance)


def schedule_preview_generation(instance):
    worker_thread = Thread(
        target=load_instance_and_generate_preview,
        args=(instance.__class__, instance.pk),
        daemon=True,
    )
    worker_thread.start()


def instance_needs_preview_refresh(instance):
    return bool(instance.get_audio_file_name()) and not instance.has_current_preview()


@receiver(post_save, sender=Loop)
@receiver(post_save, sender=Sample)
def generate_preview_after_save(_sender, instance, **_kwargs):
    if not instance_needs_preview_refresh(instance):
        return

    transaction.on_commit(lambda: schedule_preview_generation(instance))
