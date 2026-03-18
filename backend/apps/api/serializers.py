from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.urls import reverse
from rest_framework import serializers

from apps.accounts.models import Profile
from apps.drumkits.models import DrumKit, DrumKitFile
from apps.uploader.models import Loop, Sample


def build_waveform_payload(instance):
    peaks = getattr(instance, 'waveform_peaks', None)
    if not isinstance(peaks, list) or not peaks:
        return None

    source_file = (getattr(instance, 'waveform_source_file', None) or '').strip()
    audio_field = getattr(instance, 'audio_file', None)
    audio_name = (getattr(audio_field, 'name', None) or '').strip()
    if source_file and audio_name and source_file != audio_name:
        return None

    return {
        'peaks': peaks,
        'duration': getattr(instance, 'waveform_duration', None),
    }


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

    def get_download_url(self, obj):
        request = self.context.get('request')
        path = reverse('loops-download', args=[obj.id])
        return request.build_absolute_uri(path) if request else path

    def get_play_url(self, obj):
        file_field = obj.preview_file if obj.preview_file else obj.audio_file
        if not file_field:
            return None
        request = self.context.get('request')
        url = file_field.url
        return request.build_absolute_uri(url) if request else url

    def get_waveform(self, obj):
        if not self.context.get('include_waveform'):
            return None
        return build_waveform_payload(obj)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if not self.context.get('include_waveform'):
            data.pop('waveform', None)
        return data


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

    def get_download_url(self, obj):
        request = self.context.get('request')
        path = reverse('samples-download', args=[obj.id])
        return request.build_absolute_uri(path) if request else path

    def get_play_url(self, obj):
        file_field = obj.preview_file if obj.preview_file else obj.audio_file
        if not file_field:
            return None
        request = self.context.get('request')
        url = file_field.url
        return request.build_absolute_uri(url) if request else url

    def get_waveform(self, obj):
        if not self.context.get('include_waveform'):
            return None
        return build_waveform_payload(obj)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if not self.context.get('include_waveform'):
            data.pop('waveform', None)
        return data


class MeSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', required=False)
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = Profile
        fields = ['username', 'avatar', 'avatar_url', 'bio']

    def get_avatar_url(self, obj):
        if not obj.avatar:
            return None
        request = self.context.get('request')
        url = obj.avatar.url
        return request.build_absolute_uri(url) if request else url

    def validate_username(self, value):
        if not value:
            return value
        qs = User.objects.filter(username__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.user.pk)
        if qs.exists():
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

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError('Passwords do not match.')
        validate_password(attrs['password'])
        return attrs

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

    def get_cover_url(self, obj):
        if not obj.cover:
            return None
        request = self.context.get('request')
        return request.build_absolute_uri(obj.cover.url) if request else obj.cover.url

    def get_download_url(self, obj):
        request = self.context.get('request')
        path = reverse('drumkits-download', args=[obj.slug])
        return request.build_absolute_uri(path) if request else path


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

    def get_audio_url(self, obj):
        if not obj.audio_file:
            return None
        request = self.context.get('request')
        return request.build_absolute_uri(obj.audio_file.url) if request else obj.audio_file.url

    def get_waveform(self, obj):
        if not self.context.get('include_waveform'):
            return None
        return build_waveform_payload(obj)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if not self.context.get('include_waveform'):
            data.pop('waveform', None)
        return data


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

    def get_cover_url(self, obj):
        if not obj.cover:
            return None
        request = self.context.get('request')
        return request.build_absolute_uri(obj.cover.url) if request else obj.cover.url

    def get_download_url(self, obj):
        request = self.context.get('request')
        path = reverse('drumkits-download', args=[obj.slug])
        return request.build_absolute_uri(path) if request else path

    def get_files(self, obj):
        folder = (self.context.get('folder_filter') or '').strip()
        files_qs = obj.files.all().order_by('relative_path')
        if folder:
            files_qs = files_qs.filter(folder_path=folder)
        serializer = DrumKitFileSerializer(
            files_qs,
            many=True,
            context=self.context,
        )
        return serializer.data

    def get_folders_tree(self, obj):
        tree = {}
        for folder in obj.files.values_list('folder_path', flat=True):
            path = (folder or '').strip('/')
            parts = [segment for segment in path.split('/') if segment]
            cursor = tree
            current_path = []
            for part in parts:
                current_path.append(part)
                full_path = '/'.join(current_path)
                if part not in cursor:
                    cursor[part] = {'name': part, 'path': full_path, 'children': {}}
                cursor = cursor[part]['children']

        def flatten(nodes):
            output = []
            for name in sorted(nodes.keys()):
                node = nodes[name]
                output.append(
                    {
                        'name': node['name'],
                        'path': node['path'],
                        'children': flatten(node['children']),
                    }
                )
            return output

        return flatten(tree)
