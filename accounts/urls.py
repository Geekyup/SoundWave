from django.urls import path
from . import auth, profile  

app_name = 'accounts'

urlpatterns = [
    path('login/', auth.login_view, name='login'),
    path('register/', auth.register_view, name='register'),
    path('logout/', auth.logout_view, name='logout'),

    path('profile/edit/', profile.profile_edit, name='profile_edit'),
    path('profile/<str:username>/', profile.profile_view, name='profile'),
    path('profile/', profile.profile_view, name='profile'),
]
