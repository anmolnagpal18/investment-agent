from django.contrib import admin
from .models import AIConversation, Message

@admin.register(AIConversation)
class AIConversationAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'company', 'created_at']
    search_fields = ['user__username', 'company__ticker']
    list_filter = ['created_at']

@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ['conversation', 'role', 'timestamp', 'token_usage']
    search_fields = ['conversation__id', 'role', 'content']
    list_filter = ['role', 'timestamp']
