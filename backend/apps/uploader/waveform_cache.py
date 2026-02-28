from .models import Loop, Sample


def resolve_model_for_kind(kind):
    if kind in ('loop', 'loops'):
        return Loop, 'loop'
    if kind in ('sample', 'samples'):
        return Sample, 'sample'
    return None, None


def get_cached_waveform(kind, obj_id, audio_file_name):
    model, _ = resolve_model_for_kind(kind)
    if not model:
        return None

    row = model.objects.filter(pk=obj_id).values(
        'waveform_peaks',
        'waveform_duration',
        'waveform_source_file',
    ).first()
    if not row:
        return None

    peaks = row.get('waveform_peaks')
    if not isinstance(peaks, list) or not peaks:
        return None

    source_file = row.get('waveform_source_file') or ''
    if source_file and audio_file_name and source_file != audio_file_name:
        return None

    return {
        'peaks': peaks,
        'duration': row.get('waveform_duration'),
    }


def set_cached_waveform(kind, obj_id, audio_file_name, peaks, duration=None):
    model, _ = resolve_model_for_kind(kind)
    if not model:
        return False

    updated = model.objects.filter(pk=obj_id).update(
        waveform_peaks=peaks,
        waveform_duration=duration,
        waveform_source_file=audio_file_name or '',
    )
    return bool(updated)
