from django.contrib.auth.models import User
from django.db import transaction
from rest_framework import serializers
from .models import UserProfile

class UserProfileSerializer(serializers.ModelSerializer):
    """
    Serializes Investor Profile choices and sector configurations.
    """
    class Meta:
        model = UserProfile
        fields = ['experience_level', 'favorite_sectors', 'created_at']


class UserSerializer(serializers.ModelSerializer):
    """
    Serializes User details along with their associated UserProfile.
    """
    profile = UserProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'profile']
        read_only_fields = ['id', 'username', 'email']


class RegisterSerializer(serializers.ModelSerializer):
    """
    Validates input data for user registration and creates User & UserProfile profiles.
    """
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, required=True, min_length=8)
    experience_level = serializers.ChoiceField(
        choices=UserProfile.EXPERIENCE_CHOICES, 
        required=False, 
        default='Beginner'
    )
    favorite_sectors = serializers.ListField(
        child=serializers.CharField(), 
        required=False, 
        default=list
    )

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'experience_level', 'favorite_sectors']

    def validate_email(self, value):
        """
        Verify email is unique.
        """
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def validate_username(self, value):
        """
        Verify username is unique.
        """
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return value

    def create(self, validated_data):
        experience_level = validated_data.pop('experience_level', 'Beginner')
        favorite_sectors = validated_data.pop('favorite_sectors', [])
        
        with transaction.atomic():
            user = User.objects.create_user(
                username=validated_data['username'],
                email=validated_data['email'],
                password=validated_data['password']
            )
            UserProfile.objects.create(
                user=user,
                experience_level=experience_level,
                favorite_sectors=favorite_sectors
            )
        return user
