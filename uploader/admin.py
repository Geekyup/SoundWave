from django.contrib import admin
from django import forms
from django.forms.widgets import FileInput
from .models import Loop, Sample
import os

class MultipleFileInput(FileInput):
    """Кастомный виджет для множественной загрузки без проверок Django"""
    allow_multiple_selected = True
    
    def render(self, name, value, attrs=None, renderer=None):
        attrs = attrs or {}
        attrs['multiple'] = True
        return super().render(name, value, attrs, renderer)

class BulkSampleUploadForm(forms.Form):
    """Форма для массовой загрузки сэмплов"""
    audio_files = forms.FileField(
        widget=MultipleFileInput(),
        label='Выберите файлы сэмплов',
        help_text='Выберите несколько файлов. Название будет взято из имени файла.',
        required=False
    )
    sample_type = forms.ChoiceField(
        choices=Sample.SAMPLE_TYPE_CHOICES,
        label='Тип сэмпла',
        help_text='Один тип для всех выбранных файлов'
    )
    genre = forms.ChoiceField(
        choices=Sample._meta.get_field('genre').choices,
        label='Жанр',
        help_text='Один жанр для всех выбранных файлов'
    )

@admin.register(Loop)
class LoopAdmin(admin.ModelAdmin):
    list_display = ('name', 'author', 'genre', 'bpm', 'uploaded_at', 'likes')
    list_filter = ('genre', 'uploaded_at')
    search_fields = ('name', 'author')
    readonly_fields = ('uploaded_at', 'likes')

@admin.register(Sample)
class SampleAdmin(admin.ModelAdmin):
    list_display = ('name', 'sample_type', 'genre', 'uploaded_at', 'likes')
    list_filter = ('sample_type', 'genre', 'uploaded_at')
    search_fields = ('name',)
    readonly_fields = ('uploaded_at', 'likes')
    change_list_template = 'admin/uploader/sample/change_list.html'
    
    def get_urls(self):
        """Добавляем URL для массовой загрузки"""
        from django.urls import path
        urls = super().get_urls()
        custom_urls = [
            path('bulk-upload/', self.admin_site.admin_view(self.bulk_upload_view), 
                 name='uploader_sample_bulk_upload'),
        ]
        return custom_urls + urls
    
    def bulk_upload_view(self, request):
        """Обработчик для массовой загрузки"""
        from django.shortcuts import render, redirect
        from django.contrib import messages
        from django.urls import reverse
        
        if request.method == 'POST':
            # Получаем файлы напрямую из request.FILES
            files = request.FILES.getlist('audio_files')
            sample_type = request.POST.get('sample_type')
            genre = request.POST.get('genre')
            
            # Проверяем валидность данных
            if not files:
                messages.error(request, '❌ Выберите хотя бы один файл!')
            elif not sample_type:
                messages.error(request, '❌ Выберите тип сэмпла!')
            elif not genre:
                messages.error(request, '❌ Выберите жанр!')
            else:
                success_count = 0
                
                for audio_file in files:
                    try:
                        file_name = os.path.splitext(audio_file.name)[0]
                        
                        Sample.objects.create(
                            name=file_name,
                            sample_type=sample_type,
                            genre=genre,
                            audio_file=audio_file
                        )
                        success_count += 1
                        print(f'✅ Загружен: {file_name}')
                    except Exception as e:
                        print(f'❌ Ошибка: {str(e)}')
                        messages.error(request, f'Ошибка загрузки {audio_file.name}: {str(e)}')
                
                if success_count > 0:
                    messages.success(request, f'✅ Успешно загружено {success_count} сэмплов!')
                
                return redirect(reverse('admin:uploader_sample_changelist'))
        
        form = BulkSampleUploadForm()
        
        context = {
            'form': form,
            'title': 'Массовая загрузка сэмплов',
            'site_header': self.admin_site.site_header,
            'site_title': self.admin_site.site_title,
        }
        return render(request, 'admin/uploader/sample/bulk_upload.html', context)
