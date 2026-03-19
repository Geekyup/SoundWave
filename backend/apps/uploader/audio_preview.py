import logging
import os
import shutil
import subprocess
import tempfile
import uuid
from pathlib import Path

from django.core.files.storage import default_storage


logger = logging.getLogger(__name__)


def _ffmpeg_available():
    return shutil.which('ffmpeg') is not None


def _build_preview_name(instance, source_name):
    model_name = instance.__class__.__name__.lower()
    if model_name == 'loop':
        folder = 'loops/previews'
    else:
        folder = 'samples/previews'

    stem = Path(source_name or 'audio').stem
    safe_stem = ''.join(ch for ch in stem if ch.isalnum() or ch in ('-', '_')).strip('_-') or 'audio'
    return f'{folder}/{instance.pk}-{safe_stem}-{uuid.uuid4().hex[:8]}.m4a'


def _delete_storage_file(name):
    if not name:
        return
    try:
        if default_storage.exists(name):
            default_storage.delete(name)
    except Exception:
        logger.exception('Failed to delete preview file: %s', name)


def _transcode_preview(source_path, output_path):
    command = [
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
    process = subprocess.run(
        command,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        check=False,
    )
    return process.returncode == 0


def _prepare_source_file(audio_field, source_name, temp_dir):
    try:
        return audio_field.path
    except Exception:
        pass

    suffix = Path(source_name).suffix or '.bin'
    temp_source = os.path.join(temp_dir, f'source{suffix}')

    try:
        with audio_field.open('rb') as source_stream, open(temp_source, 'wb') as target_stream:
            shutil.copyfileobj(source_stream, target_stream)
        return temp_source
    except Exception:
        return None


def ensure_audio_preview(instance):
    """
    Build/refresh lightweight preview audio for faster streaming playback.
    Returns True if preview is present or generated successfully.
    """
    audio_field = getattr(instance, 'audio_file', None)
    source_name = (getattr(audio_field, 'name', None) or '').strip()
    if not source_name:
        return False

    current_preview_source = (getattr(instance, 'preview_source_file', None) or '').strip()
    current_preview_name = (getattr(getattr(instance, 'preview_file', None), 'name', None) or '').strip()
    if current_preview_name and current_preview_source == source_name:
        return True

    if not _ffmpeg_available():
        logger.warning('ffmpeg is not available, preview generation skipped for %s:%s', instance.__class__.__name__, instance.pk)
        return False

    with tempfile.TemporaryDirectory(prefix='soundwave-preview-') as temp_dir:
        source_path = _prepare_source_file(audio_field, source_name, temp_dir)
        if not source_path:
            logger.warning(
                'Unable to resolve source path for %s:%s',
                instance.__class__.__name__,
                instance.pk,
            )
            return False

        temp_output = os.path.join(temp_dir, 'preview.m4a')
        ok = _transcode_preview(source_path, temp_output)
        if not ok or not os.path.exists(temp_output):
            logger.warning('Preview transcode failed for %s:%s', instance.__class__.__name__, instance.pk)
            return False

        preview_name = _build_preview_name(instance, source_name)
        with open(temp_output, 'rb') as preview_stream:
            stored_name = default_storage.save(preview_name, preview_stream)

    old_preview_name = current_preview_name if current_preview_name and current_preview_name != stored_name else ''
    instance.__class__.objects.filter(pk=instance.pk).update(
        preview_file=stored_name,
        preview_source_file=source_name,
    )
    instance.preview_file.name = stored_name
    instance.preview_source_file = source_name

    if old_preview_name:
        _delete_storage_file(old_preview_name)

    return True
