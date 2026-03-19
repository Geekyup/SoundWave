import zipfile
from threading import Thread

from django import forms
from django.contrib import admin, messages
from django.core.exceptions import ValidationError
from django.db import close_old_connections, transaction

from .models import DrumKit, DrumKitFile
from .services import import_archive_to_kit


class DrumKitAdminForm(forms.ModelForm):
    replace_files = forms.BooleanField(
        required=False,
        initial=True,
        help_text='Replace existing files when importing the uploaded archive.',
    )

    class Meta:
        model = DrumKit
        fields = '__all__'

    def clean_archive_file(self):
        archive_file = self.cleaned_data.get('archive_file')
        if not archive_file:
            return archive_file

        current_pos = archive_file.tell() if hasattr(archive_file, 'tell') else 0
        try:
            archive_file.seek(0)
            if not zipfile.is_zipfile(archive_file):
                raise ValidationError(
                    'Only ZIP archives are supported. '
                    'Please upload a valid .zip file with your drum kit folders/files.',
                )
        finally:
            try:
                archive_file.seek(current_pos)
            except Exception:
                pass

        return archive_file


class DrumKitFileInline(admin.TabularInline):
    model = DrumKitFile
    extra = 0
    fields = ('relative_path', 'duration', 'audio_file')
    readonly_fields = ('relative_path', 'duration', 'audio_file')
    can_delete = False
    show_change_link = True

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(DrumKit)
class DrumKitAdmin(admin.ModelAdmin):
    form = DrumKitAdminForm
    list_display = ('title', 'author', 'genre', 'is_public', 'file_count', 'created_at', 'downloads')
    list_filter = ('genre', 'is_public', 'created_at')
    search_fields = ('title', 'author', 'slug', 'genre')
    readonly_fields = ('slug', 'created_at', 'updated_at', 'file_count')
    inlines = [DrumKitFileInline]
    fieldsets = (
        (None, {'fields': ('title', 'slug', 'description', 'author', 'genre', 'cover', 'is_public')}),
        ('Archive import', {'fields': ('archive_file', 'replace_files')}),
        ('Meta', {'fields': ('downloads', 'file_count', 'created_at', 'updated_at')}),
    )

    def file_count(self, obj):
        return obj.files.count()

    file_count.short_description = 'Files'

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        should_import = bool(obj.archive_file and (not change or 'archive_file' in form.changed_data))
        if not should_import:
            return

        replace_files = bool(form.cleaned_data.get('replace_files', True))
        def _run_import(kit_id, replace_existing):
            close_old_connections()
            kit = DrumKit.objects.filter(pk=kit_id).first()
            if not kit or not kit.archive_file:
                return
            import_archive_to_kit(kit, replace_existing=replace_existing)
            close_old_connections()

        transaction.on_commit(lambda: Thread(
            target=_run_import,
            args=(obj.pk, replace_files),
            daemon=True,
        ).start())
        messages.info(
            request,
            'Archive import started in the background. Refresh this page in a few minutes to see files.',
        )


@admin.register(DrumKitFile)
class DrumKitFileAdmin(admin.ModelAdmin):
    list_display = ('name', 'kit', 'folder_path', 'duration', 'created_at')
    list_filter = ('kit', 'created_at')
    search_fields = ('name', 'relative_path', 'kit__title')
    readonly_fields = (
        'kit',
        'name',
        'relative_path',
        'folder_path',
        'audio_file',
        'duration',
        'created_at',
    )

    def has_add_permission(self, request):
        return False
