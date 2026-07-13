from rest_framework import serializers
from companies.models import Company
from companies.serializers import CompanySerializer
from .models import ResearchHistory, SavedReport, FavoriteCompany, ComparisonHistory

class ResearchHistorySerializer(serializers.ModelSerializer):
    """
    Serializes individual search items from a user's search history.
    """
    company_ticker = serializers.ReadOnlyField(source='company.ticker')
    company_name = serializers.ReadOnlyField(source='company.name')

    class Meta:
        model = ResearchHistory
        fields = ['id', 'user', 'company', 'company_ticker', 'company_name', 'query', 'recommendation', 'confidence', 'search_date']
        read_only_fields = ['id', 'user', 'search_date']


class SavedReportSerializer(serializers.ModelSerializer):
    """
    Serializes generated PDF report objects.
    """
    company_ticker = serializers.ReadOnlyField(source='company.ticker')
    company_name = serializers.ReadOnlyField(source='company.name')

    class Meta:
        model = SavedReport
        fields = ['id', 'user', 'company', 'company_ticker', 'company_name', 'title', 'pdf_file', 'key_highlights', 'created_at']
        read_only_fields = ['id', 'user', 'created_at']


class FavoriteCompanySerializer(serializers.ModelSerializer):
    """
    Serializes watchlists, nesting full company caching models.
    """
    company_details = CompanySerializer(source='company', read_only=True)
    recommendation = serializers.SerializerMethodField()
    risk_level = serializers.SerializerMethodField()
    last_updated = serializers.SerializerMethodField()

    class Meta:
        model = FavoriteCompany
        fields = ['user', 'company', 'company_details', 'target_price', 'personal_notes', 'created_at', 'recommendation', 'risk_level', 'last_updated']
        read_only_fields = ['user', 'created_at']

    def get_recommendation(self, obj):
        report = SavedReport.objects.filter(user=obj.user, company=obj.company).order_by('-created_at').first()
        if report and report.key_highlights:
            return report.key_highlights.get("recommendation", "HOLD")
        hist = ResearchHistory.objects.filter(user=obj.user, company=obj.company).order_by('-search_date').first()
        if hist:
            return hist.recommendation
        return "N/A"

    def get_risk_level(self, obj):
        report = SavedReport.objects.filter(user=obj.user, company=obj.company).order_by('-created_at').first()
        if report and report.key_highlights:
            return report.key_highlights.get("risk_level", "Medium")
        return "Medium"

    def get_last_updated(self, obj):
        report = SavedReport.objects.filter(user=obj.user, company=obj.company).order_by('-created_at').first()
        if report:
            return report.created_at
        return obj.created_at


class ComparisonHistorySerializer(serializers.ModelSerializer):
    """
    Serializes past side-by-side runs.
    """
    company_details = CompanySerializer(source='companies', many=True, read_only=True)

    class Meta:
        model = ComparisonHistory
        fields = ['id', 'user', 'companies', 'company_details', 'comparison_metrics', 'compared_at']
        read_only_fields = ['id', 'user', 'compared_at']
