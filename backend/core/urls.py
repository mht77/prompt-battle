from django.contrib import admin
from django.urls import path, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import TemplateView
from django.views.generic.base import RedirectView

from game.views import health_check

urlpatterns = [
    path("admin/", admin.site.urls),
    path("healthz", health_check),
    path("favicon.ico", RedirectView.as_view(url=settings.STATIC_URL + "favicon.ico", permanent=False)),
    path("favicon.svg", RedirectView.as_view(url=settings.STATIC_URL + "favicon.svg", permanent=False)),
    path("favicon.png", RedirectView.as_view(url=settings.STATIC_URL + "favicon.png", permanent=False)),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

urlpatterns += [
    re_path(r"^.*$", TemplateView.as_view(template_name="index.html")),
]
