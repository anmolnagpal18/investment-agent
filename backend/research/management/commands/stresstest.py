from django.core.management.base import BaseCommand
from django.test import RequestFactory
from django.contrib.auth import get_user_model
import threading
import time
import os
from research.views import AnalyzeView
from companies.models import Company

User = get_user_model()

class Command(BaseCommand):
    help = 'Stress tests the Research Center with 20 consecutive runs'

    def handle(self, *args, **kwargs):
        tickers = [
            "AAPL", "MSFT", "NVDA", "GOOG", "META", "AMZN", "TSLA", "NFLX",
            "AMD", "AVGO", "INTC", "ORCL", "RELIANCE.NS", "INFY", "TCS.NS",
            "HDFCBANK.NS", "SBIN.NS", "ITC.NS", "LT.NS", "MARUTI.NS"
        ]

        self.stdout.write(self.style.SUCCESS('Starting Stress Test...'))
        
        # Get or create a test user
        user, _ = User.objects.get_or_create(username='stresstest', email='stress@test.com')

        factory = RequestFactory()
        view = AnalyzeView.as_view()

        threads_before = threading.active_count()
        
        self.stdout.write(f"Threads Before: {threads_before}")

        total_time = 0
        success_count = 0
        fail_count = 0

        for ticker in tickers:
            self.stdout.write(f"--- Testing {ticker} ---")
            t0 = time.time()
            try:
                request = factory.post('/api/research/analyze/', {'ticker': ticker}, content_type='application/json')
                request.user = user
                response = view(request)
                t_elapsed = time.time() - t0
                total_time += t_elapsed
                
                if response.status_code == 200:
                    self.stdout.write(self.style.SUCCESS(f"SUCCESS: {ticker} in {t_elapsed:.2f}s"))
                    success_count += 1
                else:
                    self.stdout.write(self.style.ERROR(f"FAILED: {ticker} in {t_elapsed:.2f}s with status {response.status_code}. Data: {response.data}"))
                    fail_count += 1
            except Exception as e:
                t_elapsed = time.time() - t0
                self.stdout.write(self.style.ERROR(f"EXCEPTION: {ticker} in {t_elapsed:.2f}s -> {str(e)}"))
                fail_count += 1

        threads_after = threading.active_count()

        self.stdout.write(f"\n--- STRESS TEST SUMMARY ---")
        self.stdout.write(f"Successful: {success_count}/20")
        self.stdout.write(f"Failed: {fail_count}/20")
        self.stdout.write(f"Avg Time per Request: {total_time/20:.2f}s")
        self.stdout.write(f"Threads After: {threads_after} (Diff: {threads_after - threads_before})")
        
        if threads_after > threads_before:
            self.stdout.write(self.style.ERROR("WARNING: THREAD LEAK DETECTED"))
        else:
            self.stdout.write(self.style.SUCCESS("Thread Check: PASSED"))
