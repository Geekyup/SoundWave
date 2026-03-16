from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import (
    AuthorFollowView,
    AuthorProfileView,
    DrumKitViewSet,
    LikedDrumKitsView,
    LikedLoopsView,
    LikedSamplesView,
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
    path('me/liked/loops/', LikedLoopsView.as_view(), name='me-liked-loops'),
    path('me/liked/samples/', LikedSamplesView.as_view(), name='me-liked-samples'),
    path('me/liked/drum-kits/', LikedDrumKitsView.as_view(), name='me-liked-drumkits'),
    path('authors/<str:username>/', AuthorProfileView.as_view(), name='author-profile'),
    path('authors/<str:username>/follow/', AuthorFollowView.as_view(), name='author-follow'),
    path('waveforms/<str:kind>/<int:pk>/', WaveformCacheView.as_view(), name='waveform-cache'),
    path('', include(router.urls)),
]
