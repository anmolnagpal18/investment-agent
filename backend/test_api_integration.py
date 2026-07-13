import os
import sys
import django
import json
from unittest.mock import MagicMock

# Initialize Django environment to support ORM and DB model queries
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.conf import settings
if 'testserver' not in settings.ALLOWED_HOSTS:
    settings.ALLOWED_HOSTS.append('testserver')

from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status
from langchain_google_genai import ChatGoogleGenerativeAI

# Configure LLM mocking to execute pipeline tests offline/sandboxed
api_key = os.getenv("GEMINI_API_KEY")
if not api_key or "your_gemini_api_key" in api_key or api_key == "mock_key":
    os.environ["GEMINI_API_KEY"] = "mock_key"
    api_key = "mock_key"
    print("[INFO] No active GEMINI_API_KEY detected. Mocking ChatGoogleGenerativeAI invocations for API integration tests.")
    
    def mock_invoke(self, prompt, *args, **kwargs):
        prompt_text = str(prompt)
        mock_response = MagicMock()
        
        if "Lead Financial Risk Officer" in prompt_text or "RISK_ANALYSIS" in prompt_text:
            mock_response.content = json.dumps([
                "Leverage risk: capital expenditure rates are rising.",
                "Competition risk: alternative chip makers (AMD, Intel).",
                "Regulatory risk: export constraints."
            ])
        elif "Senior Strategic Analyst" in prompt_text or "SWOT_ANALYSIS" in prompt_text:
            mock_response.content = json.dumps({
                "strengths": ["Strong brand moat", "Global ecosystem lock-in"],
                "weaknesses": ["Premium pricing ceiling", "Heavy hardware cycle dependence"],
                "opportunities": ["Custom enterprise cloud chips", "Services division expansion"],
                "threats": ["Competitive TPU accelerators", "Geopolitical export controls"]
            })
        elif "Quantitative Financial Modeling Expert" in prompt_text or "SCORES_CALCULATION" in prompt_text:
            mock_response.content = json.dumps({
                "financial_health": 95,
                "growth": 85,
                "valuation": 70,
                "risk_safety": 85,
                "news_sentiment": 80
            })
        elif "Investment Committee Chairman" in prompt_text or "RECOMMENDATION_THESIS" in prompt_text:
            mock_response.content = json.dumps({
                "reasoning": "Standard investment thesis reasoning justifying positive performance. Healthy metrics and brand moat support BUY.",
                "top_reasons": ["Dominant market ecosystem", "Healthy net profit margins", "Growing services segment"],
                "major_risks": ["Valuation levels are premium", "Supply hardware cycles dependency", "Antitrust regulations"],
                "future_outlook": "Stable prospects for services sector scaling over 12-18 months."
            })
        elif "Research Analyst" in prompt_text or "CHAT_FOLLOWUP_PROMPT" in prompt_text:
            mock_response.content = "Ecosystem moat is the core driver of High Financial Health, compensating for premium multiples."
        elif "Lead Financial Analyst" in prompt_text or "comparative benchmarking" in prompt_text:
            mock_response.content = "## Comparative Benchmarking Report\n- Executive Summary: Tech giant superiority.\n- Winner: AAPL."
        else:
            mock_response.content = "Mock response"
            
        return mock_response
        
    ChatGoogleGenerativeAI.invoke = mock_invoke


def test_rest_endpoints():
    print("==================================================")
    print("Starting REST Backend Integration APIs Testing")
    print("==================================================")
    
    # 1. Prepare User
    username = "api_tester"
    email = "tester@investiq.ai"
    try:
        user = User.objects.get(username=username)
    except User.DoesNotExist:
        user = User.objects.create_user(username=username, email=email, password="TestPassword123")
        
    # Initialize APIClient and force authenticate
    client = APIClient()
    client.force_authenticate(user=user)
    print(f"[OK] Authenticated client as user: {user.username}")

    ticker = "AAPL"
    
    # 2. Test POST /api/analyze/
    print(f"\nTesting POST /api/analyze/ for {ticker}...")
    analyze_res = client.post("/api/analyze/", {"ticker": ticker}, format="json")
    
    assert analyze_res.status_code == status.HTTP_200_OK, f"Expected 200, got {analyze_res.status_code}. Detail: {analyze_res.data}"
    data = analyze_res.data
    print("[OK] Analyze API responded successfully!")
    print(f"     Resolved Stock: {data['name']} ({data['ticker']})")
    print(f"     Verdict: {data['verdict']} | Weighted score: {data['overall_score']}")
    print(f"     Risk level: {data['risk_level']} | Confidence: {data['confidence']}%")
    print(f"     Report HTML URL: {data['html_url']}")
    
    # 3. Test POST /api/chat/
    print("\nTesting POST /api/chat/ (Follow-up Chat)...")
    chat_res = client.post("/api/chat/", {"ticker": ticker, "content": "Explain why news score is rated 80"}, format="json")
    assert chat_res.status_code == status.HTTP_200_OK, f"Expected 200, got {chat_res.status_code}"
    print("[OK] Chat API responded successfully!")
    print(f"     Reply: {chat_res.data['reply']}")

    # 4. Test POST /api/compare/
    print("\nTesting POST /api/compare/ (Stock Comparator)...")
    compare_res = client.post("/api/compare/", {"tickers": ["AAPL", "MSFT"]}, format="json")
    assert compare_res.status_code == status.HTTP_200_OK, f"Expected 200, got {compare_res.status_code}"
    print("[OK] Compare API responded successfully!")
    print(f"     Comparison Report snippet:\n{compare_res.data['comparison_report'][:150]}...")

    # 5. Test GET /api/history/
    print("\nTesting GET /api/history/ (Research History)...")
    history_res = client.get("/api/history/")
    assert history_res.status_code == status.HTTP_200_OK, f"Expected 200, got {history_res.status_code}"
    print(f"[OK] History API successfully retrieved {len(history_res.data)} items.")

    # 6. Test POST & GET /api/favorites/
    print("\nTesting Watchlist API /api/favorites/...")
    # Toggle favorite
    fav_toggle = client.post("/api/favorites/", {"ticker": ticker}, format="json")
    assert fav_toggle.status_code in [status.HTTP_200_OK, status.HTTP_201_CREATED]
    is_fav = fav_toggle.data["is_favorite"]
    print(f"[OK] Watchlist toggle response: {fav_toggle.data['detail']} | is_favorite: {is_fav}")
    
    # Get favorites list
    favs_list = client.get("/api/favorites/")
    assert favs_list.status_code == status.HTTP_200_OK
    print(f"[OK] Favorites list retrieved successfully. Count: {len(favs_list.data)}")

    # 7. Test POST /api/export/pdf/
    print("\nTesting POST /api/export/pdf/ (Report File Export)...")
    export_res = client.post("/api/export/pdf/", {"ticker": ticker}, format="json")
    assert export_res.status_code == status.HTTP_200_OK, f"Expected 200, got {export_res.status_code}"
    assert export_res['Content-Type'] == 'text/html'
    assert 'attachment' in export_res['Content-Disposition']
    print(f"[OK] Report Export completed successfully!")
    print(f"     Content-Disposition: {export_res['Content-Disposition']}")
    
    print("\n==================================================")
    print("[SUCCESS] ALL REST INTEGRATION API ENDPOINTS VERIFIED SUCCESSFULLY!")
    sys.exit(0)

if __name__ == "__main__":
    test_rest_endpoints()
