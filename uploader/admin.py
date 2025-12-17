from django.contrib import admin
from django import forms
from django.forms.widgets import FileInput
from .models import Loop, Sample
import os


class MultipleFileInput(FileInput):
    """Custom widget for multiple file upload without Django's built-in checks."""
    allow_multiple_selected = True

    def render(self, name, value, attrs=None, renderer=None):
        attrs = attrs or {}
        attrs['multiple'] = True
        return super().render(name, value, attrs, renderer)


class BulkSampleUploadForm(forms.Form):
    """Form for bulk sample upload."""
    audio_files = forms.FileField(
        widget=MultipleFileInput(),
        label='Select sample files',
        help_text='Select multiple files. The name will be taken from the file name.',
        required=False,
    )
    sample_type = forms.ChoiceField(
        choices=Sample.SAMPLE_TYPE_CHOICES,
        label='Sample type',
        help_text='One type for all selected files',
    )
    genre = forms.ChoiceField(
        choices=Sample._meta.get_field('genre').choices,
        label='Genre',
        help_text='One genre for all selected files',
    )


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
        """Add URL for bulk upload."""
        from django.urls import path

        urls = super().get_urls()
        custom_urls = [
            path(
                'bulk-upload/',
                self.admin_site.admin_view(self.bulk_upload_view),
                name='uploader_sample_bulk_upload',
            ),
        ]
        return custom_urls + urls

    def bulk_upload_view(self, request):
        """View handler for bulk sample upload."""
        from django.shortcuts import render, redirect
        from django.contrib import messages
        from django.urls import reverse

        if request.method == 'POST':
            files = request.FILES.getlist('audio_files')
            sample_type = request.POST.get('sample_type')
            genre = request.POST.get('genre')

            if not files:
                messages.error(request, 'Please select at least one file.')
            elif not sample_type:
                messages.error(request, 'Please select a sample type.')
            elif not genre:
                messages.error(request, 'Please select a genre.')
            else:
                success_count = 0

                for audio_file in files:
                    try:
                        file_name = os.path.splitext(audio_file.name)[0]

                        Sample.objects.create(
                            name=file_name,
                            sample_type=sample_type,
                            genre=genre,
                            audio_file=audio_file,
                        )
                        success_count += 1
                        print(f'Uploaded: {file_name}')
                    except Exception as e:
                        print(f'Error: {str(e)}')
                        messages.error(
                            request,
                            f'Error uploading {audio_file.name}: {str(e)}',
                        )

                if success_count > 0:
                    messages.success(
                        request,
                        f'Successfully uploaded {success_count} sample(s).',
                    )

                return redirect(reverse('admin:uploader_sample_changelist'))

        form = BulkSampleUploadForm()

        context = {
            'form': form,
            'title': 'Bulk sample upload',
            'site_header': self.admin_site.site_header,
            'site_title': self.admin_site.site_title,
        }
        return render(
            request,
            'admin/uploader/sample/bulk_upload.html',
            context,
        )
