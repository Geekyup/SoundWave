import io
import posixpath
import zipfile
from pathlib import Path

from django.core.files.base import ContentFile
from mutagen import File as MutagenFile

from .models import DrumKitFile


AUDIO_EXTENSIONS = {'.wav', '.mp3', '.ogg', '.flac', '.aif', '.aiff', '.m4a'}


def _normalize_archive_path(raw_path):
    path = (raw_path or '').replace('\\', '/').strip()
    if not path:
        return ''
    normalized = posixpath.normpath(path).strip('/')
    if normalized in ('', '.'):
        return ''
    if normalized.startswith('../') or '/../' in f'/{normalized}/':
        return ''
    return normalized


def _get_audio_duration(content_bytes):
    if not content_bytes:
        return None
    try:
        audio = MutagenFile(io.BytesIO(content_bytes))
    except Exception:
        return None
    if not audio or not getattr(audio, 'info', None):
        return None
    length = getattr(audio.info, 'length', None)
    if length is None:
        return None
    try:
        duration = float(length)
    except (TypeError, ValueError):
        return None
    if duration <= 0:
        return None
    return round(duration, 3)


def import_archive_to_kit(kit, replace_existing=True):
    """
    Import audio files from a DrumKit archive file.
    Returns dict: {"created": int, "skipped": int, "errors": [str]}
    """
    result = {'created': 0, 'skipped': 0, 'errors': []}

    if not kit.archive_file:
        return result

    if replace_existing:
        for file_obj in kit.files.all():
            if file_obj.audio_file:
                file_obj.audio_file.delete(save=False)
        kit.files.all().delete()

    try:
        archive_bytes = kit.archive_file.read()
        kit.archive_file.seek(0)
    except Exception as exc:
        result['errors'].append(f'Failed to read archive: {exc}')
        return result

    _import_from_zip_bytes(kit, archive_bytes, result)

    return result


def _save_archive_member(kit, member_name, file_bytes, result):
    rel_path = _normalize_archive_path(member_name)
    if not rel_path:
        result['skipped'] += 1
        return
    if rel_path.startswith('__MACOSX/'):
        result['skipped'] += 1
        return

    basename = Path(rel_path).name
    extension = Path(basename).suffix.lower()
    if not basename or basename.startswith('.'):
        result['skipped'] += 1
        return
    if extension not in AUDIO_EXTENSIONS:
        result['skipped'] += 1
        return
    if not file_bytes:
        result['skipped'] += 1
        return

    folder = Path(rel_path).parent.as_posix()
    folder = '' if folder == '.' else folder

    file_obj = DrumKitFile(
        kit=kit,
        name=Path(basename).stem[:255] or basename[:255],
        relative_path=rel_path[:500],
        folder_path=folder[:500],
        duration=_get_audio_duration(file_bytes),
    )
    file_obj.audio_file.save(basename, ContentFile(file_bytes), save=False)
    file_obj.waveform_source_file = file_obj.audio_file.name
    file_obj.save()
    result['created'] += 1


def _import_from_zip_bytes(kit, archive_bytes, result):
    try:
        archive = zipfile.ZipFile(io.BytesIO(archive_bytes))
    except Exception as exc:
        result['errors'].append(f'Invalid ZIP archive: {exc}')
        return

    with archive:
        for member in archive.infolist():
            if member.is_dir():
                continue
            try:
                _save_archive_member(kit, member.filename, archive.read(member), result)
            except Exception as exc:
                result['errors'].append(f'{member.filename}: {exc}')
