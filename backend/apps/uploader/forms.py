from django import forms
from django.core.exceptions import ValidationError
from mutagen import File as MutagenFile

from .models import Loop, Sample


LOOP_MAX_DURATION_SECONDS = 300
SAMPLE_MAX_DURATION_SECONDS = 10


def validate_audio_duration_max(max_seconds):
    """Validator for checking maximum audio file duration"""
    def validator(audio_file):
        if not audio_file:
            return
        
        audio_file.seek(0)
        
        try:
            audio = MutagenFile(audio_file)
            
            if audio is None:
                raise ValidationError('Failed to read audio file. Please ensure the file is a valid audio file.')
            
            duration = audio.info.length if hasattr(audio.info, 'length') else None
            
            if duration is None:
                raise ValidationError('Failed to determine audio file duration.')
            
            if duration > max_seconds:
                minutes = int(max_seconds // 60)
                seconds = int(max_seconds % 60)
                actual_minutes = int(duration // 60)
                actual_seconds = int(duration % 60)
                raise ValidationError(
                    f'Audio file duration ({actual_minutes}:{actual_seconds:02d}) exceeds the maximum allowed '
                    f'({minutes}:{seconds:02d}).'
                )
        except ValidationError:
            raise
        except Exception as e:
            # If failed to read file, skip validation
            # (format may not be supported or file is corrupted)
            # In production, error logging can be added
            pass
        finally:
            # Return file to beginning
            audio_file.seek(0)
    
    return validator


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

    def clean(self, data, initial=None):
        if not data:
            if self.required:
                raise ValidationError(self.error_messages['required'], code='required')
            return []

        files = data if isinstance(data, (list, tuple)) else [data]
        cleaned_files = []

        for file_data in files:
            if not file_data:
                continue
            cleaned_files.append(super().clean(file_data, initial))

        if not cleaned_files and self.required:
            raise ValidationError(self.error_messages['required'], code='required')

        return cleaned_files


class SampleBulkUploadAdminForm(forms.Form):
    audio_files = MultipleAudioFileField(
        label='Audio files',
        required=True,
        help_text='You can choose multiple files at once. Max duration: 10 seconds per file.',
    )
    sample_type = forms.ChoiceField(
        label='Sample type',
        choices=Sample.SAMPLE_TYPE_CHOICES,
    )
    genre = forms.ChoiceField(
        label='Genre',
        choices=Sample._meta.get_field('genre').choices,
    )
    author = forms.CharField(
        label='Author',
        max_length=100,
        required=False,
        help_text='Optional. If empty, current admin username will be used.',
    )

    def clean_audio_files(self):
        files = self.cleaned_data['audio_files']
        validator = validate_audio_duration_max(SAMPLE_MAX_DURATION_SECONDS)
        errors = []

        for audio_file in files:
            try:
                validator(audio_file)
            except ValidationError as exc:
                for message in exc.messages:
                    errors.append(f'{audio_file.name}: {message}')

        if errors:
            raise ValidationError(errors)

        return files


class LoopBulkUploadAdminForm(forms.Form):
    audio_files = MultipleAudioFileField(
        label='Audio files',
        required=True,
        help_text='You can choose multiple files at once. Max duration: 5 minutes per file.',
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
    author = forms.CharField(
        label='Author',
        max_length=100,
        required=False,
        help_text='Optional. If empty, current admin username will be used.',
    )

    def clean_audio_files(self):
        files = self.cleaned_data['audio_files']
        validator = validate_audio_duration_max(LOOP_MAX_DURATION_SECONDS)
        errors = []

        for audio_file in files:
            try:
                validator(audio_file)
            except ValidationError as exc:
                for message in exc.messages:
                    errors.append(f'{audio_file.name}: {message}')

        if errors:
            raise ValidationError(errors)

        return files


