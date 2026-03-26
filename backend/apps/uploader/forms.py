from django import forms
from django.core.exceptions import ValidationError
from mutagen import File as MutagenFile

from .models import Loop, Sample

LOOP_MAX_DURATION_SECONDS = 300
SAMPLE_MAX_DURATION_SECONDS = 10


def format_duration_label(duration_in_seconds):
    whole_seconds = max(int(duration_in_seconds), 0)
    minutes, seconds = divmod(whole_seconds, 60)
    return f'{minutes}:{seconds:02d}'


def build_audio_files_help_text(max_duration_seconds):
    if max_duration_seconds < 60:
        duration_label = f'{int(max_duration_seconds)} seconds'
    else:
        minutes, seconds = divmod(int(max_duration_seconds), 60)
        duration_label = f'{minutes} minute' if minutes == 1 else f'{minutes} minutes'
        if seconds:
            duration_label = f'{duration_label} {seconds} seconds'

    return f'You can choose multiple files at once. Max duration: {duration_label} per file.'


def get_audio_duration_seconds(audio_file):
    audio_file.seek(0)

    try:
        audio_metadata = MutagenFile(audio_file)
    finally:
        audio_file.seek(0)

    if audio_metadata is None:
        raise ValidationError(
            'Failed to read audio file. Please ensure the file is a valid audio file.',
        )

    duration_in_seconds = getattr(getattr(audio_metadata, 'info', None), 'length', None)
    if duration_in_seconds is None:
        raise ValidationError('Failed to determine audio file duration.')

    return duration_in_seconds


def build_audio_duration_limit_validator(max_duration_seconds):
    def validate_audio_duration(audio_file):
        if not audio_file:
            return

        try:
            duration_in_seconds = get_audio_duration_seconds(audio_file)
        except ValidationError:
            raise
        except Exception:
            # Unsupported or corrupted files are handled later by upload/storage logic.
            return

        if duration_in_seconds <= max_duration_seconds:
            return

        raise ValidationError(
            f'Audio file duration ({format_duration_label(duration_in_seconds)}) exceeds the maximum allowed '
            f'({format_duration_label(max_duration_seconds)}).'
        )

    return validate_audio_duration


class MultipleAudioFileInput(forms.ClearableFileInput):
    allow_multiple_selected = True


class MultipleAudioFileField(forms.FileField):
    """FileField that returns a list of files from a multi-file input."""

    def __init__(self, *args, **kwargs):
        kwargs.setdefault(
            'widget',
            MultipleAudioFileInput(attrs={'accept': 'audio/*'}),
        )
        super().__init__(*args, **kwargs)

    def clean(self, uploaded_files_data, initial=None):
        if not uploaded_files_data:
            if self.required:
                raise ValidationError(self.error_messages['required'], code='required')
            return []

        uploaded_files = (
            uploaded_files_data
            if isinstance(uploaded_files_data, (list, tuple))
            else [uploaded_files_data]
        )
        cleaned_files = []

        for uploaded_file in uploaded_files:
            if not uploaded_file:
                continue
            cleaned_files.append(super().clean(uploaded_file, initial))

        if not cleaned_files and self.required:
            raise ValidationError(self.error_messages['required'], code='required')

        return cleaned_files


class BaseBulkUploadAdminForm(forms.Form):
    author = forms.CharField(
        label='Author',
        max_length=100,
        required=False,
        help_text='Optional. If empty, current admin username will be used.',
    )

    max_duration_seconds = None

    def clean_audio_files(self):
        uploaded_files = self.cleaned_data['audio_files']
        duration_validator = build_audio_duration_limit_validator(self.max_duration_seconds)
        validation_errors = []

        for uploaded_file in uploaded_files:
            try:
                duration_validator(uploaded_file)
            except ValidationError as validation_error:
                for error_message in validation_error.messages:
                    validation_errors.append(f'{uploaded_file.name}: {error_message}')

        if validation_errors:
            raise ValidationError(validation_errors)

        return uploaded_files


class SampleBulkUploadAdminForm(BaseBulkUploadAdminForm):
    audio_files = MultipleAudioFileField(
        label='Audio files',
        required=True,
        help_text=build_audio_files_help_text(SAMPLE_MAX_DURATION_SECONDS),
    )
    sample_type = forms.ChoiceField(
        label='Sample type',
        choices=Sample._meta.get_field('sample_type').choices,
    )
    genre = forms.ChoiceField(
        label='Genre',
        choices=Sample._meta.get_field('genre').choices,
    )

    max_duration_seconds = SAMPLE_MAX_DURATION_SECONDS


class LoopBulkUploadAdminForm(BaseBulkUploadAdminForm):
    audio_files = MultipleAudioFileField(
        label='Audio files',
        required=True,
        help_text=build_audio_files_help_text(LOOP_MAX_DURATION_SECONDS),
    )
    genre = forms.ChoiceField(
        label='Genre',
        choices=Loop._meta.get_field('genre').choices,
    )
    keywords = forms.CharField(
        label='Keywords',
        required=False,
        help_text='Applied to all uploaded loops.',
    )

    max_duration_seconds = LOOP_MAX_DURATION_SECONDS
