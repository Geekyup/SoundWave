from django.db import models

DEFAULT_LOOP_BPM = 120
EMPTY_FILE_SIZE_LABEL = '0 MB'
DEFAULT_GENRE = 'other'
UPLOAD_MODEL_ORDERING = ['-uploaded_at']

GENRE_CHOICES = (
    ('hip-hop', 'Hip-Hop'),
    ('trap', 'Trap'),
    ('hoodtrap', 'Hoodtrap'),
    ('drill', 'Drill'),
    ('detroit', 'Detroit'),
    ('new-jazz', 'New jazz'),
    ('glo', 'Glo'),
    ('opium', 'Opium'),
    ('plug', 'Plug'),
    (DEFAULT_GENRE, 'Other'),
)

SAMPLE_TYPE_CHOICES = (
    ('bass', 'Bass'),
    ('hi_hat', 'Hi Hat'),
    ('clap', 'Clap'),
    ('kick', 'Kick'),
    ('snare', 'Snare'),
    ('tom', 'Tom'),
    ('perc', 'Perc'),
    ('other', 'Other'),
)


def build_upload_indexes(model_prefix):
    return [
        models.Index(fields=['author'], name=f'upl_{model_prefix}_author_idx'),
        models.Index(fields=['-uploaded_at'], name=f'upl_{model_prefix}_uploaded_idx'),
        models.Index(fields=['-downloads'], name=f'upl_{model_prefix}_downloads_idx'),
        models.Index(fields=['author', '-uploaded_at'], name=f'upl_{model_prefix}_author_up_idx'),
    ]


def format_audio_file_size(audio_file):
    if not audio_file:
        return EMPTY_FILE_SIZE_LABEL

    try:
        size_in_megabytes = audio_file.size / (1024 * 1024)
    except (AttributeError, OSError, ValueError):
        return EMPTY_FILE_SIZE_LABEL

    return f'{size_in_megabytes:.2f} MB'


def normalize_storage_file_name(file_field):
    return (getattr(file_field, 'name', None) or '').strip()


class AudioUploadBase(models.Model):
    name = models.CharField(max_length=200)
    genre = models.CharField(max_length=50, choices=GENRE_CHOICES, default=DEFAULT_GENRE)
    preview_source_file = models.CharField(max_length=500, blank=True, default='')
    waveform_peaks = models.JSONField(null=True, blank=True, default=None)
    waveform_duration = models.FloatField(null=True, blank=True, default=None)
    waveform_source_file = models.CharField(max_length=500, blank=True, default='')
    uploaded_at = models.DateTimeField(auto_now_add=True)
    downloads = models.IntegerField(default=0)

    class Meta:
        abstract = True

    def get_audio_file_name(self):
        return normalize_storage_file_name(getattr(self, 'audio_file', None))

    def get_preview_file_name(self):
        return normalize_storage_file_name(getattr(self, 'preview_file', None))

    def has_current_preview(self):
        audio_file_name = self.get_audio_file_name()
        if not audio_file_name:
            return False

        return (
            bool(self.get_preview_file_name())
            and self.preview_source_file.strip() == audio_file_name
        )

    def get_file_size(self):
        return format_audio_file_size(getattr(self, 'audio_file', None))


class Loop(AudioUploadBase):
    author = models.CharField(max_length=100)
    bpm = models.IntegerField(default=DEFAULT_LOOP_BPM, help_text='Tempo in BPM')
    audio_file = models.FileField(upload_to='loops/')
    preview_file = models.FileField(upload_to='loops/previews/', null=True, blank=True)
    keywords = models.CharField(max_length=300, blank=True)

    class Meta:
        ordering = UPLOAD_MODEL_ORDERING
        verbose_name = 'Loop'
        verbose_name_plural = 'Loops'
        indexes = build_upload_indexes('loop')

    def __str__(self):
        return f'{self.name} by {self.author}'


class Sample(AudioUploadBase):
    author = models.CharField(max_length=100, blank=True, default='')
    sample_type = models.CharField(max_length=20, choices=SAMPLE_TYPE_CHOICES)
    audio_file = models.FileField(upload_to='samples/')
    preview_file = models.FileField(upload_to='samples/previews/', null=True, blank=True)

    class Meta:
        ordering = UPLOAD_MODEL_ORDERING
        verbose_name = 'Sample'
        verbose_name_plural = 'Samples'
        indexes = build_upload_indexes('sample')

    def __str__(self):
        return f'{self.name} - {self.get_sample_type_display()}'
