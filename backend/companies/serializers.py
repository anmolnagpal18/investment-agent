from rest_framework import serializers
from .models import Company

class CompanySerializer(serializers.ModelSerializer):
    """
    Serializes Company records.
    """
    class Meta:
        model = Company
        fields = ['id', 'ticker', 'name', 'sector', 'industry', 'description', 'financial_summary', 'last_cached_at']
        read_only_fields = ['id', 'last_cached_at']
