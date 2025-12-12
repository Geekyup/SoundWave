from django.shortcuts import render
from django.contrib import messages
from .forms import LoopUploadForm, SampleUploadForm

FORM_CLASSES = {
    'sample': SampleUploadForm,
    'loop': LoopUploadForm,
}

def upload_loop(request):
    upload_type = request.GET.get('type', 'loop')
    if request.method == 'POST':
        upload_type = request.POST.get('upload_type', 'loop')
    FormClass = FORM_CLASSES.get(upload_type, LoopUploadForm)

    if request.method == 'POST':
        form = FormClass(request.POST, request.FILES)
        if form.is_valid():
            form.save()
            messages.success(request, 'Сэмпл загружен' if upload_type == 'sample' else 'Трек успешно загружен!')
        else:
            messages.error(request, 'Проверьте ошибки в форме')
    else:
        form = FormClass()

    context = {
        'form': form,
        'upload_type': upload_type
    }
    return render(request, 'uploader/upload.html', context)

