from django.contrib import admin
from django.urls import path, include, re_path
from django.views.generic import TemplateView

from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('apps.api.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

if getattr(settings, "SERVE_FRONTEND", False) and (settings.FRONTEND_DIST / "index.html").exists():
    urlpatterns += [
        path("", TemplateView.as_view(template_name="index.html"), name="frontend-index"),
        re_path(r"^(?!api/|admin/|media/|static/).*$", TemplateView.as_view(template_name="index.html")),
    ]
