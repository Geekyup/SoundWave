import os
from django.db.models import Count, F, Q
from django.http import FileResponse, Http404
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Profile
from apps.drumkits.models import DrumKit
from apps.uploader.models import Loop, Sample
from apps.uploader.waveform_cache import resolve_model_for_kind, set_cached_waveform
from apps.uploader.bpm_extraction import strip_bpm_from_name

from .filters import LoopFilter, SampleFilter
from .permissions import IsAuthorOrStaffOrReadOnly
from .serializers import (
    DrumKitDetailSerializer,
    DrumKitListSerializer,
    LoopSerializer,
    MeSerializer,
    RegisterSerializer,
    SampleSerializer,
)


def build_download_response(obj, model, cookie_prefix, request):
    try:
        response = FileResponse(
            obj.audio_file,
            as_attachment=True,
            filename=os.path.basename(obj.audio_file.name),
        )
    except FileNotFoundError:
        raise Http404("File not found")

    cookie_key = f'{cookie_prefix}_{obj.id}'
    if cookie_key not in request.COOKIES:
        model.objects.filter(id=obj.id).update(downloads=F('downloads') + 1)
        response.set_cookie(cookie_key, 'true', max_age=600)
    return response


class LoopViewSet(viewsets.ModelViewSet):
    queryset = Loop.objects.all()
    serializer_class = LoopSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsAuthorOrStaffOrReadOnly]
    parser_classes = [MultiPartParser, FormParser]
    filterset_class = LoopFilter
    search_fields = ['name', 'author', 'keywords']
    ordering_fields = ['downloads', 'uploaded_at', 'bpm']
    ordering = ['-uploaded_at']

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['include_waveform'] = self.request.query_params.get('include_waveform') == '1'
        return context

    def perform_create(self, serializer):
        name = serializer.validated_data.get('name', '')
        serializer.save(
            author=self.request.user.username,
            name=strip_bpm_from_name(name) or name,
        )

    @action(detail=True, methods=['get'], url_path='download', permission_classes=[permissions.IsAuthenticated])
    def download(self, request, pk=None):
        obj = self.get_object()
        return build_download_response(obj, Loop, 'downloaded_loop', request)


class SampleViewSet(viewsets.ModelViewSet):
    queryset = Sample.objects.all()
    serializer_class = SampleSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsAuthorOrStaffOrReadOnly]
    parser_classes = [MultiPartParser, FormParser]
    filterset_class = SampleFilter
    search_fields = ['name', 'author']
    ordering_fields = ['downloads', 'uploaded_at']
    ordering = ['-uploaded_at']

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['include_waveform'] = self.request.query_params.get('include_waveform') == '1'
        return context

    def perform_create(self, serializer):
        serializer.save(author=self.request.user.username)

    @action(detail=True, methods=['get'], url_path='download', permission_classes=[permissions.IsAuthenticated])
    def download(self, request, pk=None):
        obj = self.get_object()
        return build_download_response(obj, Sample, 'downloaded_sample', request)


class DrumKitViewSet(viewsets.ModelViewSet):
    queryset = DrumKit.objects.all()
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsAuthorOrStaffOrReadOnly]
    lookup_field = 'slug'
    http_method_names = ['get', 'head', 'options', 'delete']
    search_fields = ['title', 'author', 'description', 'genre']
    ordering_fields = ['created_at', 'downloads', 'title']
    ordering = ['-created_at']

    def get_queryset(self):
        qs = super().get_queryset().annotate(files_count=Count('files'))
        if getattr(self, 'action', None) == 'retrieve':
            qs = qs.prefetch_related('files')
        author_filter = (self.request.query_params.get('author') or '').strip()
        if author_filter:
            qs = qs.filter(author__iexact=author_filter)

        if self.request.user.is_staff:
            return qs

        if self.request.user.is_authenticated:
            return qs.filter(Q(is_public=True) | Q(author__iexact=self.request.user.username))

        return qs.filter(is_public=True)

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return DrumKitDetailSerializer
        return DrumKitListSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['include_waveform'] = self.request.query_params.get('include_waveform') == '1'
        context['folder_filter'] = self.request.query_params.get('folder', '')
        return context

    @action(detail=True, methods=['get'], url_path='download', permission_classes=[permissions.IsAuthenticated])
    def download(self, request, slug=None):
        kit = self.get_object()
        if not kit.archive_file:
            raise Http404('Archive file not found')

        try:
            response = FileResponse(
                kit.archive_file,
                as_attachment=True,
                filename=os.path.basename(kit.archive_file.name),
            )
        except FileNotFoundError:
            raise Http404('Archive file not found')

        cookie_key = f'downloaded_drumkit_{kit.id}'
        if cookie_key not in request.COOKIES:
            DrumKit.objects.filter(id=kit.id).update(downloads=F('downloads') + 1)
            response.set_cookie(cookie_key, 'true', max_age=600)
        return response


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = MeSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_object(self):
        profile, _ = Profile.objects.get_or_create(user=self.request.user)
        return profile


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


class WaveformCacheView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, kind, pk):
        model, cache_kind = resolve_model_for_kind(kind)
        if not model:
            return Response({'detail': 'Unsupported media kind.'}, status=status.HTTP_400_BAD_REQUEST)

        obj = model.objects.filter(pk=pk).only('id', 'audio_file').first()
        if not obj:
            return Response({'detail': 'Object not found.'}, status=status.HTTP_404_NOT_FOUND)

        peaks = request.data.get('peaks')
        if not isinstance(peaks, list):
            return Response({'detail': 'peaks must be a list.'}, status=status.HTTP_400_BAD_REQUEST)

        if len(peaks) < 16:
            return Response({'detail': 'peaks list is too short.'}, status=status.HTTP_400_BAD_REQUEST)

        if len(peaks) > 8192:
            peaks = peaks[:8192]

        normalized = []
        for value in peaks:
            try:
                numeric = float(value)
            except (TypeError, ValueError):
                continue
            if numeric > 1.0:
                numeric = 1.0
            if numeric < -1.0:
                numeric = -1.0
            normalized.append(round(numeric, 6))

        if len(normalized) < 16:
            return Response({'detail': 'peaks payload is invalid.'}, status=status.HTTP_400_BAD_REQUEST)

        duration_value = request.data.get('duration')
        duration = None
        if duration_value is not None:
            try:
                duration = round(float(duration_value), 3)
                if duration <= 0 or duration > 7200:
                    duration = None
            except (TypeError, ValueError):
                duration = None

        stored = set_cached_waveform(
            cache_kind,
            obj.id,
            obj.audio_file.name,
            normalized,
            duration=duration,
        )
        if not stored:
            return Response({'detail': 'Object not found.'}, status=status.HTTP_404_NOT_FOUND)

        return Response({'cached': True}, status=status.HTTP_201_CREATED)
