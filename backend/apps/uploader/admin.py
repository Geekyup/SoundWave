from pathlib import Path

from django.contrib import admin, messages
from django.shortcuts import redirect, render
from django.urls import path, reverse

from .forms import SampleBulkUploadAdminForm
from .models import Loop, Sample


@admin.register(Loop)
class LoopAdmin(admin.ModelAdmin):
    list_display = ('name', 'author', 'genre', 'bpm', 'uploaded_at', 'downloads')
    list_filter = ('genre', 'uploaded_at')
    search_fields = ('name', 'author')
    readonly_fields = ('uploaded_at',)

@admin.register(Sample)
class SampleAdmin(admin.ModelAdmin):
    list_display = ('name', 'author', 'sample_type', 'genre', 'uploaded_at', 'downloads')
    list_filter = ('sample_type', 'genre', 'uploaded_at')
    search_fields = ('name', 'author')
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
        if request.method == 'POST':
            form = SampleBulkUploadAdminForm(request.POST, request.FILES)
            if form.is_valid():
                files = form.cleaned_data['audio_files']
                sample_type = form.cleaned_data['sample_type']
                genre = form.cleaned_data['genre']
                author = form.cleaned_data['author'].strip() or request.user.get_username() or 'admin'

                created_count = 0
                failed_uploads = []

                for audio_file in files:
                    try:
                        file_name = Path(audio_file.name).stem[:200]
                        Sample.objects.create(
                            name=file_name or 'untitled',
                            author=author,
                            sample_type=sample_type,
                            genre=genre,
                            audio_file=audio_file,
                        )
                        created_count += 1
                    except Exception as exc:
                        failed_uploads.append((audio_file.name, str(exc)))

                if created_count:
                    messages.success(
                        request,
                        f'Uploaded {created_count} sample(s) successfully.',
                    )
                    if failed_uploads:
                        failed_total = len(failed_uploads)
                        preview_errors = '; '.join(
                            f'{name}: {error}' for name, error in failed_uploads[:3]
                        )
                        tail = ' ...' if failed_total > 3 else ''
                        messages.warning(
                            request,
                            f'Failed files: {failed_total}. {preview_errors}{tail}',
                        )
                    return redirect(reverse('admin:uploader_sample_changelist'))

                messages.error(request, 'No files were uploaded. Check errors and try again.')
            else:
                messages.error(request, 'Please fix the form errors below.')
        else:
            form = SampleBulkUploadAdminForm()

        context = {
            **self.admin_site.each_context(request),
            'form': form,
            'opts': self.model._meta,
            'title': 'Bulk sample upload',
        }
        return render(request, 'admin/uploader/sample/bulk_upload.html', context)
