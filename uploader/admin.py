from django.contrib import admin, messages
from django import forms
from django.urls import path, reverse
from django.shortcuts import render, redirect
from django.db import transaction
from .models import Loop, Sample
from pathlib import Path

class MultipleFileInput(forms.ClearableFileInput):
    allow_multiple_selected = True

class BulkSampleUploadForm(forms.Form):
    audio_files = forms.FileField(
        widget=MultipleFileInput(),
        label='Select sample files',
        required=True
    )
    sample_type = forms.ChoiceField(choices=Sample.SAMPLE_TYPE_CHOICES)
    genre = forms.ChoiceField(choices=Sample._meta.get_field('genre').choices)

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

    def bulk_upload_view(self, request):
        form = BulkSampleUploadForm(request.POST or None, request.FILES or None)
        
        if request.method == 'POST' and form.is_valid():
            files = request.FILES.getlist('audio_files')
            sample_type = form.cleaned_data['sample_type']
            genre = form.cleaned_data['genre']
            
            success_count = 0
            
            try:
                with transaction.atomic():
                    for f in files:
                        file_name = Path(f.name).stem  
                        Sample.objects.create(
                            name=file_name,
                            author=request.user.username if request.user.is_authenticated else '',
                            sample_type=sample_type,
                            genre=genre,
                            audio_file=f,
                        )
                        success_count += 1
                
                messages.success(request, f'Successfully uploaded {success_count} samples.')
                return redirect(reverse('admin:uploader_sample_changelist'))
            
            except Exception as e:
                messages.error(request, f'Critical error during upload: {e}')

        context = {
            **self.admin_site.each_context(request), 
            'form': form,
            'title': 'Bulk sample upload',
        }
        return render(request, 'admin/uploader/sample/bulk_upload.html', context)