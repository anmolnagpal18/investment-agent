from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AIConversationViewSet, MessageViewSet

router = DefaultRouter()
router.register(r'threads', AIConversationViewSet, basename='threads')
router.register(r'messages', MessageViewSet, basename='messages')

urlpatterns = [
    path('', include(router.urls)),
]
