from django import forms
from .models import Loop, Sample

class LoopUploadForm(forms.ModelForm):
    class Meta:
        model = Loop
        fields = ['name', 'author', 'genre', 'bpm', 'audio_file', 'keywords'] 
        widgets = {
            'name': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Track title',
            }),
            'author': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Your name',
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
            'audio_file': forms.FileInput(attrs={
                'class': 'form-control',
                'accept': 'audio/*',
            }),
            'keywords': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Enter keywords',
            }),
        }

class SampleUploadForm(forms.ModelForm):
    class Meta:
        model = Sample
        fields = ['name', 'author', 'sample_type', 'genre', 'audio_file']
        widgets = {
            'name': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Sample name',
            }),
            'author': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Your name',
            }),
            'sample_type': forms.Select(attrs={
                'class': 'form-control'
            }),
            'genre': forms.Select(attrs={
                'class': 'form-control'
            }),
            'audio_file': forms.FileInput(attrs={
                'class': 'form-control',
                'accept': 'audio/*',
            }),
        }