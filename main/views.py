from django.shortcuts import render, get_object_or_404
from django.core.paginator import Paginator
from django.http import FileResponse, Http404
from urllib.parse import urlencode
from django.db.models import F
from uploader.models import Loop, GENRE_CHOICES, Sample
import os
from .decorators import measure_time
from django.contrib.auth.models import User

def filter_samples(queryset, params):
    if params.get('sample_type'):
        queryset = queryset.filter(sample_type=params['sample_type'])
    if params.get('genre'):
        queryset = queryset.filter(genre=params['genre'])
    return queryset

def filter_loops(queryset, params):
    if params.get('genre'):
        queryset = queryset.filter(genre=params['genre'])
    if params.get('bpm_min'):
        queryset = queryset.filter(bpm__gte=int(params['bpm_min']))
    if params.get('bpm_max'):
        queryset = queryset.filter(bpm__lte=int(params['bpm_max']))
    if params.get('author'):
        queryset = queryset.filter(author__icontains=params['author'])
    if params.get('keywords'):
        queryset = queryset.filter(keywords__icontains=params['keywords'])
    if params.get('sort') == 'downloads':
        queryset = queryset.order_by('-downloads', '-uploaded_at')
    else:
        queryset = queryset.order_by('-uploaded_at')
    return queryset

@measure_time
def index(request, tab=None):
    page_number = request.GET.get('page', 1)
    items_per_page = 12

    if tab == 'samples':
        queryset = Sample.objects.all()
        filter_keys = ['sample_type', 'genre']
        filter_func = filter_samples
    else:
        queryset = Loop.objects.all()
        filter_keys = ['genre', 'bpm_min', 'bpm_max', 'author', 'keywords', 'sort']
        filter_func = filter_loops

    qs_params = {k: request.GET.get(k, '').strip() for k in filter_keys if request.GET.get(k, '').strip()}
    queryset = filter_func(queryset, qs_params)

    paginator = Paginator(queryset, items_per_page)
    page_obj = paginator.get_page(page_number)
    
    for item in page_obj:
        try:
            item.user = User.objects.get(username=item.author)
        except User.DoesNotExist:
            item.user = None

    context = {
        'loops': page_obj if tab != 'samples' else [],
        'samples': page_obj if tab == 'samples' else [],
        'page_obj': page_obj,
        'current_tab': tab or 'loops',
        'current_filters': qs_params,
        'genre_choices': GENRE_CHOICES,
        'sample_type_choices': Sample._meta.get_field('sample_type').choices,
    }
    return render(request, 'main/index.html', context)

def download_file(request, obj_id, model, cookie_prefix):
    obj = get_object_or_404(model, id=obj_id)
    try:
        response = FileResponse(
            obj.audio_file,
            as_attachment=True,
            filename=os.path.basename(obj.audio_file.name)
        )
    except FileNotFoundError:
        raise Http404("File is not found")

    cookie_key = f'{cookie_prefix}_{obj_id}'
    if cookie_key not in request.COOKIES:
        model.objects.filter(id=obj_id).update(downloads=F('downloads') + 1)
        response.set_cookie(cookie_key, 'true', max_age=600)
    return response

def download_sample(request, sample_id):
    return download_file(request, sample_id, Sample, 'downloaded_sample')

def download_loop(request, loop_id):
    return download_file(request, loop_id, Loop, 'downloaded_loop')