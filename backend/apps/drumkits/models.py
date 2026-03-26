import os
import uuid

from django.db import models
from django.utils.text import slugify

from apps.uploader.models import GENRE_CHOICES
from SoundWave.storage_backends import get_image_storage


def drumkit_cover_upload_to(instance, filename):
    ext = os.path.splitext(filename or '')[1].lower() or '.jpg'
    slug = instance.slug or slugify(instance.title) or 'drum-kit'
    return f'drum_kits/covers/{slug}{ext}'


def drumkit_archive_upload_to(instance, filename):
    ext = os.path.splitext(filename or '')[1].lower() or '.zip'
    slug = instance.slug or slugify(instance.title) or 'drum-kit'
    return f'drum_kits/archives/{slug}{ext}'


def drumkit_audio_upload_to(instance, filename):
    ext = os.path.splitext(filename or '')[1].lower() or '.wav'
    kit_id = instance.kit_id or 'tmp'
    return f'drum_kits/files/{kit_id}/{uuid.uuid4().hex}{ext}'


class DrumKit(models.Model):
    title = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True, blank=True)
    description = models.TextField(blank=True)
    author = models.CharField(max_length=100, blank=True, default='')
    genre = models.CharField(max_length=50, choices=GENRE_CHOICES, default='other')
    cover = models.ImageField(upload_to=drumkit_cover_upload_to, blank=True, null=True, storage=get_image_storage())
    archive_file = models.FileField(upload_to=drumkit_archive_upload_to, blank=True, null=True)
    is_public = models.BooleanField(default=True)
    downloads = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Drum kit'
        verbose_name_plural = 'Drum kits'
        indexes = [
            models.Index(fields=['author'], name='drmkit_author_idx'),
            models.Index(fields=['-created_at'], name='drmkit_created_idx'),
            models.Index(fields=['-downloads'], name='drmkit_downloads_idx'),
            models.Index(fields=['author', '-created_at'], name='drmkit_author_cr_idx'),
            models.Index(fields=['is_public', '-created_at'], name='drmkit_public_cr_idx'),
        ]

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.title)[:200] or 'drum-kit'
            candidate = base
            index = 2
            while DrumKit.objects.exclude(pk=self.pk).filter(slug=candidate).exists():
                suffix = f'-{index}'
                candidate = f'{base[: max(1, 200 - len(suffix))]}{suffix}'
                index += 1
            self.slug = candidate
        super().save(*args, **kwargs)


class DrumKitFile(models.Model):
    kit = models.ForeignKey(DrumKit, on_delete=models.CASCADE, related_name='files')
    name = models.CharField(max_length=255)
    relative_path = models.CharField(max_length=500)
    folder_path = models.CharField(max_length=500, blank=True, default='')
    audio_file = models.FileField(upload_to=drumkit_audio_upload_to)
    duration = models.FloatField(null=True, blank=True, default=None)
    waveform_peaks = models.JSONField(null=True, blank=True, default=None)
    waveform_duration = models.FloatField(null=True, blank=True, default=None)
    waveform_source_file = models.CharField(max_length=500, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['relative_path']
        verbose_name = 'Drum kit file'
        verbose_name_plural = 'Drum kit files'
        constraints = [
            models.UniqueConstraint(
                fields=['kit', 'relative_path'],
                name='drumkit_unique_relative_path_per_kit',
            ),
        ]

    def __str__(self):
        return f'{self.kit.title} :: {self.relative_path}'
