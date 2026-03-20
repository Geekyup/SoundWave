from pathlib import Path

from django.contrib import admin, messages
from django.shortcuts import redirect, render
from django.urls import path, reverse
from django.db import transaction

from .bpm_extraction import extract_bpm_from_filename, strip_bpm_from_name
from .forms import LoopBulkUploadAdminForm, SampleBulkUploadAdminForm
from .models import Loop, Sample
from .sample_type_extraction import detect_sample_type_and_clean_name


@admin.register(Loop)
class LoopAdmin(admin.ModelAdmin):
    list_display = ('name', 'author', 'genre', 'bpm', 'uploaded_at', 'downloads')
    list_filter = ('genre', 'uploaded_at')
    search_fields = ('name', 'author')
    readonly_fields = ('uploaded_at',)
    change_list_template = 'admin/uploader/loop/change_list.html'

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('bulk-upload/', self.admin_site.admin_view(self.bulk_upload_view),
                 name='uploader_loop_bulk_upload'),
        ]
        return custom_urls + urls

    def changelist_view(self, request, extra_context=None):
        extra_context = extra_context or {}
        extra_context['bulk_upload_url'] = reverse('admin:uploader_loop_bulk_upload')
        return super().changelist_view(request, extra_context)

    def bulk_upload_view(self, request):
        if request.method == 'POST':
            form = LoopBulkUploadAdminForm(request.POST, request.FILES)
            if form.is_valid():
                files = form.cleaned_data['audio_files']
                genre = form.cleaned_data['genre']
                keywords = (form.cleaned_data['keywords'] or '').strip()
                author = form.cleaned_data['author'].strip() or request.user.get_username() or 'admin'

                created_count = 0
                fallback_bpm_count = 0
                failed_uploads = []

                for audio_file in files:
                    try:
                        with transaction.atomic():
                            raw_name = Path(audio_file.name).stem[:200]
                            bpm = extract_bpm_from_filename(raw_name)
                            if bpm is None:
                                bpm = 120
                                fallback_bpm_count += 1
                            cleaned_name = strip_bpm_from_name(raw_name)[:200]

                            Loop.objects.create(
                                name=cleaned_name or raw_name or 'untitled',
                                author=author,
                                genre=genre,
                                bpm=bpm,
                                keywords=keywords,
                                audio_file=audio_file,
                            )
                            created_count += 1
                    except Exception as exc:
                        failed_uploads.append((audio_file.name, str(exc)))

                if created_count:
                    messages.success(request, f'Uploaded {created_count} loop(s) successfully.')
                    if fallback_bpm_count:
                        messages.warning(
                            request,
                            f'BPM was not found in {fallback_bpm_count} file(s). Default BPM=120 was used.',
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
                    return redirect(reverse('admin:uploader_loop_changelist'))

                if failed_uploads:
                    failed_total = len(failed_uploads)
                    preview_errors = '; '.join(
                        f'{name}: {error}' for name, error in failed_uploads[:3]
                    )
                    tail = ' ...' if failed_total > 3 else ''
                    messages.error(
                        request,
                        f'No files were uploaded. Failed files: {failed_total}. {preview_errors}{tail}',
                    )
                else:
                    messages.error(request, 'No files were uploaded. Check errors and try again.')
            else:
                messages.error(request, 'Please fix the form errors below.')
        else:
            form = LoopBulkUploadAdminForm()

        context = {
            **self.admin_site.each_context(request),
            'form': form,
            'opts': self.model._meta,
            'title': 'Bulk loop upload',
        }
        return render(request, 'admin/uploader/loop/bulk_upload.html', context)

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
                        raw_name = Path(audio_file.name).stem[:200]
                        cleaned_name, resolved_sample_type = detect_sample_type_and_clean_name(
                            raw_name,
                            sample_type,
                        )
                        Sample.objects.create(
                            name=cleaned_name or raw_name or 'untitled',
                            author=author,
                            sample_type=resolved_sample_type,
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
