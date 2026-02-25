from django.urls import path
from . import views

app_name = 'uploader'

urlpatterns = [
    path('upload/', views.upload_loop, name='upload_loop'),

]