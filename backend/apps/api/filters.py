import django_filters
from apps.uploader.models import Loop, Sample


class LoopFilter(django_filters.FilterSet):
    bpm_min = django_filters.NumberFilter(field_name='bpm', lookup_expr='gte')
    bpm_max = django_filters.NumberFilter(field_name='bpm', lookup_expr='lte')
    author = django_filters.CharFilter(field_name='author', lookup_expr='icontains')
    keywords = django_filters.CharFilter(field_name='keywords', lookup_expr='icontains')

    class Meta:
        model = Loop
        fields = ['genre', 'bpm_min', 'bpm_max', 'author', 'keywords']


class SampleFilter(django_filters.FilterSet):
    author = django_filters.CharFilter(field_name='author', lookup_expr='icontains')

    class Meta:
        model = Sample
        fields = ['sample_type', 'genre', 'author']
