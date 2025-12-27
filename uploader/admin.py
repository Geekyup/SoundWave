from django.contrib import admin, messages
from django import forms
from django.urls import path, reverse
from django.shortcuts import render, redirect
from django.db import transaction
from .models import Loop, Sample
from .forms import validate_audio_duration_max
from pathlib import Path

class MultipleFileInput(forms.ClearableFileInput):
    allow_multiple_selected = True

class MultipleFileField(forms.FileField):
    """Custom field to handle multiple file uploads"""
    def __init__(self, *args, **kwargs):
        kwargs['widget'] = MultipleFileInput()
        super().__init__(*args, **kwargs)
    
    def clean(self, data, initial=None):
        if not data:
            if self.required:
                raise forms.ValidationError(self.error_messages['required'], code='required')
            return []
        
        if not isinstance(data, (list, tuple)):
            data = [data]
        
        result = []
        for file_data in data:
            if file_data:
                try:
                    # Validate each file
                    f = super().clean(file_data, initial)
                    result.append(f)
                except forms.ValidationError as e:
                    raise e
        
        if not result and self.required:
            raise forms.ValidationError(self.error_messages['required'], code='required')
        
        return result

class BulkSampleUploadForm(forms.Form):
    audio_files = MultipleFileField(
        label='Выбрать файлы сэмплов',
        required=True,
        help_text='Максимальная длительность: 10 секунд на файл'
    )
    sample_type = forms.ChoiceField(label='Тип сэмпла')
    genre = forms.ChoiceField(label='Жанр')
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['sample_type'].choices = Sample.SAMPLE_TYPE_CHOICES
        self.fields['genre'].choices = Sample._meta.get_field('genre').choices

@admin.register(Loop)
class LoopAdmin(admin.ModelAdmin):
    list_display = ('name', 'author', 'genre', 'bpm', 'uploaded_at', 'downloads')
    list_filter = ('genre', 'uploaded_at')
    search_fields = ('name', 'author')
    readonly_fields = ('uploaded_at',)

@admin.register(Sample)
class SampleAdmin(admin.ModelAdmin):
    list_display = ('name', 'sample_type', 'genre', 'uploaded_at', 'downloads')
    list_filter = ('sample_type', 'genre', 'uploaded_at')
    search_fields = ('name',)
    readonly_fields = ('uploaded_at',)
    change_list_template = 'admin/uploader/sample/change_list.html'

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('bulk-upload/', self.admin_site.admin_view(self.bulk_upload_view), 
                 name='uploader_sample_bulk_upload'),
        ]
        return custom_urls + urls
    
    def changelist_view(self, request, extra_context=None):
        extra_context = extra_context or {}
        extra_context['bulk_upload_url'] = reverse('admin:uploader_sample_bulk_upload')
        return super().changelist_view(request, extra_context)

    def bulk_upload_view(self, request):
        form = BulkSampleUploadForm(request.POST or None, request.FILES or None)
        
        if request.method == 'POST':
            if form.is_valid():
                files = request.FILES.getlist('audio_files')
                sample_type = form.cleaned_data['sample_type']
                genre = form.cleaned_data['genre']
                
                success_count = 0
                error_list = []
                
                # Validate all files first
                validator = validate_audio_duration_max(10)
                for f in files:
                    try:
                        validator(f)
                    except Exception as e:
                        error_list.append(f'{f.name}: {str(e)}')
                
                if error_list:
                    for error in error_list:
                        messages.error(request, error)
                else:
                    # If validation passed, save files
                    try:
                        with transaction.atomic():
                            for f in files:
                                try:
                                    file_name = Path(f.name).stem  
                                    Sample.objects.create(
                                        name=file_name,
                                        author=request.user.username if request.user.is_authenticated else 'admin',
                                        sample_type=sample_type,
                                        genre=genre,
                                        audio_file=f,
                                    )
                                    success_count += 1
                                except Exception as e:
                                    messages.warning(request, f'Failed to upload {f.name}: {str(e)}')
                        
                        if success_count > 0:
                            messages.success(request, f'Successfully uploaded {success_count} samples.')
                            return redirect(reverse('admin:uploader_sample_changelist'))
                    
                    except Exception as e:
                        messages.error(request, f'Critical error during upload: {e}')
            else:
                messages.error(request, 'Please fix the errors below.')
                for field, errors in form.errors.items():
                    for error in errors:
                        messages.error(request, f'{field}: {error}')

        context = {
            **self.admin_site.each_context(request), 
            'form': form,
            'title': 'Bulk sample upload',
        }
        return render(request, 'admin/uploader/sample/bulk_upload.html', context)