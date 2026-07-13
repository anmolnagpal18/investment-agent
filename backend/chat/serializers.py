from rest_framework import serializers
from .models import AIConversation, Message

class MessageSerializer(serializers.ModelSerializer):
    """
    Serializes message logs inside conversation threads.
    """
    class Meta:
        model = Message
        fields = ['id', 'conversation', 'role', 'content', 'timestamp', 'token_usage']
        read_only_fields = ['id', 'timestamp']


class AIConversationSerializer(serializers.ModelSerializer):
    """
    Serializes conversation threads, nesting message logs.
    """
    messages = MessageSerializer(many=True, read_only=True)
    company_ticker = serializers.ReadOnlyField(source='company.ticker')

    class Meta:
        model = AIConversation
        fields = ['id', 'user', 'company', 'company_ticker', 'report', 'status', 'messages', 'created_at']
        read_only_fields = ['id', 'user', 'status', 'created_at']
