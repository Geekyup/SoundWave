import django_filters
from uploader.models import Sample, Loop


class SampleFilter(django_filters.FilterSet):
    genre = django_filters.ChoiceFilter(
        choices=Sample._meta.get_field('genre').choices,
        empty_label="Все жанры"
    )
    
    class Meta:
        model = Sample
        fields = ['sample_type', 'genre']


class LoopFilter(django_filters.FilterSet):
    genre = django_filters.ChoiceFilter(
        choices=Loop._meta.get_field('genre').choices,
        empty_label="Все жанры"
    )
    bpm = django_filters.RangeFilter()
    author = django_filters.CharFilter(lookup_expr='icontains')
    keywords = django_filters.CharFilter(lookup_expr='icontains')
    sort = django_filters.OrderingFilter(
        fields=(
            ('downloads', 'downloads'),
            ('uploaded_at', 'uploaded_at'),
        ),
        label="Сортировка"
    )
    
    class Meta:
        model = Loop
        fields = ['genre', 'bpm', 'author', 'keywords']