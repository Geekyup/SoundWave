import os
from datetime import timedelta

from django.contrib.auth.models import User
from django.db.models import Count, F, Max, Q, Sum
from django.db.models.functions import Coalesce
from django.http import FileResponse, Http404
from django.utils import timezone
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.settings import api_settings

from apps.accounts.models import Profile, UserDownload
from apps.drumkits.models import DrumKit
from apps.uploader.models import GENRE_CHOICES, Loop, Sample

from .serializers import (
    DrumKitListSerializer,
    LoopSerializer,
    MyDownloadsDrumKitSerializer,
    MyDownloadsLoopSerializer,
    MyDownloadsSampleSerializer,
    SampleSerializer,
)

WAVEFORM_FIELDS_TO_DEFER = (
    'waveform_peaks',
    'waveform_duration',
    'waveform_source_file',
)

DOWNLOAD_TYPE_SETTINGS = {
    'loop': {
        'relation_field_name': 'loop',
        'model_class': Loop,
        'list_serializer_class': MyDownloadsLoopSerializer,
        'allows_waveform': True,
    },
    'sample': {
        'relation_field_name': 'sample',
        'model_class': Sample,
        'list_serializer_class': MyDownloadsSampleSerializer,
        'allows_waveform': True,
    },
    'drumkit': {
        'relation_field_name': 'drumkit',
        'model_class': DrumKit,
        'list_serializer_class': MyDownloadsDrumKitSerializer,
        'allows_waveform': False,
    },
}

UPLOAD_TYPE_SETTINGS = {
    'loop': {
        'model_class': Loop,
        'list_serializer_class': LoopSerializer,
        'default_ordering': '-uploaded_at',
        'allows_waveform': True,
    },
    'sample': {
        'model_class': Sample,
        'list_serializer_class': SampleSerializer,
        'default_ordering': '-uploaded_at',
        'allows_waveform': True,
    },
    'drumkit': {
        'model_class': DrumKit,
        'list_serializer_class': DrumKitListSerializer,
        'default_ordering': '-created_at',
        'allows_waveform': False,
        'include_files_count': True,
    },
}


def get_requested_media_type(request, *, query_parameter_name='type', default_value='loop'):
    return (request.query_params.get(query_parameter_name) or default_value).strip().lower()


def request_includes_waveform(request):
    return request.query_params.get('include_waveform') == '1'


def defer_waveform_fields(queryset, should_include_waveform):
    if should_include_waveform:
        return queryset
    return queryset.defer(*WAVEFORM_FIELDS_TO_DEFER)


def create_paginator():
    paginator = PageNumberPagination()
    paginator.page_size = api_settings.PAGE_SIZE
    return paginator


def build_serializer_context(request, *, should_include_waveform=False):
    return {
        'request': request,
        'include_waveform': should_include_waveform,
    }


def unsupported_media_type_response(media_collection_name):
    return Response(
        {'detail': f'Unsupported {media_collection_name} type.'},
        status=status.HTTP_400_BAD_REQUEST,
    )


def get_download_records_queryset(user, relation_field_name):
    return UserDownload.objects.filter(
        user=user,
        **{f'{relation_field_name}__isnull': False},
    ).order_by('-downloaded_at')


def get_uploaded_media_queryset(media_type, username, *, should_include_waveform=False):
    upload_settings = UPLOAD_TYPE_SETTINGS[media_type]
    queryset = upload_settings['model_class'].objects.filter(author__iexact=username)

    if upload_settings.get('include_files_count'):
        queryset = queryset.annotate(files_count=Count('files', distinct=True))

    if upload_settings.get('allows_waveform'):
        queryset = defer_waveform_fields(queryset, should_include_waveform)

    return queryset.order_by(upload_settings['default_ordering'])


def get_user_upload_counts(username):
    upload_counts = {}

    for media_type, upload_settings in UPLOAD_TYPE_SETTINGS.items():
        upload_counts[media_type] = upload_settings['model_class'].objects.filter(
            author__iexact=username,
        ).count()

    return upload_counts


def calculate_media_statistics(queryset, *, date_field_name, recent_threshold):
    return queryset.aggregate(
        count=Count('id'),
        downloads_total=Coalesce(Sum('downloads'), 0),
        latest_upload=Max(date_field_name),
        uploads_last_30=Count('id', filter=Q(**{f'{date_field_name}__gte': recent_threshold})),
    )


def normalize_waveform_peaks(peaks_payload):
    if not isinstance(peaks_payload, list):
        return None, 'peaks must be a list.'

    if len(peaks_payload) < 16:
        return None, 'peaks list is too short.'

    normalized_peaks = []
    for peak_value in peaks_payload[:8192]:
        try:
            numeric_value = float(peak_value)
        except (TypeError, ValueError):
            continue

        if numeric_value > 1.0:
            numeric_value = 1.0
        if numeric_value < -1.0:
            numeric_value = -1.0

        normalized_peaks.append(round(numeric_value, 6))

    if len(normalized_peaks) < 16:
        return None, 'peaks payload is invalid.'

    return normalized_peaks, None


def parse_waveform_duration(duration_value):
    if duration_value is None:
        return None

    try:
        duration_in_seconds = round(float(duration_value), 3)
    except (TypeError, ValueError):
        return None

    if duration_in_seconds <= 0 or duration_in_seconds > 7200:
        return None

    return duration_in_seconds


def save_user_download_record(user, *, loop=None, sample=None, drumkit=None):
    if not user or not user.is_authenticated:
        return

    download_lookup = {'user': user}
    if loop is not None:
        download_lookup['loop'] = loop
    elif sample is not None:
        download_lookup['sample'] = sample
    elif drumkit is not None:
        download_lookup['drumkit'] = drumkit
    else:
        return

    UserDownload.objects.update_or_create(
        **download_lookup,
        defaults={'downloaded_at': timezone.now()},
    )


def create_download_response(
    instance,
    model_class,
    cookie_name_prefix,
    request,
    *,
    file_field_name='audio_file',
    download_record_kwargs=None,
    missing_file_message='File not found',
):
    file_field = getattr(instance, file_field_name, None)
    if not file_field:
        raise Http404(missing_file_message)

    try:
        response = FileResponse(
            file_field,
            as_attachment=True,
            filename=os.path.basename(file_field.name),
        )
    except FileNotFoundError:
        raise Http404(missing_file_message)

    cookie_name = f'{cookie_name_prefix}_{instance.id}'
    if cookie_name not in request.COOKIES:
        model_class.objects.filter(id=instance.id).update(downloads=F('downloads') + 1)
        response.set_cookie(cookie_name, 'true', max_age=600)

    if download_record_kwargs:
        save_user_download_record(request.user, **download_record_kwargs)

    return response


def paginate_download_items(
    request,
    download_records_queryset,
    *,
    relation_field_name,
    model_class,
    serializer_class,
    should_include_waveform=False,
):
    paginator = create_paginator()
    page_items = paginator.paginate_queryset(download_records_queryset, request)
    serializer_context = build_serializer_context(
        request,
        should_include_waveform=should_include_waveform,
    )

    if not page_items:
        serializer = serializer_class([], many=True, context=serializer_context)
        return paginator.get_paginated_response(serializer.data)

    related_object_id_field = f'{relation_field_name}_id'
    related_object_ids = [
        getattr(download_record, related_object_id_field)
        for download_record in page_items
        if getattr(download_record, related_object_id_field)
    ]

    downloaded_objects_queryset = model_class.objects.filter(id__in=related_object_ids)
    if model_class in (Loop, Sample):
        downloaded_objects_queryset = defer_waveform_fields(
            downloaded_objects_queryset,
            should_include_waveform,
        )
    if model_class is DrumKit:
        downloaded_objects_queryset = downloaded_objects_queryset.annotate(
            files_count=Count('files', distinct=True),
        )

    downloaded_objects_by_id = {
        instance.id: instance
        for instance in downloaded_objects_queryset
    }

    ordered_downloaded_items = []
    for download_record in page_items:
        downloaded_object = downloaded_objects_by_id.get(
            getattr(download_record, related_object_id_field),
        )
        if downloaded_object is None:
            continue

        downloaded_object.downloaded_at = download_record.downloaded_at
        ordered_downloaded_items.append(downloaded_object)

    serializer = serializer_class(
        ordered_downloaded_items,
        many=True,
        context=serializer_context,
    )
    return paginator.get_paginated_response(serializer.data)


def paginate_queryset_items(
    request,
    queryset,
    *,
    serializer_class,
    should_include_waveform=False,
    extra_response_data=None,
):
    paginator = create_paginator()
    page_items = paginator.paginate_queryset(queryset, request)
    serializer = serializer_class(
        page_items or [],
        many=True,
        context=build_serializer_context(
            request,
            should_include_waveform=should_include_waveform,
        ),
    )
    response = paginator.get_paginated_response(serializer.data)
    if extra_response_data:
        response.data.update(extra_response_data)
    return response


def build_absolute_media_url(request, file_field):
    if not file_field:
        return None

    relative_url = file_field.url
    if request:
        return request.build_absolute_uri(relative_url)
    return relative_url


def find_user_by_username(username):
    requested_username = (username or '').strip()
    if not requested_username:
        return None

    return User.objects.select_related('profile').filter(
        username__iexact=requested_username,
    ).first()


def get_user_profile_for_summary(request, matching_user, is_own_profile):
    if matching_user is not None:
        try:
            return matching_user.profile
        except Profile.DoesNotExist:
            return None

    if not is_own_profile:
        return None

    profile, _created = Profile.objects.get_or_create(user=request.user)
    return profile


def get_top_downloaded_items(queryset, *, date_field_name):
    return list(
        queryset.order_by('-downloads', f'-{date_field_name}').values('id', 'name', 'downloads')[:5]
    )


def get_top_genre_label(*querysets):
    genre_counts = {}

    for queryset in querysets:
        for genre_row in queryset.values('genre').annotate(total=Count('id')):
            genre_key = (genre_row.get('genre') or '').strip()
            if not genre_key:
                continue

            genre_counts[genre_key] = genre_counts.get(genre_key, 0) + genre_row.get('total', 0)

    genre_labels = dict(GENRE_CHOICES)
    most_common_genre_key = max(genre_counts, key=genre_counts.get, default='')
    return genre_labels.get(most_common_genre_key, most_common_genre_key or '-')


def get_profile_summary_payload(request, username):
    requested_username = (username or '').strip()
    if not requested_username:
        return None

    matching_user = find_user_by_username(requested_username)
    displayed_username = matching_user.username if matching_user else requested_username
    is_own_profile = (
        request.user.is_authenticated
        and request.user.username.lower() == displayed_username.lower()
    )

    loop_queryset = Loop.objects.filter(author__iexact=displayed_username)
    sample_queryset = Sample.objects.filter(author__iexact=displayed_username)
    drumkit_queryset = DrumKit.objects.filter(author__iexact=displayed_username)
    if not is_own_profile and not request.user.is_staff:
        drumkit_queryset = drumkit_queryset.filter(is_public=True)

    recent_threshold = timezone.now() - timedelta(days=30)
    loop_statistics = calculate_media_statistics(
        loop_queryset,
        date_field_name='uploaded_at',
        recent_threshold=recent_threshold,
    )
    sample_statistics = calculate_media_statistics(
        sample_queryset,
        date_field_name='uploaded_at',
        recent_threshold=recent_threshold,
    )
    drumkit_statistics = calculate_media_statistics(
        drumkit_queryset,
        date_field_name='created_at',
        recent_threshold=recent_threshold,
    )

    loop_count = loop_statistics['count']
    sample_count = sample_statistics['count']
    drumkit_count = drumkit_statistics['count']
    total_uploads = loop_count + sample_count + drumkit_count
    total_downloads = (
        loop_statistics['downloads_total']
        + sample_statistics['downloads_total']
        + drumkit_statistics['downloads_total']
    )

    latest_upload_candidates = [
        loop_statistics['latest_upload'],
        sample_statistics['latest_upload'],
        drumkit_statistics['latest_upload'],
    ]
    latest_upload_at = max(
        (upload_date for upload_date in latest_upload_candidates if upload_date is not None),
        default=None,
    )
    uploads_last_30_days = (
        loop_statistics['uploads_last_30']
        + sample_statistics['uploads_last_30']
        + drumkit_statistics['uploads_last_30']
    )

    profile = get_user_profile_for_summary(request, matching_user, is_own_profile)

    return {
        'username': displayed_username,
        'is_own_profile': is_own_profile,
        'avatar_url': build_absolute_media_url(request, getattr(profile, 'avatar', None)),
        'bio': (getattr(profile, 'bio', '') or '').strip() if profile else '',
        'counts': {
            'loop': loop_count,
            'sample': sample_count,
            'drumkit': drumkit_count,
        },
        'total_uploads': total_uploads,
        'total_downloads': total_downloads,
        'uploads_last_30': uploads_last_30_days,
        'latest_upload_at': latest_upload_at,
        'top_genre': get_top_genre_label(loop_queryset, sample_queryset, drumkit_queryset),
        'top_loops': get_top_downloaded_items(loop_queryset, date_field_name='uploaded_at'),
        'top_samples': get_top_downloaded_items(sample_queryset, date_field_name='uploaded_at'),
    }
