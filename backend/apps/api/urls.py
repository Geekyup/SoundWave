from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from . import views

api_router = DefaultRouter()
api_router.register('loops', views.LoopViewSet, basename='loops')
api_router.register('samples', views.SampleViewSet, basename='samples')
api_router.register('drum-kits', views.DrumKitViewSet, basename='drumkits')


urlpatterns = [
    path('auth/register/', views.RegisterView.as_view(), name='auth-register'),
    path('auth/token/', TokenObtainPairView.as_view(), name='auth-token'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='auth-refresh'),
    path('me/', views.MeView.as_view(), name='me'),
    path('profile-summary/', views.ProfileSummaryView.as_view(), name='profile-summary'),
    path('my-downloads/', views.MyDownloadsView.as_view(), name='my-downloads'),
    path('my-uploads/', views.MyUploadsView.as_view(), name='my-uploads'),
    path(
        'waveforms/<str:media_kind>/<int:object_id>/',
        views.WaveformCacheView.as_view(),
        name='waveform-cache',
    ),
    path('', include(api_router.urls)),
]
