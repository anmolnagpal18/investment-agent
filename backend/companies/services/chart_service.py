from rest_framework.exceptions import ValidationError
from .financial_service import get_financial_data
import math

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


def generate_radar_chart_svg(companies_summary):
    """
    Generates a clean inline SVG radar chart comparing up to 3 companies
    across 5 key dimensions: Financial Health, Growth, Valuation, Risk Safety, and News Sentiment.
    """
    width = 400
    height = 300
    center_x = 200
    center_y = 150
    radius = 90
    
    dimensions = ["Financial", "Growth", "Valuation", "Risk Safety", "Sentiment"]
    angles = [i * 2 * math.pi / 5 for i in range(5)]
    
    colors = [
        {"fill": "rgba(59, 130, 246, 0.2)", "stroke": "#3B82F6"}, # Blue
        {"fill": "rgba(16, 185, 129, 0.2)", "stroke": "#10B981"}, # Green
        {"fill": "rgba(245, 158, 11, 0.2)", "stroke": "#F59E0B"}  # Amber
    ]
    
    svg = []
    svg.append(f'<svg width="100%" height="100%" viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg">')
    
    for pct in [20, 40, 60, 80, 100]:
        r = radius * (pct / 100)
        pts = []
        for a in angles:
            x = center_x + r * math.sin(a)
            y = center_y - r * math.cos(a)
            pts.append(f"{x},{y}")
        pts_str = " ".join(pts)
        svg.append(f'  <polygon points="{pts_str}" fill="none" stroke="#E2E8F0" stroke-width="1" />')
        if pct in [40, 80, 100]:
            svg.append(f'  <text x="{center_x + 5}" y="{center_y - r + 3}" fill="#94A3B8" font-size="8" font-family="sans-serif">{pct}</text>')
            
    for i, a in enumerate(angles):
        x = center_x + radius * math.sin(a)
        y = center_y - radius * math.cos(a)
        svg.append(f'  <line x1="{center_x}" y1="{center_y}" x2="{x}" y2="{y}" stroke="#E2E8F0" stroke-width="1" />')
        
        label_dist = radius + 20
        lx = center_x + label_dist * math.sin(a)
        ly = center_y - label_dist * math.cos(a)
        
        align = "middle"
        if math.sin(a) > 0.1:
            align = "start"
        elif math.sin(a) < -0.1:
            align = "end"
            
        svg.append(f'  <text x="{lx}" y="{ly + 3}" fill="#475569" font-size="9.5" font-family="sans-serif" font-weight="600" text-anchor="{align}">{dimensions[i]}</text>')
        
    for idx, c in enumerate(companies_summary[:3]):
        scores = [
            c.get("financial", 50),
            c.get("growth", 50),
            c.get("valuation", 50),
            c.get("risk", 50),
            c.get("sentiment", 50)
        ]
        
        pts = []
        for i, a in enumerate(angles):
            s = min(max(scores[i], 0), 100)
            r = radius * (s / 100)
            x = center_x + r * math.sin(a)
            y = center_y - r * math.cos(a)
            pts.append(f"{x},{y}")
            
        pts_str = " ".join(pts)
        style = colors[idx]
        svg.append(f'  <polygon points="{pts_str}" fill="{style["fill"]}" stroke="{style["stroke"]}" stroke-width="2" />')
        for pt in pts:
            px, py = pt.split(",")
            svg.append(f'  <circle cx="{px}" cy="{py}" r="3.5" fill="{style["stroke"]}" stroke="white" stroke-width="1" />')
            
    leg_y = height - 15
    start_x = width / 2 - (len(companies_summary) * 50)
    for idx, c in enumerate(companies_summary[:3]):
        style = colors[idx]
        svg.append(f'  <circle cx="{start_x}" cy="{leg_y - 3}" r="4" fill="{style["stroke"]}" />')
        svg.append(f'  <text x="{start_x + 8}" y="{leg_y}" fill="#1E293B" font-size="9" font-family="sans-serif" font-weight="700">{c["ticker"]}</text>')
        start_x += 100
        
    svg.append('</svg>')
    return "\n".join(svg)


def generate_grouped_bar_chart_svg(companies_data, metric_name, title):
    """
    Generates a high-quality grouped bar chart comparing a financial metric
    across up to 3 compared companies.
    """
    width = 500
    height = 240
    padding_top = 40
    padding_bottom = 40
    padding_left = 65
    padding_right = 20
    
    chart_h = height - padding_top - padding_bottom
    chart_w = width - padding_left - padding_right
    
    colors = ["#3B82F6", "#10B981", "#F59E0B"]
    raw_values = []
    company_tickers = []
    
    for c in companies_data[:3]:
        ticker = c["ticker"]
        company_tickers.append(ticker)
        
        ratios = c.get("ratios", {}) or {}
        prep = c.get("preprocessed_metrics", {}) or {}
        hist = c.get("historical_yearly", []) or []
        
        val = 0
        if metric_name == "revenue":
            val = prep.get("revenue") or ratios.get("revenue") or (hist[0].get("revenue") if hist else 0)
        elif metric_name == "net_income":
            val = prep.get("net_income") or (hist[0].get("net_income") if hist else 0)
        elif metric_name == "operating_margin":
            val = ratios.get("operating_margin") or (hist[0].get("operating_margin") if hist else 0)
            if val and val < 1:
                val = val * 100
        elif metric_name == "roe":
            val = ratios.get("roe") or (hist[0].get("roe") if hist else 0)
            if val and val < 1:
                val = val * 100
        elif metric_name == "eps":
            val = ratios.get("eps") or ratios.get("trailing_eps") or (hist[0].get("eps") if hist else 0)
        elif metric_name == "free_cash_flow":
            val = prep.get("free_cash_flow") or (hist[0].get("operating_cash_flow") if hist else 0)
        elif metric_name == "market_cap":
            val = c.get("market_cap") or ratios.get("market_cap") or 0.0
        elif metric_name == "revenue_growth":
            val = prep.get("revenue_growth_pct") or ratios.get("revenue_growth") or 0.0
            if val and val < 1:
                val = val * 100
            
        try:
            val = float(val) if val is not None else 0.0
        except (ValueError, TypeError):
            val = 0.0
            
        raw_values.append(val)
        
    max_val = max(raw_values) if raw_values else 1.0
    if max_val <= 0:
        max_val = 1.0
        
    def get_height(val):
        h = (abs(val) / max_val) * (chart_h - 10)
        return min(max(h, 0), chart_h)
        
    def format_val_label(val):
        if abs(val) >= 1e12:
            return f"{val/1e12:.1f}T"
        elif abs(val) >= 1e9:
            return f"{val/1e9:.1f}B"
        elif abs(val) >= 1e6:
            return f"{val/1e6:.1f}M"
        elif metric_name in ["operating_margin", "roe", "revenue_growth"]:
            return f"{val:.1f}%"
        else:
            return f"{val:.2f}"
            
    svg = []
    svg.append(f'<svg width="100%" height="100%" viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg">')
    svg.append(f'  <text x="{padding_left}" y="20" fill="#1E293B" font-size="11" font-family="sans-serif" font-weight="700">{title}</text>')
    
    for i in range(4):
        val_frac = i / 3
        y = padding_top + chart_h - (val_frac * chart_h)
        grid_val = val_frac * max_val
        svg.append(f'  <line x1="{padding_left}" y1="{y}" x2="{width - padding_right}" y2="{y}" stroke="#F1F5F9" stroke-width="1" />')
        svg.append(f'  <text x="{padding_left - 10}" y="{y + 3}" fill="#94A3B8" font-size="8" font-family="sans-serif" text-anchor="end">{format_val_label(grid_val)}</text>')
        
    baseline_y = padding_top + chart_h
    svg.append(f'  <line x1="{padding_left}" y1="{baseline_y}" x2="{width - padding_right}" y2="{baseline_y}" stroke="#CBD5E1" stroke-width="1" />')
    
    num_companies = len(company_tickers)
    group_width = chart_w / max(num_companies, 1)
    bar_w = min(28, group_width / (num_companies + 1.2))
    
    for idx, (ticker, val) in enumerate(zip(company_tickers, raw_values)):
        bar_h = get_height(val)
        group_center = padding_left + (idx * group_width) + (group_width / 2)
        bar_x = group_center - (bar_w / 2)
        bar_y = baseline_y - bar_h
        
        color = colors[idx]
        svg.append(f'  <rect x="{bar_x}" y="{bar_y}" width="{bar_w}" height="{bar_h}" fill="{color}" rx="3" />')
        svg.append(f'  <text x="{bar_x + bar_w/2}" y="{bar_y - 5}" fill="#475569" font-size="8.5" font-family="sans-serif" font-weight="600" text-anchor="middle">{format_val_label(val)}</text>')
        svg.append(f'  <text x="{bar_x + bar_w/2}" y="{baseline_y + 16}" fill="#64748B" font-size="9" font-family="sans-serif" font-weight="700" text-anchor="middle">{ticker}</text>')
        
    svg.append('</svg>')
    return "\n".join(svg)
