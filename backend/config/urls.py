from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

from research.views import (
    AnalyzeView,
    ChatView,
    CompareView,
    HistoryView,
    FavoritesView,
    ExportView,
    ExplainView,
    ReportStatusView
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('authentication.urls')),
    path('api/companies/', include('companies.urls')),
    path('api/research/', include('research.urls')),
    
    # Standalone Integration API Routes
    path('api/analyze/', AnalyzeView.as_view(), name='api-analyze'),
    path('api/chat/', ChatView.as_view(), name='api-chat'),
    path('api/compare/', CompareView.as_view(), name='api-compare'),
    path('api/history/', HistoryView.as_view(), name='api-history'),
    path('api/favorites/', FavoritesView.as_view(), name='api-favorites'),
    path('api/export/pdf/', ExportView.as_view(), name='api-export-pdf'),
    path('api/explain/', ExplainView.as_view(), name='api-explain'),
    path('api/report-status/<uuid:report_id>/', ReportStatusView.as_view(), name='api-report-status'),
    path('api/report-status/<uuid:report_id>/retry/', ReportStatusView.as_view(), name='api-report-status-retry'),

    # Include other sub-routes
    path('api/chat/', include('chat.urls')),
]

# Serve media and static files in development mode
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
