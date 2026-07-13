from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ResearchHistoryViewSet,
    SavedReportViewSet,
    FavoriteCompanyViewSet,
    ComparisonHistoryViewSet
)

router = DefaultRouter()
router.register(r'history', ResearchHistoryViewSet, basename='history')
router.register(r'reports', SavedReportViewSet, basename='reports')
router.register(r'favorites', FavoriteCompanyViewSet, basename='favorites')
router.register(r'comparisons', ComparisonHistoryViewSet, basename='comparisons')

urlpatterns = [
    path('', include(router.urls)),
]
