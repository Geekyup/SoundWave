from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import (
    DrumKitViewSet,
    LoopViewSet,
    MeView,
    RegisterView,
    SampleViewSet,
    WaveformCacheView,
)

router = DefaultRouter()
router.register('loops', LoopViewSet, basename='loops')
router.register('samples', SampleViewSet, basename='samples')
router.register('drum-kits', DrumKitViewSet, basename='drumkits')

urlpatterns = [
    path('auth/register/', RegisterView.as_view(), name='auth-register'),
    path('auth/token/', TokenObtainPairView.as_view(), name='auth-token'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='auth-refresh'),
    path('me/', MeView.as_view(), name='me'),
    path('waveforms/<str:kind>/<int:pk>/', WaveformCacheView.as_view(), name='waveform-cache'),
    path('', include(router.urls)),
]
