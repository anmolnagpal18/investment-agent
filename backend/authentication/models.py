from django.db import models
from django.contrib.auth.models import User

class UserProfile(models.Model):
    """
    Extends the built-in Django User model to store investor profile preferences.
    """
    EXPERIENCE_CHOICES = [
        ('Beginner', 'Beginner'),
        ('Intermediate', 'Intermediate'),
        ('Advanced', 'Advanced'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    experience_level = models.CharField(
        max_length=50, 
        choices=EXPERIENCE_CHOICES, 
        default='Beginner'
    )
    favorite_sectors = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username}'s Profile"
