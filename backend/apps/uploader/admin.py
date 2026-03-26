from dataclasses import dataclass, field
from pathlib import Path

from django.contrib import admin, messages
from django.db import transaction
from django.shortcuts import redirect, render
from django.urls import path, reverse

from .bpm_extraction import extract_bpm_from_filename, strip_bpm_from_name
from .forms import LoopBulkUploadAdminForm, SampleBulkUploadAdminForm
from .models import DEFAULT_LOOP_BPM, Loop, Sample
from .sample_type_extraction import detect_sample_type_and_clean_name

FAILED_UPLOAD_PREVIEW_LIMIT = 3
DEFAULT_ADMIN_AUTHOR = 'admin'


@dataclass
class BulkUploadOutcome:
    created_count: int = 0
    failed_uploads: list[tuple[str, str]] = field(default_factory=list)
    counters: dict[str, int] = field(default_factory=dict)

    def record_success(self):
        self.created_count += 1

    def record_failure(self, file_name, error):
        self.failed_uploads.append((file_name, str(error)))

    def increment(self, counter_name, amount=1):
        self.counters[counter_name] = self.counters.get(counter_name, 0) + amount

    def get_count(self, counter_name):
        return self.counters.get(counter_name, 0)


def get_uploaded_file_title(uploaded_file):
    return Path(uploaded_file.name).stem[:200]


def get_bulk_upload_author(request, form):
    requested_author = (form.cleaned_data.get('author') or '').strip()
    return requested_author or request.user.get_username() or DEFAULT_ADMIN_AUTHOR


def build_failed_upload_summary(failed_uploads):
    failed_upload_count = len(failed_uploads)
    preview_errors = '; '.join(
        f'{file_name}: {error_message}'
        for file_name, error_message in failed_uploads[:FAILED_UPLOAD_PREVIEW_LIMIT]
    )
    trailing_ellipsis = ' ...' if failed_upload_count > FAILED_UPLOAD_PREVIEW_LIMIT else ''
    return f'Failed files: {failed_upload_count}. {preview_errors}{trailing_ellipsis}'


def create_loop_from_uploaded_file(uploaded_file, *, author, genre, keywords):
    raw_title = get_uploaded_file_title(uploaded_file)
    detected_bpm = extract_bpm_from_filename(raw_title)
    used_default_bpm = detected_bpm is None
    loop_bpm = detected_bpm if detected_bpm is not None else DEFAULT_LOOP_BPM
    cleaned_title = strip_bpm_from_name(raw_title)[:200]

    Loop.objects.create(
        name=cleaned_title or raw_title or 'untitled',
        author=author,
        genre=genre,
        bpm=loop_bpm,
        keywords=keywords,
        audio_file=uploaded_file,
    )
    return used_default_bpm


def create_sample_from_uploaded_file(uploaded_file, *, author, genre, sample_type):
    raw_title = get_uploaded_file_title(uploaded_file)
    cleaned_title, resolved_sample_type = detect_sample_type_and_clean_name(
        raw_title,
        sample_type,
    )

    Sample.objects.create(
        name=cleaned_title or raw_title or 'untitled',
        author=author,
        sample_type=resolved_sample_type,
        genre=genre,
        audio_file=uploaded_file,
    )


class BulkUploadAdmin(admin.ModelAdmin):
    bulk_upload_form_class = None
    bulk_upload_admin_url_name = ''
    bulk_upload_template_name = ''
    bulk_upload_page_title = ''

    def get_urls(self):
        default_urls = super().get_urls()
        custom_urls = [
            path(
                'bulk-upload/',
                self.admin_site.admin_view(self.bulk_upload_view),
                name=self.bulk_upload_admin_url_name,
            ),
        ]
        return custom_urls + default_urls

    def changelist_view(self, request, extra_context=None):
        change_list_context = extra_context or {}
        change_list_context['bulk_upload_url'] = reverse(
            f'admin:{self.bulk_upload_admin_url_name}',
        )
        return super().changelist_view(request, change_list_context)

    def bulk_upload_view(self, request):
        form = self.get_bulk_upload_form(request)

        if request.method == 'POST':
            if form.is_valid():
                redirect_response = self.handle_valid_bulk_upload_form(request, form)
                if redirect_response is not None:
                    return redirect_response
            else:
                messages.error(request, 'Please fix the form errors below.')

        return self.render_bulk_upload_form(request, form)

    def get_bulk_upload_form(self, request):
        if request.method == 'POST':
            return self.bulk_upload_form_class(request.POST, request.FILES)
        return self.bulk_upload_form_class()

    def render_bulk_upload_form(self, request, form):
        context = {
            **self.admin_site.each_context(request),
            'form': form,
            'opts': self.model._meta,
            'title': self.bulk_upload_page_title,
        }
        return render(request, self.bulk_upload_template_name, context)

    def handle_valid_bulk_upload_form(self, request, form):
        upload_outcome = self.process_bulk_upload_form(request, form)

        if upload_outcome.created_count:
            self.add_success_messages(request, upload_outcome)
            if upload_outcome.failed_uploads:
                messages.warning(request, build_failed_upload_summary(upload_outcome.failed_uploads))
            return redirect(reverse(self.get_changelist_url_name()))

        if upload_outcome.failed_uploads:
            messages.error(
                request,
                f'No files were uploaded. {build_failed_upload_summary(upload_outcome.failed_uploads)}',
            )
        else:
            messages.error(request, 'No files were uploaded. Check errors and try again.')

        return None

    def get_changelist_url_name(self):
        return f'admin:{self.model._meta.app_label}_{self.model._meta.model_name}_changelist'

    def process_bulk_upload_form(self, request, form):
        upload_outcome = BulkUploadOutcome()
        upload_options = self.build_upload_options(request, form)

        for uploaded_file in form.cleaned_data['audio_files']:
            try:
                with transaction.atomic():
                    self.process_uploaded_file(
                        request=request,
                        form=form,
                        uploaded_file=uploaded_file,
                        upload_outcome=upload_outcome,
                        upload_options=upload_options,
                    )
            except Exception as error:
                upload_outcome.record_failure(uploaded_file.name, error)
            else:
                upload_outcome.record_success()

        return upload_outcome

    def build_upload_options(self, request, form):
        return {}

    def process_uploaded_file(self, *, request, form, uploaded_file, upload_outcome, upload_options):
        raise NotImplementedError

    def add_success_messages(self, request, upload_outcome):
        object_label = self.model._meta.verbose_name.lower()
        messages.success(
            request,
            f'Uploaded {upload_outcome.created_count} {object_label}(s) successfully.',
        )


@admin.register(Loop)
class LoopAdmin(BulkUploadAdmin):
    list_display = ('name', 'author', 'genre', 'bpm', 'uploaded_at', 'downloads')
    list_filter = ('genre', 'uploaded_at')
    search_fields = ('name', 'author')
    readonly_fields = ('uploaded_at',)
    change_list_template = 'admin/uploader/loop/change_list.html'
    bulk_upload_form_class = LoopBulkUploadAdminForm
    bulk_upload_admin_url_name = 'uploader_loop_bulk_upload'
    bulk_upload_template_name = 'admin/uploader/loop/bulk_upload.html'
    bulk_upload_page_title = 'Bulk loop upload'

    def build_upload_options(self, request, form):
        return {
            'author': get_bulk_upload_author(request, form),
            'genre': form.cleaned_data['genre'],
            'keywords': (form.cleaned_data['keywords'] or '').strip(),
        }

    def process_uploaded_file(self, *, request, form, uploaded_file, upload_outcome, upload_options):
        used_default_bpm = create_loop_from_uploaded_file(
            uploaded_file,
            author=upload_options['author'],
            genre=upload_options['genre'],
            keywords=upload_options['keywords'],
        )
        if used_default_bpm:
            upload_outcome.increment('default_bpm_count')

    def add_success_messages(self, request, upload_outcome):
        super().add_success_messages(request, upload_outcome)
        default_bpm_count = upload_outcome.get_count('default_bpm_count')
        if default_bpm_count:
            messages.warning(
                request,
                f'BPM was not found in {default_bpm_count} file(s). Default BPM=120 was used.',
            )


@admin.register(Sample)
class SampleAdmin(BulkUploadAdmin):
    list_display = ('name', 'author', 'sample_type', 'genre', 'uploaded_at', 'downloads')
    list_filter = ('sample_type', 'genre', 'uploaded_at')
    search_fields = ('name', 'author')
    readonly_fields = ('uploaded_at',)
    change_list_template = 'admin/uploader/sample/change_list.html'
    bulk_upload_form_class = SampleBulkUploadAdminForm
    bulk_upload_admin_url_name = 'uploader_sample_bulk_upload'
    bulk_upload_template_name = 'admin/uploader/sample/bulk_upload.html'
    bulk_upload_page_title = 'Bulk sample upload'

    def build_upload_options(self, request, form):
        return {
            'author': get_bulk_upload_author(request, form),
            'genre': form.cleaned_data['genre'],
            'sample_type': form.cleaned_data['sample_type'],
        }

    def process_uploaded_file(self, *, request, form, uploaded_file, upload_outcome, upload_options):
        create_sample_from_uploaded_file(
            uploaded_file,
            author=upload_options['author'],
            genre=upload_options['genre'],
            sample_type=upload_options['sample_type'],
        )
