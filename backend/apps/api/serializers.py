from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.urls import reverse
from rest_framework import serializers

from apps.accounts.models import Profile
from apps.uploader.models import Loop, Sample


class LoopSerializer(serializers.ModelSerializer):
    genre_display = serializers.CharField(source='get_genre_display', read_only=True)
    file_size = serializers.CharField(source='get_file_size', read_only=True)
    download_url = serializers.SerializerMethodField()

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
            'uploaded_at',
            'downloads',
            'keywords',
            'file_size',
            'download_url',
        ]
        read_only_fields = ['id', 'uploaded_at', 'downloads', 'author']

    def get_download_url(self, obj):
        request = self.context.get('request')
        path = reverse('loops-download', args=[obj.id])
        return request.build_absolute_uri(path) if request else path


class SampleSerializer(serializers.ModelSerializer):
    genre_display = serializers.CharField(source='get_genre_display', read_only=True)
    sample_type_display = serializers.CharField(source='get_sample_type_display', read_only=True)
    file_size = serializers.CharField(source='get_file_size', read_only=True)
    download_url = serializers.SerializerMethodField()

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
            'uploaded_at',
            'downloads',
            'file_size',
            'download_url',
        ]
        read_only_fields = ['id', 'uploaded_at', 'downloads', 'author']

    def get_download_url(self, obj):
        request = self.context.get('request')
        path = reverse('samples-download', args=[obj.id])
        return request.build_absolute_uri(path) if request else path


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
