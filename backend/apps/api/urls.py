from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import LoopViewSet, SampleViewSet, MeView, RegisterView

router = DefaultRouter()
router.register('loops', LoopViewSet, basename='loops')
router.register('samples', SampleViewSet, basename='samples')

urlpatterns = [
    path('auth/register/', RegisterView.as_view(), name='auth-register'),
    path('auth/token/', TokenObtainPairView.as_view(), name='auth-token'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='auth-refresh'),
    path('me/', MeView.as_view(), name='me'),
    path('', include(router.urls)),
]
