from django.contrib import admin
from .models import ResearchHistory, SavedReport, FavoriteCompany, ComparisonHistory

@admin.register(ResearchHistory)
class ResearchHistoryAdmin(admin.ModelAdmin):
    list_display = ['user', 'company', 'recommendation', 'confidence', 'search_date']
    search_fields = ['user__username', 'company__ticker', 'recommendation']
    list_filter = ['recommendation', 'search_date']

@admin.register(SavedReport)
class SavedReportAdmin(admin.ModelAdmin):
    list_display = ['title', 'user', 'company', 'created_at']
    search_fields = ['title', 'user__username', 'company__ticker']
    list_filter = ['created_at']

@admin.register(FavoriteCompany)
class FavoriteCompanyAdmin(admin.ModelAdmin):
    list_display = ['user', 'company', 'target_price', 'created_at']
    search_fields = ['user__username', 'company__ticker']
    list_filter = ['created_at']

@admin.register(ComparisonHistory)
class ComparisonHistoryAdmin(admin.ModelAdmin):
    list_display = ['user', 'compared_at']
    search_fields = ['user__username']
    list_filter = ['compared_at']
