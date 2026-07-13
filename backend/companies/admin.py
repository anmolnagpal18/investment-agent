from django.contrib import admin
from .models import Company

@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ['ticker', 'name', 'sector', 'industry', 'last_cached_at']
    search_fields = ['ticker', 'name', 'sector', 'industry']
    list_filter = ['sector', 'last_cached_at']
