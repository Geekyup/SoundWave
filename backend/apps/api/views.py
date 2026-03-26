from django.db.models import Count, Prefetch, Q
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Profile
from apps.drumkits.models import DrumKit, DrumKitFile
from apps.uploader.bpm_extraction import strip_bpm_from_name
from apps.uploader.models import Loop, Sample
from apps.uploader.waveform_cache import resolve_model_for_kind, set_cached_waveform

from .filters import LoopFilter, SampleFilter
from .permissions import IsAuthorOrStaffOrReadOnly
from .serializers import (
    DrumKitDetailSerializer,
    DrumKitListSerializer,
    LoopSerializer,
    MeSerializer,
    RegisterSerializer,
    SampleSerializer,
    build_waveform_payload,
)
from .services import (
    DOWNLOAD_TYPE_SETTINGS,
    UPLOAD_TYPE_SETTINGS,
    create_download_response,
    defer_waveform_fields,
    get_download_records_queryset,
    get_profile_summary_payload,
    get_requested_media_type,
    get_uploaded_media_queryset,
    get_user_upload_counts,
    normalize_waveform_peaks,
    paginate_download_items,
    paginate_queryset_items,
    parse_waveform_duration,
    request_includes_waveform,
    unsupported_media_type_response,
)


class WaveformContextMixin:
    def should_include_waveform(self):
        return request_includes_waveform(self.request)

    def get_serializer_context(self):
        serializer_context = super().get_serializer_context()
        serializer_context['include_waveform'] = self.should_include_waveform()
        return serializer_context


class DownloadableAudioViewSet(WaveformContextMixin, viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsAuthorOrStaffOrReadOnly]
    parser_classes = [MultiPartParser, FormParser]
    downloaded_model_class = None
    download_cookie_name_prefix = ''
    download_record_field_name = ''

    def get_queryset(self):
        return defer_waveform_fields(
            super().get_queryset(),
            self.should_include_waveform(),
        )

    @action(detail=True, methods=['get'], url_path='download', permission_classes=[permissions.IsAuthenticated])
    def download(self, request, pk=None):
        instance = self.get_object()
        return create_download_response(
            instance,
            self.downloaded_model_class,
            self.download_cookie_name_prefix,
            request,
            download_record_kwargs={self.download_record_field_name: instance},
        )


class LoopViewSet(DownloadableAudioViewSet):
    queryset = Loop.objects.all()
    serializer_class = LoopSerializer
    filterset_class = LoopFilter
    search_fields = ['name', 'author', 'keywords']
    ordering_fields = ['downloads', 'uploaded_at', 'bpm']
    ordering = ['-uploaded_at']
    downloaded_model_class = Loop
    download_cookie_name_prefix = 'downloaded_loop'
    download_record_field_name = 'loop'

    def perform_create(self, serializer):
        original_name = serializer.validated_data.get('name', '')
        serializer.save(
            author=self.request.user.username,
            name=strip_bpm_from_name(original_name) or original_name,
        )


class SampleViewSet(DownloadableAudioViewSet):
    queryset = Sample.objects.all()
    serializer_class = SampleSerializer
    filterset_class = SampleFilter
    search_fields = ['name', 'author']
    ordering_fields = ['downloads', 'uploaded_at']
    ordering = ['-uploaded_at']
    downloaded_model_class = Sample
    download_cookie_name_prefix = 'downloaded_sample'
    download_record_field_name = 'sample'

    def perform_create(self, serializer):
        serializer.save(author=self.request.user.username)


class DrumKitViewSet(WaveformContextMixin, viewsets.ModelViewSet):
    queryset = DrumKit.objects.all()
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsAuthorOrStaffOrReadOnly]
    lookup_field = 'slug'
    http_method_names = ['get', 'head', 'options', 'delete']
    search_fields = ['title', 'author', 'description', 'genre']
    ordering_fields = ['created_at', 'downloads', 'title']
    ordering = ['-created_at']

    def get_queryset(self):
        queryset = super().get_queryset().annotate(files_count=Count('files', distinct=True))
        should_include_waveform = self.should_include_waveform()

        if getattr(self, 'action', None) == 'retrieve':
            file_queryset = defer_waveform_fields(
                DrumKitFile.objects.all(),
                should_include_waveform,
            )
            queryset = queryset.prefetch_related(Prefetch('files', queryset=file_queryset))

        requested_author = (self.request.query_params.get('author') or '').strip()
        if requested_author:
            queryset = queryset.filter(author__iexact=requested_author)

        if self.request.user.is_staff:
            return queryset

        if self.request.user.is_authenticated:
            return queryset.filter(
                Q(is_public=True) | Q(author__iexact=self.request.user.username),
            )

        return queryset.filter(is_public=True)

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return DrumKitDetailSerializer
        return DrumKitListSerializer

    def get_serializer_context(self):
        serializer_context = super().get_serializer_context()
        serializer_context['folder_filter'] = self.request.query_params.get('folder', '')
        return serializer_context

    @action(detail=True, methods=['get'], url_path='download', permission_classes=[permissions.IsAuthenticated])
    def download(self, request, slug=None):
        drumkit = self.get_object()
        return create_download_response(
            drumkit,
            DrumKit,
            'downloaded_drumkit',
            request,
            file_field_name='archive_file',
            download_record_kwargs={'drumkit': drumkit},
            missing_file_message='Archive file not found',
        )


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = MeSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_object(self):
        profile, _created = Profile.objects.get_or_create(user=self.request.user)
        return profile


class MyDownloadsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        media_type = get_requested_media_type(request)
        download_settings = DOWNLOAD_TYPE_SETTINGS.get(media_type)
        if download_settings is None:
            return unsupported_media_type_response('download')

        should_include_waveform = (
            request_includes_waveform(request)
            and download_settings['allows_waveform']
        )
        download_records_queryset = get_download_records_queryset(
            request.user,
            download_settings['relation_field_name'],
        )

        return paginate_download_items(
            request,
            download_records_queryset,
            relation_field_name=download_settings['relation_field_name'],
            model_class=download_settings['model_class'],
            serializer_class=download_settings['list_serializer_class'],
            should_include_waveform=should_include_waveform,
        )


class MyUploadsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        media_type = get_requested_media_type(request)
        upload_settings = UPLOAD_TYPE_SETTINGS.get(media_type)
        if upload_settings is None:
            return unsupported_media_type_response('upload')

        should_include_waveform = (
            request_includes_waveform(request)
            and upload_settings['allows_waveform']
        )
        username = request.user.username
        upload_counts = get_user_upload_counts(username)
        extra_response_data = {
            'counts': upload_counts,
            'total_uploads': sum(upload_counts.values()),
        }
        uploaded_media_queryset = get_uploaded_media_queryset(
            media_type,
            username,
            should_include_waveform=should_include_waveform,
        )

        return paginate_queryset_items(
            request,
            uploaded_media_queryset,
            serializer_class=upload_settings['list_serializer_class'],
            should_include_waveform=should_include_waveform,
            extra_response_data=extra_response_data,
        )


class ProfileSummaryView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        requested_username = (request.query_params.get('username') or '').strip()
        if requested_username:
            profile_summary = get_profile_summary_payload(request, requested_username)
            return Response(profile_summary)

        if not request.user.is_authenticated:
            return Response(
                {'detail': 'Authentication credentials were not provided.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        profile_summary = get_profile_summary_payload(request, request.user.username)
        return Response(profile_summary)


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


class WaveformCacheView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, media_kind, object_id):
        model_class, _cache_kind = resolve_model_for_kind(media_kind)
        if model_class is None:
            return Response(
                {'detail': 'Unsupported media kind.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        media_object = model_class.objects.filter(pk=object_id).only(
            'id',
            'audio_file',
            'waveform_peaks',
            'waveform_duration',
            'waveform_source_file',
        ).first()
        if media_object is None:
            return Response({'detail': 'Object not found.'}, status=status.HTTP_404_NOT_FOUND)

        waveform_payload = build_waveform_payload(media_object)
        return Response(
            {
                'cached': bool(waveform_payload),
                'waveform': waveform_payload,
            }
        )

    def post(self, request, media_kind, object_id):
        model_class, cache_kind = resolve_model_for_kind(media_kind)
        if model_class is None:
            return Response(
                {'detail': 'Unsupported media kind.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        media_object = model_class.objects.filter(pk=object_id).only('id', 'audio_file').first()
        if media_object is None:
            return Response({'detail': 'Object not found.'}, status=status.HTTP_404_NOT_FOUND)

        normalized_peaks, error_message = normalize_waveform_peaks(request.data.get('peaks'))
        if error_message:
            return Response({'detail': error_message}, status=status.HTTP_400_BAD_REQUEST)

        was_stored = set_cached_waveform(
            cache_kind,
            media_object.id,
            media_object.audio_file.name,
            normalized_peaks,
            duration=parse_waveform_duration(request.data.get('duration')),
        )
        if not was_stored:
            return Response({'detail': 'Object not found.'}, status=status.HTTP_404_NOT_FOUND)

        return Response({'cached': True}, status=status.HTTP_201_CREATED)
