from django.db import models

class Company(models.Model):
    """
    Caches general stock profile details and financial statements.
    """
    ticker = models.CharField(max_length=10, unique=True, db_index=True)
    name = models.CharField(max_length=255)
    sector = models.CharField(max_length=100, blank=True, null=True)
    industry = models.CharField(max_length=100, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    financial_summary = models.JSONField(default=dict, blank=True)
    last_cached_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.ticker} - {self.name}"

    class Meta:
        verbose_name_plural = "Companies"
