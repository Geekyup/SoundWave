from django.shortcuts import render, get_object_or_404
from django.core.paginator import Paginator
from django.http import FileResponse, Http404
from urllib.parse import urlencode
from django.db.models import F
from django.utils import timezone
from uploader.models import Loop, GENRE_CHOICES, Sample
import os
from .decorators import measure_time


@measure_time
def index(request, tab=None):
    page_number = request.GET.get('page', 1)
    items_per_page = 12

    if tab == 'samples':
        queryset = Sample.objects.all()
        context_name = 'samples'
        
        sample_type = request.GET.get('sample_type', '').strip()
        sample_genre = request.GET.get('genre', '').strip()
        
        if sample_type:
            queryset = queryset.filter(sample_type=sample_type)
        if sample_genre:
            queryset = queryset.filter(genre=sample_genre)
            
        qs_params = {}
        if sample_type: qs_params['sample_type'] = sample_type
        if sample_genre: qs_params['genre'] = sample_genre
        
    else:  
        queryset = Loop.objects.all()
        context_name = 'loops'
        
        genre = request.GET.get('genre', '').strip()
        bpm_min = request.GET.get('bpm_min', '').strip()
        bpm_max = request.GET.get('bpm_max', '').strip()
        author = request.GET.get('author', '').strip()
        keywords = request.GET.get('keywords', '').strip()
        
        if genre:
            queryset = queryset.filter(genre=genre)
        if bpm_min:
            queryset = queryset.filter(bpm__gte=int(bpm_min))
        if bpm_max:
            queryset = queryset.filter(bpm__lte=int(bpm_max))
        if author:
            queryset = queryset.filter(author__icontains=author)
        if keywords:
            queryset = queryset.filter(keywords__icontains=keywords)
            
        qs_params = {}
        if genre: qs_params['genre'] = genre
        if bpm_min: qs_params['bpm_min'] = bpm_min
        if bpm_max: qs_params['bpm_max'] = bpm_max
        if author: qs_params['author'] = author
        if keywords: qs_params['keywords'] = keywords

    queryset = queryset.order_by('-uploaded_at')
    paginator = Paginator(queryset, items_per_page)
    page_obj = paginator.get_page(page_number)
    
    context = {
        context_name: page_obj.object_list,
        'page_obj': page_obj,
        'paginator': paginator,
        'current_tab': tab,
        'base_query': urlencode(qs_params),
        'current_filters': qs_params,
        'genre_choices': GENRE_CHOICES,
        'sample_type_choices': Sample.SAMPLE_TYPE_CHOICES,
    }
    return render(request, 'main/index.html', context)


def download_sample(request, sample_id):

    sample = get_object_or_404(Sample, id=sample_id)

    try:
        response = FileResponse(
            sample.audio_file, 
            as_attachment=True, 
            filename=os.path.basename(sample.audio_file.name)
        )
    except FileNotFoundError:
        raise Http404("Файл не найден")

    cookie_key = f'downloaded_sample_{sample_id}'
    
    if cookie_key not in request.COOKIES:
        Sample.objects.filter(id=sample_id).update(downloads=F('downloads') + 1)
        response.set_cookie(cookie_key, 'true', max_age=600)

    return response

def download_loop(request, loop_id):
    loop = get_object_or_404(Loop, id=loop_id)
    
    try:
        response = FileResponse(
            loop.audio_file, 
            as_attachment=True, 
            filename=os.path.basename(loop.audio_file.name)
        )
    except FileNotFoundError:
        raise Http404("Файл не найден")
    
    cookie_key = f'downloaded_loop_{loop_id}'
    
    if cookie_key not in request.COOKIES:
        Loop.objects.filter(id=loop_id).update(downloads=F('downloads') + 1)
        response.set_cookie(cookie_key, 'true', max_age=600)
    
    return response