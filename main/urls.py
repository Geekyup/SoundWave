from django.urls import path
from . import views

app_name = 'main'

urlpatterns = [
    path('', views.index, name='index'),
    path('samples/', views.index, {'tab': 'samples'}, name='samples'),
    path('loops/', views.index, name='loops'), 
    path('download/sample/<int:sample_id>/', views.download_sample, name='download_sample'),
    path('download/loop/<int:loop_id>/', views.download_loop, name='download_loop'),  
]
