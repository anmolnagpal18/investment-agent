import requests
import yfinance as yf
import logging

logger = logging.getLogger(__name__)
from datetime import timedelta
from django.utils import timezone
from django.core.exceptions import ObjectDoesNotExist
from rest_framework.exceptions import ValidationError
from companies.models import Company

def resolve_ticker_by_name(query):
    """
    Resolves a search query (name or ticker) to a valid stock symbol using Yahoo Search suggestions.
    """
    if not query:
        return ""
    
    cleaned_query = query.strip()
    
    # Always query search API first for high suggestion accuracy
        
    url = f"https://query2.finance.yahoo.com/v1/finance/search?q={cleaned_query}"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=5)
        if response.status_code == 200:
            data = response.json()
            quotes = data.get('quotes', [])
            for quote in quotes:
                # Return the first EQUITY symbol
                if quote.get('quoteType') == 'EQUITY' and 'symbol' in quote:
                    return quote.get('symbol')
    except Exception:
        pass
        
    # Fallback to capitalized query
    return cleaned_query.upper()


def get_company_profile(ticker_or_name):
    """
    Retrieves company metadata. Leverages PostgreSQL cache first,
    otherwise fetches from yfinance and caches the result.
    """
    ticker = resolve_ticker_by_name(ticker_or_name)
    if not ticker:
        raise ValidationError("Company name or ticker could not be resolved.")
        
    company_obj = None
    try:
        company_obj = Company.objects.get(ticker=ticker)
        # Check if cached data is fresh (less than 24 hours old)
        if timezone.now() - company_obj.last_cached_at < timedelta(hours=24):
            # If financial_summary is filled, return it
            if company_obj.financial_summary and "ceo" in company_obj.financial_summary:
                return company_obj.financial_summary
    except ObjectDoesNotExist:
        pass
        
    # Cache miss or stale cache: Query Yahoo Finance
    try:
        import concurrent.futures
        
        def fetch_info():
            stock = yf.Ticker(ticker)
            return stock.info
            
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(fetch_info)
            # Timeout after 5 seconds to prevent indefinite hanging
            info = future.result(timeout=8.0)
        
        # Verify yfinance returned valid data
        if not info or 'longName' not in info:
            raise ValidationError(f"No company information found for ticker '{ticker}'.")
            
        # Parse CEO from officers list
        ceo = "N/A"
        officers = info.get("companyOfficers", [])
        if officers:
            for officer in officers:
                title = officer.get("title", "")
                if "CEO" in title or "Chief Executive" in title:
                    ceo = officer.get("name", "N/A")
                    break
            if ceo == "N/A" and len(officers) > 0:
                ceo = officers[0].get("name", "N/A")

        profile_data = {
            "ticker": ticker,
            "exchange": info.get("exchange", "N/A"),
            "name": info.get("longName", ticker),
            "sector": info.get("sector", "N/A"),
            "industry": info.get("industry", "N/A"),
            "description": info.get("longBusinessSummary", "No description available."),
            "website": info.get("website", "N/A"),
            "ceo": ceo,
            "employees": info.get("fullTimeEmployees", 0),
            "market_cap": info.get("marketCap", 0),
            "country": info.get("country", "N/A"),
            "currency": info.get("currency", "USD"),
        }
        
        # Save or update cache
        if company_obj:
            company_obj.name = profile_data["name"]
            company_obj.sector = profile_data["sector"]
            company_obj.industry = profile_data["industry"]
            company_obj.description = profile_data["description"]
            company_obj.financial_summary = profile_data
            company_obj.save()
        else:
            Company.objects.create(
                ticker=ticker,
                name=profile_data["name"],
                sector=profile_data["sector"],
                industry=profile_data["industry"],
                description=profile_data["description"],
                financial_summary=profile_data
            )
            
        return profile_data
        
    except Exception as e:
        # Fallback to expired cache if external API or internet fails
        if company_obj and company_obj.financial_summary:
            logger.warning(f"Using expired cache for {ticker} due to API failure: {e}")
            return company_obj.financial_summary
            
        logger.exception(f"Failed to fetch profile for {ticker} and no cache available.")
        raise ValidationError(f"Could not retrieve company profile for {ticker}. The data provider might be rate-limiting. Please try again later.")


def is_market_open(timezone_str):
    from datetime import datetime
    import zoneinfo
    try:
        tz = zoneinfo.ZoneInfo(timezone_str)
    except Exception:
        return False
    
    now_tz = datetime.now(tz)
    weekday = now_tz.weekday()
    if weekday > 4:  # Sat/Sun
        return False
        
    time_float = now_tz.hour + now_tz.minute / 60.0
    if "Kolkata" in timezone_str or "India" in timezone_str:
        return 9.25 <= time_float <= 15.5 # 9:15 AM - 3:30 PM IST
    else:
        return 9.5 <= time_float <= 16.0  # 9:30 AM - 4:00 PM EST

def get_market_summary():
    from django.core.cache import cache
    from datetime import datetime
    
    cached_data = cache.get("market_summary_cache")
    if cached_data:
        return cached_data

    symbols = {
        '^GSPC': {'name': 'S&P 500', 'flag': '🇺🇸'},
        '^IXIC': {'name': 'NASDAQ', 'flag': '🇺🇸'},
        '^DJI': {'name': 'Dow Jones', 'flag': '🇺🇸'},
        '^NSEI': {'name': 'NIFTY 50', 'flag': '🇮🇳'},
        '^BSESN': {'name': 'SENSEX', 'flag': '🇮🇳'}
    }

    try:
        tickers = yf.Tickers(' '.join(symbols.keys()))
        result = []
        for sym, meta in symbols.items():
            t = tickers.tickers[sym]
            fast = t.fast_info
            
            last_price = fast.get('lastPrice') or fast.get('last_price')
            prev_close = fast.get('previousClose') or fast.get('previous_close')
            timezone_str = fast.get('timezone') or 'America/New_York'
            
            if last_price is not None and prev_close is not None:
                change = last_price - prev_close
                pct_change = (change / prev_close) * 100 if prev_close else 0.0
                is_open = is_market_open(timezone_str)
                
                result.append({
                    'name': meta['name'],
                    'value': f"{last_price:,.2f}",
                    'change': f"{change:+.2f}",
                    'pct_change': f"{pct_change:+.2f}%",
                    'up': change >= 0,
                    'flag': meta['flag'],
                    'is_open': is_open,
                    'last_updated': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                })
        
        if result:
            cache.set("market_summary_cache", result, timeout=60)
            return result
    except Exception as e:
        logger.error("Failed to fetch market summary: %s", e)
        
    return None

def get_trending_stocks():
    from django.core.cache import cache
    
    cached_data = cache.get("trending_stocks_cache")
    if cached_data:
        return cached_data

    popular_tickers = ["AAPL", "MSFT", "NVDA", "GOOG", "META", "AMZN", "TSLA", "AVGO", "NFLX", "AMD"]
    domain_map = {
        'AAPL': 'apple.com',
        'MSFT': 'microsoft.com',
        'NVDA': 'nvidia.com',
        'GOOG': 'google.com',
        'META': 'meta.com',
        'AMZN': 'amazon.com',
        'TSLA': 'tesla.com',
        'AVGO': 'broadcom.com',
        'NFLX': 'netflix.com',
        'AMD': 'amd.com'
    }
    name_map = {
        'AAPL': 'Apple Inc.',
        'MSFT': 'Microsoft Corp.',
        'NVDA': 'NVIDIA Corp.',
        'GOOG': 'Alphabet Inc.',
        'META': 'Meta Platforms',
        'AMZN': 'Amazon.com Inc.',
        'TSLA': 'Tesla Inc.',
        'AVGO': 'Broadcom Inc.',
        'NFLX': 'Netflix Inc.',
        'AMD': 'Advanced Micro Devices'
    }

    try:
        tickers = yf.Tickers(' '.join(popular_tickers))
        stocks_data = []
        
        from research.models import SavedReport
        
        for sym in popular_tickers:
            t = tickers.tickers[sym]
            fast = t.fast_info
            
            last_price = fast.get('lastPrice') or fast.get('last_price')
            prev_close = fast.get('previousClose') or fast.get('previous_close')
            volume = fast.get('lastVolume') or 0
            
            if last_price is not None and prev_close is not None:
                change = last_price - prev_close
                pct_change = (change / prev_close) * 100 if prev_close else 0.0
                
                # Fetch recommendation from database if analyzed
                latest_report = SavedReport.objects.filter(company__ticker=sym).order_by('-created_at').first()
                if latest_report:
                    recommendation = latest_report.key_highlights.get('recommendation_payload', {}).get('recommendation', 'HOLD')
                    ai_score = latest_report.key_highlights.get('recommendation_payload', {}).get('ai_score', 0)
                else:
                    recommendation = 'HOLD'
                    ai_score = 70
                
                stocks_data.append({
                    'ticker': sym,
                    'name': name_map.get(sym, sym),
                    'sector': 'Technology' if sym in ['AAPL', 'MSFT', 'NVDA', 'AVGO', 'AMD'] else 'Consumer' if sym in ['TSLA', 'AMZN', 'NFLX'] else 'Communication',
                    'price': f"${last_price:,.2f}",
                    'pct_change': f"{pct_change:+.2f}%",
                    'up': change >= 0,
                    'logo_url': f"https://logo.clearbit.com/{domain_map[sym]}",
                    'recommendation': recommendation,
                    'ai_score': ai_score,
                    'volume': volume,
                    'abs_pct_change': abs(pct_change)
                })
        
        # Sort by volume descending
        stocks_data.sort(key=lambda x: x['volume'], reverse=True)
        
        top_5 = stocks_data[:5]
        
        if top_5:
            cache.set("trending_stocks_cache", top_5, timeout=60)
            return top_5
    except Exception as e:
        logger.error("Failed to fetch trending stocks: %s", e)
        
    return None
