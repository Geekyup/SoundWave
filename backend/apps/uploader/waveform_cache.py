from apps.drumkits.models import DrumKitFile

from .models import Loop, Sample

WAVEFORM_KIND_TO_MODEL = {
    'loop': (Loop, 'loop'),
    'loops': (Loop, 'loop'),
    'sample': (Sample, 'sample'),
    'samples': (Sample, 'sample'),
    'drum-kit-file': (DrumKitFile, 'drum-kit-file'),
    'drum-kit-files': (DrumKitFile, 'drum-kit-file'),
    'drumkit-file': (DrumKitFile, 'drum-kit-file'),
    'drumkit-files': (DrumKitFile, 'drum-kit-file'),
}


def resolve_model_for_kind(media_kind):
    normalized_kind = (media_kind or '').strip().lower()
    return WAVEFORM_KIND_TO_MODEL.get(normalized_kind, (None, None))


def set_cached_waveform(media_kind, object_id, audio_file_name, peaks, duration=None):
    model_class, _canonical_kind = resolve_model_for_kind(media_kind)
    if model_class is None:
        return False

    updated_rows = model_class.objects.filter(pk=object_id).update(
        waveform_peaks=peaks,
        waveform_duration=duration,
        waveform_source_file=audio_file_name or '',
    )
    return bool(updated_rows)
