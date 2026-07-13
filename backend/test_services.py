import os
import sys
import django
import json

# Initialize Django environment to support ORM cache calls
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from companies.services.company_service import get_company_profile
from companies.services.financial_service import get_financial_data
from companies.services.news_service import get_company_news
from companies.services.related_company_service import get_related_companies
from companies.services.chart_service import get_chart_data

TEST_COMPANIES = [
    "Apple",
    "Microsoft",
    "Tesla",
    "NVIDIA",
    "Reliance",
    "Infosys"
]

def verify_data_layer():
    print("==================================================")
    print("Starting Company Services & Data Layer Verification")
    print("==================================================")
    
    all_passed = True
    
    for name in TEST_COMPANIES:
        print(f"\nProcessing target: {name}...")
        try:
            # 1. Company Profile Service
            profile = get_company_profile(name)
            ticker = profile["ticker"]
            print(f"  [OK] Profile resolved to ticker: {ticker}")
            print(f"       Name: {profile['name']}")
            print(f"       Sector: {profile['sector']} | Industry: {profile['industry']}")
            print(f"       CEO: {profile['ceo']} | Employees: {profile['employees']}")

            # Assertions
            assert profile["ticker"] != "", "Ticker cannot be empty"
            assert profile["name"] != "", "Name cannot be empty"
            
            # 2. Financial Service
            financials = get_financial_data(ticker)
            print("  [OK] Financials fetched successfully")
            print(f"       P/E: {financials['ratios']['pe_ratio']} | ROE: {financials['ratios']['roe'] * 100:.2f}%")
            print(f"       EPS: {financials['ratios']['eps']} | Market Cap: ${financials['ratios']['market_cap']:,}")
            print(f"       Yearly statement records count: {len(financials['historical_yearly'])}")
            
            # Assertions
            assert "ratios" in financials, "Ratios key missing"
            assert len(financials["historical_yearly"]) > 0, "No yearly financials parsed"

            # 3. News Service
            news = get_company_news(ticker)
            print(f"  [OK] News articles fetched successfully. Total articles: {len(news)}")
            if news:
                first = news[0]
                print(f"       Latest headline: {first['title'][:60]}...")
                print(f"       Source: {first['source']} | Sentiment: {first['sentiment']} (Score: {first['sentiment_score']})")
                assert "sentiment" in first, "News sentiment missing"
            
            # 4. Related Company Service
            related = get_related_companies(ticker)
            print(f"  [OK] Peer recommendations: {', '.join([c['ticker'] for c in related])}")
            assert len(related) > 0, "No peer recommendations returned"

            # 5. Chart Service
            charts = get_chart_data(ticker)
            print("  [OK] Chart JSON compiled successfully")
            print(f"       Recharts yearly records parsed: {len(charts['yearly'])}")
            print(f"       Recharts quarterly records parsed: {len(charts['quarterly'])}")
            
            # Print sample format of the Recharts output for the first item
            if charts['yearly']:
                print(f"       Sample Recharts data point: {json.dumps(charts['yearly'][0])[:120]}...")
                
            assert "yearly" in charts and "quarterly" in charts, "Recharts chart keys missing"
            
        except Exception as e:
            print(f"  [ERROR] Verification failed for '{name}': {str(e)}")
            all_passed = False
            
    print("\n==================================================")
    if all_passed:
        print("[SUCCESS] ALL COMPANY RESEARCH SERVICES VERIFIED SUCCESSFULLY!")
        sys.exit(0)
    else:
        print("[ERROR] SOME SERVICE VERIFICATION CHECKS FAILED.")
        sys.exit(1)

if __name__ == "__main__":
    verify_data_layer()
