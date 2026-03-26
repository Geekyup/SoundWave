from datetime import timedelta

import django_filters

from django.utils import timezone

from apps.uploader.models import Loop, Sample


class LoopFilter(django_filters.FilterSet):
    bpm_min = django_filters.NumberFilter(field_name='bpm', lookup_expr='gte')
    bpm_max = django_filters.NumberFilter(field_name='bpm', lookup_expr='lte')
    author = django_filters.CharFilter(field_name='author', lookup_expr='icontains')
    keywords = django_filters.CharFilter(field_name='keywords', lookup_expr='icontains')
    date_window = django_filters.CharFilter(method='filter_date_window')

    DATE_WINDOW_DURATIONS = {
        '24h': timedelta(hours=24),
        '48h': timedelta(hours=48),
        'week': timedelta(days=7),
        'month': timedelta(days=30),
    }

    def filter_date_window(self, queryset, _field_name, value):
        window_key = (value or '').strip().lower()
        time_window = self.DATE_WINDOW_DURATIONS.get(window_key)
        if not time_window:
            return queryset

        return queryset.filter(uploaded_at__gte=timezone.now() - time_window)

    class Meta:
        model = Loop
        fields = ['genre', 'bpm_min', 'bpm_max', 'author', 'keywords', 'date_window']


class SampleFilter(django_filters.FilterSet):
    author = django_filters.CharFilter(field_name='author', lookup_expr='icontains')

    class Meta:
        model = Sample
        fields = ['sample_type', 'genre', 'author']
