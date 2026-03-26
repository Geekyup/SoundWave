import logging
import os
import shutil
import subprocess
import tempfile
import uuid
from pathlib import Path

from django.core.files.storage import default_storage

logger = logging.getLogger(__name__)

PREVIEW_DIRECTORY_BY_MODEL_NAME = {
    'loop': 'loops/previews',
    'sample': 'samples/previews',
}


def is_ffmpeg_available():
    return shutil.which('ffmpeg') is not None


def get_instance_log_label(instance):
    return f'{instance.__class__.__name__}:{instance.pk}'


def build_preview_storage_name(instance, source_file_name):
    model_name = instance.__class__.__name__.lower()
    preview_directory = PREVIEW_DIRECTORY_BY_MODEL_NAME.get(model_name, 'samples/previews')

    file_stem = Path(source_file_name or 'audio').stem
    safe_file_stem = ''.join(
        character
        for character in file_stem
        if character.isalnum() or character in ('-', '_')
    ).strip('_-') or 'audio'

    return (
        f'{preview_directory}/'
        f'{instance.pk}-{safe_file_stem}-{uuid.uuid4().hex[:8]}.m4a'
    )


def delete_storage_file_if_present(file_name):
    if not file_name:
        return

    try:
        if default_storage.exists(file_name):
            default_storage.delete(file_name)
    except Exception:
        logger.exception('Failed to delete preview file: %s', file_name)


def transcode_preview_file(source_path, output_path):
    ffmpeg_command = [
        'ffmpeg',
        '-y',
        '-i',
        source_path,
        '-vn',
        '-ac',
        '1',
        '-ar',
        '44100',
        '-c:a',
        'aac',
        '-b:a',
        '96k',
        '-movflags',
        '+faststart',
        output_path,
    ]
    completed_process = subprocess.run(
        ffmpeg_command,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        check=False,
    )
    return completed_process.returncode == 0


def resolve_audio_source_path(audio_file, source_file_name, temporary_directory):
    try:
        return audio_file.path
    except Exception:
        pass

    file_suffix = Path(source_file_name).suffix or '.bin'
    temporary_source_path = os.path.join(temporary_directory, f'source{file_suffix}')

    try:
        with audio_file.open('rb') as source_stream, open(temporary_source_path, 'wb') as target_stream:
            shutil.copyfileobj(source_stream, target_stream)
        return temporary_source_path
    except Exception:
        return None


def ensure_audio_preview(instance):
    """
    Build or refresh a lightweight preview audio file for streaming playback.
    Returns True when a preview already exists or was generated successfully.
    """
    audio_file = getattr(instance, 'audio_file', None)
    source_file_name = instance.get_audio_file_name()
    if not source_file_name:
        return False

    current_preview_name = instance.get_preview_file_name()
    if instance.has_current_preview():
        return True

    if not is_ffmpeg_available():
        logger.warning(
            'ffmpeg is not available, preview generation skipped for %s',
            get_instance_log_label(instance),
        )
        return False

    with tempfile.TemporaryDirectory(prefix='soundwave-preview-') as temporary_directory:
        source_path = resolve_audio_source_path(
            audio_file,
            source_file_name,
            temporary_directory,
        )
        if not source_path:
            logger.warning(
                'Unable to resolve source path for %s',
                get_instance_log_label(instance),
            )
            return False

        temporary_output_path = os.path.join(temporary_directory, 'preview.m4a')
        preview_was_created = transcode_preview_file(source_path, temporary_output_path)
        if not preview_was_created or not os.path.exists(temporary_output_path):
            logger.warning(
                'Preview transcode failed for %s',
                get_instance_log_label(instance),
            )
            return False

        preview_storage_name = build_preview_storage_name(instance, source_file_name)
        with open(temporary_output_path, 'rb') as preview_stream:
            stored_preview_name = default_storage.save(preview_storage_name, preview_stream)

    previous_preview_name = (
        current_preview_name
        if current_preview_name and current_preview_name != stored_preview_name
        else ''
    )
    instance.__class__.objects.filter(pk=instance.pk).update(
        preview_file=stored_preview_name,
        preview_source_file=source_file_name,
    )
    instance.preview_file.name = stored_preview_name
    instance.preview_source_file = source_file_name

    if previous_preview_name:
        delete_storage_file_if_present(previous_preview_name)

    return True
