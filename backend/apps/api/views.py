import os
from django.db.models import F
from django.http import FileResponse, Http404
from rest_framework import generics, permissions, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser

from apps.accounts.models import Profile
from apps.uploader.models import Loop, Sample

from .filters import LoopFilter, SampleFilter
from .serializers import LoopSerializer, SampleSerializer, MeSerializer, RegisterSerializer


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
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    parser_classes = [MultiPartParser, FormParser]
    filterset_class = LoopFilter
    search_fields = ['name', 'author', 'keywords']
    ordering_fields = ['downloads', 'uploaded_at', 'bpm']
    ordering = ['-uploaded_at']

    def perform_create(self, serializer):
        serializer.save(author=self.request.user.username)

    @action(detail=True, methods=['get'], url_path='download', permission_classes=[permissions.AllowAny])
    def download(self, request, pk=None):
        obj = self.get_object()
        return build_download_response(obj, Loop, 'downloaded_loop', request)


class SampleViewSet(viewsets.ModelViewSet):
    queryset = Sample.objects.all()
    serializer_class = SampleSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    parser_classes = [MultiPartParser, FormParser]
    filterset_class = SampleFilter
    search_fields = ['name', 'author']
    ordering_fields = ['downloads', 'uploaded_at']
    ordering = ['-uploaded_at']

    def perform_create(self, serializer):
        serializer.save(author=self.request.user.username)

    @action(detail=True, methods=['get'], url_path='download', permission_classes=[permissions.AllowAny])
    def download(self, request, pk=None):
        obj = self.get_object()
        return build_download_response(obj, Sample, 'downloaded_sample', request)


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
