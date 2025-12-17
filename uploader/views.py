from django.shortcuts import render
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from .forms import LoopUploadForm, SampleUploadForm

FORM_CLASSES = {
    'sample': SampleUploadForm,
    'loop': LoopUploadForm,
}


@login_required(login_url='accounts:login')
def upload_loop(request):
    upload_type = request.GET.get('type', 'loop')
    if request.method == 'POST':
        upload_type = request.POST.get('upload_type', 'loop')
    FormClass = FORM_CLASSES.get(upload_type, LoopUploadForm)

    if request.method == 'POST':
        form = FormClass(request.POST, request.FILES)
        if form.is_valid():
            instance = form.save(commit=False)
            # Automatically set the author from the current user
            if request.user.is_authenticated:
                instance.author = request.user.username
            instance.save()
            messages.success(
                request,
                'Sample uploaded successfully.'
                if upload_type == 'sample'
                else 'Loop uploaded successfully!',
            )
        else:
            messages.error(request, 'Please check the form for errors.')
    else:
        form = FormClass()
        # Pre-fill the author field if the user is authenticated
        if request.user.is_authenticated:
            form.fields['author'].initial = request.user.username

    context = {
        'form': form,
        'upload_type': upload_type,
    }
    return render(request, 'uploader/upload.html', context)

