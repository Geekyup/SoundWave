from apps.drumkits.models import DrumKitFile

from .models import Loop, Sample


def resolve_model_for_kind(kind):
    if kind in ('loop', 'loops'):
        return Loop, 'loop'
    if kind in ('sample', 'samples'):
        return Sample, 'sample'
    if kind in ('drum-kit-file', 'drum-kit-files', 'drumkit-file', 'drumkit-files'):
        return DrumKitFile, 'drum-kit-file'
    return None, None


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
