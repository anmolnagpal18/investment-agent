import requests
import yfinance as yf
from rest_framework.exceptions import ValidationError
from companies.models import Company
from research.models import SavedReport
from .company_service import resolve_ticker_by_name

# Simple in-memory cache for peer metadata
_PEER_METADATA_CACHE = {}

def get_related_companies(ticker_or_name):
    """
    Finds similar peer companies based on industry/sector benchmarking.
    Enriches peer profiles with calculated similarity percentages and business reasons.
    Exposes richer metadata, and queries database for previous analysis results.
    """
    ticker = resolve_ticker_by_name(ticker_or_name)
    if not ticker:
        raise ValidationError("Ticker or company name cannot be resolved.")

    primary_sector = "N/A"
    primary_industry = "N/A"
    try:
        primary_co = Company.objects.get(ticker=ticker)
        primary_sector = primary_co.sector
        primary_industry = primary_co.industry
    except Company.DoesNotExist:
        try:
            stock = yf.Ticker(ticker)
            info = stock.info
            if info:
                primary_sector = info.get("sector", "N/A")
                primary_industry = info.get("industry", "N/A")
        except Exception:
            pass

    peers_list = []
    
    # 1. Fetch recommended symbols from Yahoo Finance recommendations
    url = f"https://query2.finance.yahoo.com/v6/finance/recommendationsbysymbol/{ticker}"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=5)
        if response.status_code == 200:
            data = response.json()
            results = data.get('finance', {}).get('result', [])
            if results:
                recommended = results[0].get('recommendedSymbols', [])
                peers_list = [item.get('symbol') for item in recommended if 'symbol' in item][:5]
    except Exception:
        pass

    # 2. Fallback: Query local database matching sector and industry
    if not peers_list:
        try:
            db_peers = Company.objects.filter(
                sector=primary_sector, 
                industry=primary_industry
            ).exclude(ticker=ticker)[:5]
            peers_list = [c.ticker for c in db_peers]
            
            if not peers_list:
                db_sector_peers = Company.objects.filter(
                    sector=primary_sector
                ).exclude(ticker=ticker)[:5]
                peers_list = [c.ticker for c in db_sector_peers]
        except Exception:
            pass

    # 3. Default fallback list based on well-known sectors
    if not peers_list:
        tech_defaults = ["MSFT", "AAPL", "GOOG", "AMZN", "META"]
        auto_defaults = ["TSLA", "TM", "F", "GM", "RIVN"]
        if ticker in ["AAPL", "MSFT", "GOOG", "NVDA", "INFY", "WIT"]:
            peers_list = [t for t in tech_defaults if t != ticker][:4]
        elif ticker in ["TSLA", "RIVN", "LCID"]:
            peers_list = [t for t in auto_defaults if t != ticker][:4]
        else:
            peers_list = ["MSFT", "AAPL", "GOOG"]

    # 4. Resolve details and calculate similarity scores
    resolved_peers = []
    for peer_symbol in peers_list:
        if peer_symbol in _PEER_METADATA_CACHE:
            peer_data = _PEER_METADATA_CACHE[peer_symbol].copy()
        else:
            try:
                peer_stock = yf.Ticker(peer_symbol)
                peer_info = peer_stock.info
                
                if peer_info and 'longName' in peer_info:
                    sector = peer_info.get("sector", "N/A")
                    industry = peer_info.get("industry", "N/A")
                    
                    if sector == primary_sector and industry == primary_industry:
                        similarity = 92
                        reason = f"Direct Competitor in {industry}"
                    elif sector == primary_sector:
                        similarity = 82
                        reason = f"Peer Competitor in {sector} segment"
                    else:
                        similarity = 73
                        reason = "Broad sector overlap competitor"
                        
                    peer_data = {
                        "ticker": peer_symbol,
                        "name": peer_info.get("longName", peer_symbol),
                        "sector": sector,
                        "industry": industry,
                        "market_cap": peer_info.get("marketCap", 0),
                        "currency": peer_info.get("financialCurrency") or peer_info.get("currency") or "USD",
                        "similarity": similarity,
                        "reason": reason
                    }
                    _PEER_METADATA_CACHE[peer_symbol] = peer_data.copy()
                else:
                    raise ValueError("Missing name")
            except Exception:
                peer_data = {
                    "ticker": peer_symbol,
                    "name": peer_symbol,
                    "sector": primary_sector,
                    "industry": primary_industry,
                    "market_cap": 0,
                    "currency": "USD",
                    "similarity": 80,
                    "reason": f"Sector peer overlap in {primary_sector}"
                }

        # Enrich with database checks
        try:
            latest_report = SavedReport.objects.filter(company__ticker=peer_symbol).order_by('-created_at').first()
            if latest_report and latest_report.key_highlights:
                kh = latest_report.key_highlights
                peer_data["recommendation"] = kh.get("verdict") or kh.get("recommendation") or None
                peer_data["ai_score"] = kh.get("overall_score") or kh.get("ai_score") or None
                peer_data["risk_level"] = kh.get("risk_level") or None
            else:
                peer_data["recommendation"] = None
                peer_data["ai_score"] = None
                peer_data["risk_level"] = None
        except Exception:
            peer_data["recommendation"] = None
            peer_data["ai_score"] = None
            peer_data["risk_level"] = None

        resolved_peers.append(peer_data)

    return resolved_peers
