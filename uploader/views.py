from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages

from .forms import LoopUploadForm, SampleUploadForm
from .models import Sample

def upload_loop(request):
    upload_type = request.GET.get('type', 'loop')
    form = None
    
    if request.method == 'POST':
        upload_type = request.POST.get('upload_type', 'loop')
        
        try:
            if upload_type == 'sample':
                form = SampleUploadForm(request.POST, request.FILES)
                if form.is_valid():
                    form.save()
                    messages.success(request, 'Сэмпл загружен')

                else:
                    messages.error(request, 'Проверьте ошибки в форме')
            else:
                form = LoopUploadForm(request.POST, request.FILES)
                if form.is_valid():
                    form.save()
                    messages.success(request, 'Трек успешно загружен!')

                else:
                    messages.error(request, 'Проверьте ошибки в форме')
        except Exception as e:
            messages.error(request, f'Ошибка: {str(e)}')
    else:
        if upload_type == 'sample':
            form = SampleUploadForm()
        else:
            form = LoopUploadForm()
    
    context = {
        'form': form,
        'upload_type': upload_type
    }
    return render(request, 'uploader/upload.html', context)

