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