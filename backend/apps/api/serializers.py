from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.urls import reverse
from rest_framework import serializers

from apps.accounts.models import Profile
from apps.drumkits.models import DrumKit, DrumKitFile
from apps.uploader.models import Loop, Sample


def build_absolute_url(request, relative_url):
    if request:
        return request.build_absolute_uri(relative_url)
    return relative_url


def build_file_url(request, file_field):
    if not file_field:
        return None
    return build_absolute_url(request, file_field.url)


def build_route_url(request, route_name, route_arguments):
    return build_absolute_url(request, reverse(route_name, args=route_arguments))


def build_waveform_payload(instance):
    waveform_peaks = getattr(instance, 'waveform_peaks', None)
    if not isinstance(waveform_peaks, list) or not waveform_peaks:
        return None

    source_file_name = (getattr(instance, 'waveform_source_file', None) or '').strip()
    audio_file = getattr(instance, 'audio_file', None)
    audio_file_name = (getattr(audio_file, 'name', None) or '').strip()
    if source_file_name and audio_file_name and source_file_name != audio_file_name:
        return None

    return {
        'peaks': waveform_peaks,
        'duration': getattr(instance, 'waveform_duration', None),
    }


def build_drumkit_folder_tree(drumkit):
    folder_tree = {}

    for folder_path in drumkit.files.values_list('folder_path', flat=True):
        normalized_path = (folder_path or '').strip('/')
        folder_names = [folder_name for folder_name in normalized_path.split('/') if folder_name]
        current_level = folder_tree
        current_path_parts = []

        for folder_name in folder_names:
            current_path_parts.append(folder_name)
            full_path = '/'.join(current_path_parts)

            if folder_name not in current_level:
                current_level[folder_name] = {
                    'name': folder_name,
                    'path': full_path,
                    'children': {},
                }

            current_level = current_level[folder_name]['children']

    return serialize_folder_tree_nodes(folder_tree)


def serialize_folder_tree_nodes(folder_nodes):
    serialized_nodes = []

    for folder_name in sorted(folder_nodes.keys()):
        folder_node = folder_nodes[folder_name]
        serialized_nodes.append(
            {
                'name': folder_node['name'],
                'path': folder_node['path'],
                'children': serialize_folder_tree_nodes(folder_node['children']),
            }
        )

    return serialized_nodes


class LoopSerializer(serializers.ModelSerializer):
    genre_display = serializers.CharField(source='get_genre_display', read_only=True)
    file_size = serializers.CharField(source='get_file_size', read_only=True)
    download_url = serializers.SerializerMethodField()
    play_url = serializers.SerializerMethodField()
    waveform = serializers.SerializerMethodField()

    class Meta:
        model = Loop
        fields = [
            'id',
            'name',
            'author',
            'genre',
            'genre_display',
            'bpm',
            'audio_file',
            'play_url',
            'uploaded_at',
            'downloads',
            'keywords',
            'file_size',
            'download_url',
            'waveform',
        ]
        read_only_fields = ['id', 'uploaded_at', 'downloads', 'author']

    def get_download_url(self, loop):
        request = self.context.get('request')
        return build_route_url(request, 'loops-download', [loop.id])

    def get_play_url(self, loop):
        request = self.context.get('request')
        audio_file = loop.preview_file if loop.preview_file else loop.audio_file
        return build_file_url(request, audio_file)

    def get_waveform(self, loop):
        if not self.context.get('include_waveform'):
            return None
        return build_waveform_payload(loop)

    def to_representation(self, instance):
        serialized_data = super().to_representation(instance)
        if not self.context.get('include_waveform'):
            serialized_data.pop('waveform', None)
        return serialized_data


class SampleSerializer(serializers.ModelSerializer):
    genre_display = serializers.CharField(source='get_genre_display', read_only=True)
    sample_type_display = serializers.CharField(source='get_sample_type_display', read_only=True)
    file_size = serializers.CharField(source='get_file_size', read_only=True)
    download_url = serializers.SerializerMethodField()
    play_url = serializers.SerializerMethodField()
    waveform = serializers.SerializerMethodField()

    class Meta:
        model = Sample
        fields = [
            'id',
            'name',
            'author',
            'sample_type',
            'sample_type_display',
            'genre',
            'genre_display',
            'audio_file',
            'play_url',
            'uploaded_at',
            'downloads',
            'file_size',
            'download_url',
            'waveform',
        ]
        read_only_fields = ['id', 'uploaded_at', 'downloads', 'author']

    def get_download_url(self, sample):
        request = self.context.get('request')
        return build_route_url(request, 'samples-download', [sample.id])

    def get_play_url(self, sample):
        request = self.context.get('request')
        audio_file = sample.preview_file if sample.preview_file else sample.audio_file
        return build_file_url(request, audio_file)

    def get_waveform(self, sample):
        if not self.context.get('include_waveform'):
            return None
        return build_waveform_payload(sample)

    def to_representation(self, instance):
        serialized_data = super().to_representation(instance)
        if not self.context.get('include_waveform'):
            serialized_data.pop('waveform', None)
        return serialized_data


class MyDownloadsLoopSerializer(LoopSerializer):
    downloaded_at = serializers.DateTimeField(read_only=True)

    class Meta(LoopSerializer.Meta):
        fields = LoopSerializer.Meta.fields + ['downloaded_at']


class MyDownloadsSampleSerializer(SampleSerializer):
    downloaded_at = serializers.DateTimeField(read_only=True)

    class Meta(SampleSerializer.Meta):
        fields = SampleSerializer.Meta.fields + ['downloaded_at']


class MeSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', required=False)
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = Profile
        fields = ['username', 'avatar', 'avatar_url', 'bio']

    def get_avatar_url(self, profile):
        request = self.context.get('request')
        return build_file_url(request, profile.avatar)

    def validate_username(self, value):
        if not value:
            return value

        existing_users = User.objects.filter(username__iexact=value)
        if self.instance:
            existing_users = existing_users.exclude(pk=self.instance.user.pk)

        if existing_users.exists():
            raise serializers.ValidationError('This username is already taken.')

        return value

    def update(self, instance, validated_data):
        user_data = validated_data.pop('user', {})
        username = user_data.get('username')
        if username:
            instance.user.username = username
            instance.user.save(update_fields=['username'])
        return super().update(instance, validated_data)


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True)
    password2 = serializers.CharField(write_only=True)

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError('This username is already taken.')
        return value

    def validate(self, attributes):
        if attributes['password'] != attributes['password2']:
            raise serializers.ValidationError('Passwords do not match.')

        validate_password(attributes['password'])
        return attributes

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
        )
        Profile.objects.get_or_create(user=user)
        return user


class DrumKitListSerializer(serializers.ModelSerializer):
    genre_display = serializers.CharField(source='get_genre_display', read_only=True)
    cover_url = serializers.SerializerMethodField()
    files_count = serializers.IntegerField(read_only=True)
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = DrumKit
        fields = [
            'id',
            'title',
            'slug',
            'description',
            'author',
            'genre',
            'genre_display',
            'cover_url',
            'is_public',
            'created_at',
            'files_count',
            'download_url',
        ]

    def get_cover_url(self, drumkit):
        request = self.context.get('request')
        return build_file_url(request, drumkit.cover)

    def get_download_url(self, drumkit):
        request = self.context.get('request')
        return build_route_url(request, 'drumkits-download', [drumkit.slug])


class MyDownloadsDrumKitSerializer(DrumKitListSerializer):
    downloaded_at = serializers.DateTimeField(read_only=True)

    class Meta(DrumKitListSerializer.Meta):
        fields = DrumKitListSerializer.Meta.fields + ['downloaded_at']


class DrumKitFileSerializer(serializers.ModelSerializer):
    audio_url = serializers.SerializerMethodField()
    waveform = serializers.SerializerMethodField()

    class Meta:
        model = DrumKitFile
        fields = [
            'id',
            'name',
            'relative_path',
            'folder_path',
            'duration',
            'audio_url',
            'waveform',
        ]

    def get_audio_url(self, drumkit_file):
        request = self.context.get('request')
        return build_file_url(request, drumkit_file.audio_file)

    def get_waveform(self, drumkit_file):
        if not self.context.get('include_waveform'):
            return None
        return build_waveform_payload(drumkit_file)

    def to_representation(self, instance):
        serialized_data = super().to_representation(instance)
        if not self.context.get('include_waveform'):
            serialized_data.pop('waveform', None)
        return serialized_data


class DrumKitDetailSerializer(serializers.ModelSerializer):
    genre_display = serializers.CharField(source='get_genre_display', read_only=True)
    cover_url = serializers.SerializerMethodField()
    files_count = serializers.IntegerField(read_only=True)
    download_url = serializers.SerializerMethodField()
    files = serializers.SerializerMethodField()
    folders_tree = serializers.SerializerMethodField()

    class Meta:
        model = DrumKit
        fields = [
            'id',
            'title',
            'slug',
            'description',
            'author',
            'genre',
            'genre_display',
            'cover_url',
            'is_public',
            'created_at',
            'updated_at',
            'downloads',
            'files_count',
            'download_url',
            'folders_tree',
            'files',
        ]

    def get_cover_url(self, drumkit):
        request = self.context.get('request')
        return build_file_url(request, drumkit.cover)

    def get_download_url(self, drumkit):
        request = self.context.get('request')
        return build_route_url(request, 'drumkits-download', [drumkit.slug])

    def get_files(self, drumkit):
        selected_folder = (self.context.get('folder_filter') or '').strip()
        file_queryset = drumkit.files.all().order_by('relative_path')
        if selected_folder:
            file_queryset = file_queryset.filter(folder_path=selected_folder)

        serializer = DrumKitFileSerializer(
            file_queryset,
            many=True,
            context=self.context,
        )
        return serializer.data

    def get_folders_tree(self, drumkit):
        return build_drumkit_folder_tree(drumkit)
