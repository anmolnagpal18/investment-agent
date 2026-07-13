import uuid
from django.db import models
from django.contrib.auth.models import User
from companies.models import Company

class ResearchHistory(models.Model):
    """
    Logs user stock search requests, including recommendation ratings and confidence levels.
    """
    RECOMMENDATION_CHOICES = [
        ('BUY', 'BUY'),
        ('HOLD', 'HOLD'),
        ('PASS', 'PASS'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='search_history')
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='searches')
    query = models.TextField()
    recommendation = models.CharField(max_length=10, choices=RECOMMENDATION_CHOICES)
    confidence = models.IntegerField()  # Expected range: 0 to 100
    search_date = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.company.ticker} ({self.recommendation})"

    class Meta:
        verbose_name_plural = "Research Histories"


class SavedReport(models.Model):
    """
    Keeps records of generated PDF analysis reports.
    """
    PDF_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('generating', 'Generating'),
        ('ready', 'Ready'),
        ('failed', 'Failed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='saved_reports')
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='reports')
    title = models.CharField(max_length=255)
    pdf_file = models.FileField(upload_to='reports/', blank=True, null=True)
    key_highlights = models.JSONField(default=dict, blank=True)
    pdf_status = models.CharField(max_length=20, choices=PDF_STATUS_CHOICES, default='pending')
    report_markdown = models.TextField(blank=True, null=True)
    report_html = models.TextField(blank=True, null=True)
    analysis_started_at = models.DateTimeField(null=True, blank=True)
    analysis_completed_at = models.DateTimeField(null=True, blank=True)
    pdf_generated_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Report: {self.title} ({self.company.ticker})"



class FavoriteCompany(models.Model):
    """
    Represents the user watchlist matching tickers to target buying alerts.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='favorites')
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='favorited_by')
    target_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    personal_notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} watches {self.company.ticker}"

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['user', 'company'], name='unique_user_company_favorite')
        ]


class ComparisonHistory(models.Model):
    """
    Records stock side-by-side comparison runs.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='comparisons')
    companies = models.ManyToManyField(Company, related_name='comparisons_run')
    comparison_metrics = models.JSONField(default=dict, blank=True)
    compared_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Comparison run by {self.user.username} at {self.compared_at}"

    class Meta:
        verbose_name_plural = "Comparison Histories"
