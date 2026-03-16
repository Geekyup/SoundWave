from django.conf import settings
from django.core.files.storage import default_storage

try:
    from cloudinary_storage.storage import MediaCloudinaryStorage, RawMediaCloudinaryStorage
except Exception:  # pragma: no cover - optional dependency
    MediaCloudinaryStorage = None
    RawMediaCloudinaryStorage = None


def get_image_storage():
    if getattr(settings, "USE_CLOUDINARY", False) and MediaCloudinaryStorage:
        return MediaCloudinaryStorage()
    return default_storage


def get_raw_storage():
    if getattr(settings, "USE_CLOUDINARY", False) and RawMediaCloudinaryStorage:
        return RawMediaCloudinaryStorage()
    return default_storage
