from rest_framework.exceptions import ValidationError
from .financial_service import get_financial_data

def get_chart_data(ticker_or_name):
    """
    Ingests raw financial statement arrays and formats them into chronological
    key-value lists directly mapping to Recharts data inputs.
    """
    raw_financials = get_financial_data(ticker_or_name)
    
    # yfinance returns lists starting from latest years first (e.g. 2024, 2023, 2022)
    # Recharts requires chronological order (past to present) for smooth left-to-right graphs
    yearly_raw = list(reversed(raw_financials.get("historical_yearly", [])))
    quarterly_raw = list(reversed(raw_financials.get("historical_quarterly", [])))
    
    # 1. Yearly Metrics (Revenue, Profit, EPS, ROE, Debt, Cash Flow)
    yearly_charts = []
    for item in yearly_raw:
        revenue = item.get("revenue", 0.0)
        profit = item.get("net_income", 0.0)
        yearly_charts.append({
            "year": item.get("year", "N/A"),
            "revenue": revenue,
            "profit": profit,
            "eps": item.get("eps", 0.0),
            "roe": item.get("roe", 0.0) * 100, # Convert to percentage
            "debt": item.get("debt", 0.0),
            "cash": item.get("cash", 0.0),
            "operatingCashFlow": item.get("operating_cash_flow", 0.0),
            "freeCashFlow": item.get("free_cash_flow", 0.0),
            "cashflow": item.get("operating_cash_flow", 0.0), # Operating Cash Flow for chart mapping
            "revenueVsProfit": {
                "revenue": revenue,
                "profit": profit
            }
        })
        
    # 2. Quarterly Metrics (Quarterly Revenue, Profit, Cash Flow, Debt, ROE, EPS)
    quarterly_charts = []
    for item in quarterly_raw:
        revenue = item.get("revenue", 0.0)
        profit = item.get("net_income", 0.0)
        quarterly_charts.append({
            "quarter": item.get("quarter", "N/A"),
            "revenue": revenue,
            "profit": profit,
            "cashflow": item.get("free_cash_flow", 0.0) or item.get("operating_cash_flow", 0.0),
            "debt": item.get("debt", 0.0),
            "roe": item.get("roe", 0.0) * 100, # Convert to percentage
            "eps": item.get("eps", 0.0)
        })
        
    return {
        "ticker": raw_financials.get("ticker"),
        "yearly": yearly_charts,
        "quarterly": quarterly_charts
    }
