from django.shortcuts import render, get_object_or_404
from django.core.paginator import Paginator
from django.http import FileResponse, Http404
from django.db.models import F
import os

from uploader.models import Loop, Sample, GENRE_CHOICES
from .decorators import measure_time
from .filters import SampleFilter, LoopFilter


@measure_time
def index(request, tab=None):
    """Главная страница с фильтрами и пагинацией"""
    page_number = request.GET.get('page', 1)
    items_per_page = 12

    # Выбор модели и фильтра
    if tab == 'samples':
        queryset = Sample.objects.all()
        filterset_class = SampleFilter
    else:
        queryset = Loop.objects.all()
        filterset_class = LoopFilter

    # Применяем фильтр
    filterset = filterset_class(request.GET, queryset=queryset)
    queryset = filterset.qs

    # Пагинация + пользователи
    paginator = Paginator(queryset, items_per_page)
    page_obj = paginator.get_page(page_number)
    # attach_users_to_items(page_obj)  # Закомментируйте или удалите

    # Контекст для шаблона
    context = {
        'loops': page_obj if tab != 'samples' else [],
        'samples': page_obj if tab == 'samples' else [],
        'page_obj': page_obj,
        'current_tab': tab or 'loops',
        'filterset': filterset,
        'genre_choices': GENRE_CHOICES,
    }
    return render(request, 'main/index.html', context)


def download_file(request, obj_id, model, cookie_prefix):
    """Универсальный downloader с подсчётом скачиваний"""
    obj = get_object_or_404(model, id=obj_id)
    try:
        response = FileResponse(
            obj.audio_file, as_attachment=True,
            filename=os.path.basename(obj.audio_file.name)
        )
    except FileNotFoundError:
        raise Http404("File not found")

    # Счётчик скачиваний (1 раз в 10 минут)
    cookie_key = f'{cookie_prefix}_{obj_id}'
    if cookie_key not in request.COOKIES:
        model.objects.filter(id=obj_id).update(downloads=F('downloads') + 1)
        response.set_cookie(cookie_key, 'true', max_age=600)
    return response


def download_sample(request, sample_id):
    from uploader.models import Sample
    return download_file(request, sample_id, Sample, 'downloaded_sample')


def download_loop(request, loop_id):
    from uploader.models import Loop
    return download_file(request, loop_id, Loop, 'downloaded_loop')
