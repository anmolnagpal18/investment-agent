import uuid
from django.db import models
from django.contrib.auth.models import User
from companies.models import Company
from research.models import SavedReport

class AIConversation(models.Model):
    """
    Houses interactive multi-agent chat thread structures.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='conversations')
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='conversations', null=True, blank=True)
    report = models.ForeignKey(SavedReport, on_delete=models.SET_NULL, related_name='conversations', null=True, blank=True)
    status = models.CharField(max_length=50, default='idle')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        focus = self.company.ticker if self.company else "General"
        return f"Thread {self.id} (Focus: {focus}) - {self.user.username}"


class Message(models.Model):
    """
    Stores individual prompts and agent responses within an AIConversation thread.
    """
    ROLE_CHOICES = [
        ('user', 'User'),
        ('assistant', 'Assistant'),
        ('system', 'System'),
    ]

    conversation = models.ForeignKey(AIConversation, on_delete=models.CASCADE, related_name='messages')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    content = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    token_usage = models.IntegerField(default=0)

    def __str__(self):
        return f"{self.role.capitalize()} at {self.timestamp}"
