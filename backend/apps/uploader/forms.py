from django import forms
from django.core.exceptions import ValidationError
from mutagen import File as MutagenFile
from .models import Loop, Sample


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
        validator = validate_audio_duration_max(10)
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


class LoopUploadForm(forms.ModelForm):
    audio_file = forms.FileField(
        widget=forms.FileInput(attrs={
            'class': 'form-control',
            'accept': 'audio/*',
        }),
        validators=[validate_audio_duration_max(60)], 
        help_text='Maximum duration: 1 minute'
    )
    
    class Meta:
        model = Loop
        fields = ['name', 'genre', 'bpm', 'audio_file', 'keywords'] 
        widgets = {
            'name': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Track title',
            }),
            'genre': forms.Select(attrs={
                'class': 'form-control'
            }),
            'bpm': forms.NumberInput(attrs={
                'class': 'form-control',
                'placeholder': '120',
                'min': '40',
                'max': '300',
            }),
            'keywords': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Enter keywords',
            }),
        }

class SampleUploadForm(forms.ModelForm):
    audio_file = forms.FileField(
        widget=forms.FileInput(attrs={
            'class': 'form-control',
            'accept': 'audio/*',
        }),
        validators=[validate_audio_duration_max(10)],
        help_text='Maximum duration: 10 seconds'
    )
    
    class Meta:
        model = Sample
        fields = ['name', 'sample_type', 'genre', 'audio_file']
        widgets = {
            'name': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Sample name',
            }),
            'sample_type': forms.Select(attrs={
                'class': 'form-control'
            }),
            'genre': forms.Select(attrs={
                'class': 'form-control'
            }),
        }
