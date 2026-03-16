import os
from django.contrib.auth.models import User
from django.db.models import (
    BooleanField,
    Count,
    Exists,
    F,
    OuterRef,
    Prefetch,
    Q,
    Sum,
    Value,
)
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Profile
from apps.drumkits.models import DrumKit, DrumKitFile
from apps.social.models import (
    DrumKitComment,
    DrumKitLike,
    Follow,
    LoopComment,
    LoopLike,
    SampleLike,
)
from apps.uploader.models import Loop, Sample
from apps.uploader.waveform_cache import resolve_model_for_kind, set_cached_waveform
from apps.uploader.bpm_extraction import strip_bpm_from_name

from .filters import LoopFilter, SampleFilter
from .permissions import IsAuthorOrStaffOrReadOnly
from .serializers import (
    DrumKitCommentSerializer,
    DrumKitDetailSerializer,
    DrumKitListSerializer,
    LoopCommentSerializer,
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

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.query_params.get('include_waveform') != '1':
            qs = qs.defer('waveform_peaks', 'waveform_duration', 'waveform_source_file')
        qs = qs.annotate(
            likes_count=Count('likes', distinct=True),
            comments_count=Count('comments', distinct=True),
        )
        user = self.request.user
        if user.is_authenticated:
            qs = qs.annotate(
                is_liked=Exists(
                    LoopLike.objects.filter(loop=OuterRef('pk'), user=user)
                ),
            )
        else:
            qs = qs.annotate(is_liked=Value(False, output_field=BooleanField()))
        return qs

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

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def like(self, request, pk=None):
        loop = self.get_object()
        LoopLike.objects.get_or_create(user=request.user, loop=loop)
        likes_count = LoopLike.objects.filter(loop=loop).count()
        return Response({'liked': True, 'likes_count': likes_count})

    @like.mapping.delete
    def unlike(self, request, pk=None):
        loop = self.get_object()
        LoopLike.objects.filter(user=request.user, loop=loop).delete()
        likes_count = LoopLike.objects.filter(loop=loop).count()
        return Response({'liked': False, 'likes_count': likes_count})

    @action(detail=True, methods=['get', 'post'], permission_classes=[permissions.AllowAny])
    def comments(self, request, pk=None):
        loop = self.get_object()
        if request.method == 'GET':
            comments = loop.comments.select_related('user').order_by('-created_at')
            return Response(LoopCommentSerializer(comments, many=True).data)

        if not request.user.is_authenticated:
            return Response({'detail': 'Authentication required.'}, status=status.HTTP_401_UNAUTHORIZED)

        serializer = LoopCommentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        comment = LoopComment.objects.create(
            loop=loop,
            user=request.user,
            text=serializer.validated_data['text'],
        )
        return Response(LoopCommentSerializer(comment).data, status=status.HTTP_201_CREATED)

    @action(
        detail=True,
        methods=['delete'],
        url_path='comments/(?P<comment_id>\\d+)',
        permission_classes=[permissions.IsAuthenticated],
    )
    def delete_comment(self, request, pk=None, comment_id=None):
        loop = self.get_object()
        comment = get_object_or_404(LoopComment, pk=comment_id, loop=loop)
        if comment.user_id != request.user.id and not request.user.is_staff:
            return Response({'detail': 'Not allowed.'}, status=status.HTTP_403_FORBIDDEN)
        comment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

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

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.query_params.get('include_waveform') != '1':
            qs = qs.defer('waveform_peaks', 'waveform_duration', 'waveform_source_file')
        qs = qs.annotate(likes_count=Count('likes', distinct=True))
        user = self.request.user
        if user.is_authenticated:
            qs = qs.annotate(
                is_liked=Exists(
                    SampleLike.objects.filter(sample=OuterRef('pk'), user=user)
                ),
            )
        else:
            qs = qs.annotate(is_liked=Value(False, output_field=BooleanField()))
        return qs

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

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def like(self, request, pk=None):
        sample = self.get_object()
        SampleLike.objects.get_or_create(user=request.user, sample=sample)
        likes_count = SampleLike.objects.filter(sample=sample).count()
        return Response({'liked': True, 'likes_count': likes_count})

    @like.mapping.delete
    def unlike(self, request, pk=None):
        sample = self.get_object()
        SampleLike.objects.filter(user=request.user, sample=sample).delete()
        likes_count = SampleLike.objects.filter(sample=sample).count()
        return Response({'liked': False, 'likes_count': likes_count})


class DrumKitViewSet(viewsets.ModelViewSet):
    queryset = DrumKit.objects.all()
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsAuthorOrStaffOrReadOnly]
    lookup_field = 'slug'
    http_method_names = ['get', 'head', 'options', 'delete']
    search_fields = ['title', 'author', 'description', 'genre']
    ordering_fields = ['created_at', 'downloads', 'title']
    ordering = ['-created_at']

    def get_queryset(self):
        qs = super().get_queryset().annotate(
            files_count=Count('files', distinct=True),
            likes_count=Count('likes', distinct=True),
            comments_count=Count('comments', distinct=True),
        )
        include_waveform = self.request.query_params.get('include_waveform') == '1'
        if getattr(self, 'action', None) == 'retrieve':
            files_qs = DrumKitFile.objects.all()
            if not include_waveform:
                files_qs = files_qs.defer('waveform_peaks', 'waveform_duration', 'waveform_source_file')
            qs = qs.prefetch_related(Prefetch('files', queryset=files_qs))

        user = self.request.user
        if user.is_authenticated:
            qs = qs.annotate(
                is_liked=Exists(
                    DrumKitLike.objects.filter(drumkit=OuterRef('pk'), user=user)
                ),
            )
        else:
            qs = qs.annotate(is_liked=Value(False, output_field=BooleanField()))

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

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def like(self, request, slug=None):
        kit = self.get_object()
        DrumKitLike.objects.get_or_create(user=request.user, drumkit=kit)
        likes_count = DrumKitLike.objects.filter(drumkit=kit).count()
        return Response({'liked': True, 'likes_count': likes_count})

    @like.mapping.delete
    def unlike(self, request, slug=None):
        kit = self.get_object()
        DrumKitLike.objects.filter(user=request.user, drumkit=kit).delete()
        likes_count = DrumKitLike.objects.filter(drumkit=kit).count()
        return Response({'liked': False, 'likes_count': likes_count})

    @action(detail=True, methods=['get', 'post'], permission_classes=[permissions.AllowAny])
    def comments(self, request, slug=None):
        kit = self.get_object()
        if request.method == 'GET':
            comments = kit.comments.select_related('user').order_by('-created_at')
            return Response(DrumKitCommentSerializer(comments, many=True).data)

        if not request.user.is_authenticated:
            return Response({'detail': 'Authentication required.'}, status=status.HTTP_401_UNAUTHORIZED)

        serializer = DrumKitCommentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        comment = DrumKitComment.objects.create(
            drumkit=kit,
            user=request.user,
            text=serializer.validated_data['text'],
        )
        return Response(DrumKitCommentSerializer(comment).data, status=status.HTTP_201_CREATED)

    @action(
        detail=True,
        methods=['delete'],
        url_path='comments/(?P<comment_id>\\d+)',
        permission_classes=[permissions.IsAuthenticated],
    )
    def delete_comment(self, request, slug=None, comment_id=None):
        kit = self.get_object()
        comment = get_object_or_404(DrumKitComment, pk=comment_id, drumkit=kit)
        if comment.user_id != request.user.id and not request.user.is_staff:
            return Response({'detail': 'Not allowed.'}, status=status.HTTP_403_FORBIDDEN)
        comment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


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


class AuthorProfileView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, username):
        user = get_object_or_404(User, username__iexact=username)
        profile, _ = Profile.objects.get_or_create(user=user)

        loops_qs = Loop.objects.filter(author__iexact=user.username)
        samples_qs = Sample.objects.filter(author__iexact=user.username)
        kits_qs = DrumKit.objects.filter(author__iexact=user.username)

        loops_count = loops_qs.count()
        samples_count = samples_qs.count()
        kits_count = kits_qs.count()

        loop_downloads = loops_qs.aggregate(total=Sum('downloads')).get('total') or 0
        sample_downloads = samples_qs.aggregate(total=Sum('downloads')).get('total') or 0
        kit_downloads = kits_qs.aggregate(total=Sum('downloads')).get('total') or 0

        followers_count = Follow.objects.filter(author=user).count()
        following_count = Follow.objects.filter(follower=user).count()
        is_following = False
        if request.user.is_authenticated:
            is_following = Follow.objects.filter(follower=request.user, author=user).exists()

        avatar_url = None
        if profile.avatar:
            avatar_url = request.build_absolute_uri(profile.avatar.url) if request else profile.avatar.url

        data = {
            'username': user.username,
            'avatar_url': avatar_url,
            'bio': profile.bio,
            'stats': {
                'loops_count': loops_count,
                'samples_count': samples_count,
                'drumkits_count': kits_count,
                'total_downloads': loop_downloads + sample_downloads + kit_downloads,
            },
            'followers_count': followers_count,
            'following_count': following_count,
            'is_following': is_following,
            'top_loops': LoopSerializer(
                loops_qs.order_by('-downloads')[:5],
                many=True,
                context={'request': request, 'include_waveform': False},
            ).data,
            'latest_loops': LoopSerializer(
                loops_qs.order_by('-uploaded_at')[:5],
                many=True,
                context={'request': request, 'include_waveform': False},
            ).data,
            'latest_samples': SampleSerializer(
                samples_qs.order_by('-uploaded_at')[:5],
                many=True,
                context={'request': request, 'include_waveform': False},
            ).data,
            'latest_drumkits': DrumKitListSerializer(
                kits_qs.order_by('-created_at')[:5],
                many=True,
                context={'request': request},
            ).data,
        }
        return Response(data)


class AuthorFollowView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, username):
        author = get_object_or_404(User, username__iexact=username)
        if author.id == request.user.id:
            return Response({'detail': 'Cannot follow yourself.'}, status=status.HTTP_400_BAD_REQUEST)

        Follow.objects.get_or_create(follower=request.user, author=author)
        followers_count = Follow.objects.filter(author=author).count()
        return Response({'following': True, 'followers_count': followers_count})

    def delete(self, request, username):
        author = get_object_or_404(User, username__iexact=username)
        Follow.objects.filter(follower=request.user, author=author).delete()
        followers_count = Follow.objects.filter(author=author).count()
        return Response({'following': False, 'followers_count': followers_count})


class LikedLoopsView(generics.ListAPIView):
    serializer_class = LoopSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Loop.objects.filter(likes__user=self.request.user).annotate(
            likes_count=Count('likes', distinct=True),
            comments_count=Count('comments', distinct=True),
            is_liked=Value(True, output_field=BooleanField()),
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['include_waveform'] = False
        return context


class LikedSamplesView(generics.ListAPIView):
    serializer_class = SampleSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Sample.objects.filter(likes__user=self.request.user).annotate(
            likes_count=Count('likes', distinct=True),
            is_liked=Value(True, output_field=BooleanField()),
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['include_waveform'] = False
        return context


class LikedDrumKitsView(generics.ListAPIView):
    serializer_class = DrumKitListSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return DrumKit.objects.filter(likes__user=self.request.user).annotate(
            files_count=Count('files', distinct=True),
            likes_count=Count('likes', distinct=True),
            comments_count=Count('comments', distinct=True),
            is_liked=Value(True, output_field=BooleanField()),
        )

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
