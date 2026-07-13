# Prompt templates for Gemini 2.5 Flash execution

RISK_ANALYSIS_PROMPT = """
You are a Lead Financial Risk Officer.
Analyze the company profile, financials, and recent news to identify 3-5 critical risks.

Company: {company_name} ({ticker})
Industry: {industry}
Description: {description}
Financial Metrics: {financials}

Select and detail the major operational, financial, market, and credit risks.
Format your response as a valid JSON list of strings, e.g.:
[
  "Market risk: detail...",
  "Financial risk: detail..."
]
Do not include markdown code fence formatting or any text outside the JSON list.
"""

SWOT_ANALYSIS_PROMPT = """
You are a Senior Strategic Analyst.
Perform a SWOT analysis for {company_name} ({ticker}).

Company Description: {description}
Financial Metrics: {financials}
News Sentiment: {news_sentiment}

Identify:
- 3 Strengths (internal capital, scale, intellectual property, margins)
- 3 Weaknesses (cash flow issues, high leverage, customer concentration)
- 3 Opportunities (market expansion, product launches, cyclical tailwinds)
- 3 Threats (competitors, interest rates, regulatory changes)

Format your response as a valid JSON object matching this structure:
{{
  "strengths": ["...", "...", "..."],
  "weaknesses": ["...", "...", "..."],
  "opportunities": ["...", "...", "..."],
  "threats": ["...", "...", "..."]
}}
Do not include markdown code fence formatting or any text outside the JSON object.
"""

SCORES_CALCULATION_PROMPT = """
You are a Quantitative Financial Modeling Expert.
Your task is to assign scores from 0 to 100 for the following 5 categories for {company_name} ({ticker}):

Company Profile: {description}
Financial Metrics: {financials}
News Articles: {news}

Assign scores (integers, 0 to 100) for:
1. "financial_health": Ability to cover debt, net margins, capital returns, cash flows.
2. "growth": Historic and projected revenue/net income growth.
3. "valuation": P/E multiples relative to peer levels and earnings power.
4. "risk_safety": Safety from market and operational threats (100 = extremely safe/low risk, 0 = high risk).
5. "news_sentiment": General media tone surrounding recent events (100 = highly bullish, 0 = highly bearish).

Format your response as a valid JSON object matching this structure:
{{
  "financial_health": 88,
  "growth": 78,
  "valuation": 72,
  "risk_safety": 65,
  "news_sentiment": 80
}}
Do not include markdown code fence formatting or any text outside the JSON object.
"""

RECOMMENDATION_THESIS_PROMPT = """
You are an Investment Committee Chairman.
Write a formal research thesis for {company_name} ({ticker}) given the following metrics and ratings:

Recommendation Rating: {recommendation}
Overall AI Score: {ai_score} / 100
Confidence: {confidence}%
Category Scores: {scores}
SWOT Analysis: {swot}
Key Risks: {risks}
Peers Benchmarking: {peers}

Draft a structured financial thesis.
- "reasoning": A 3-paragraph institutional-grade investment thesis justifying the recommendation and explaining how the category scores influenced the final verdict.
- "top_reasons": A list of the top 3 core positive reasons why the company is recommended this way (e.g. "Strong cash flow", "High profit margins").
- "major_risks": A list of the top 3 reasons why the company might not be stronger or major risk factors (e.g. "Expensive valuation", "Macroeconomic headwinds").
- "future_outlook": A 1-paragraph summary of the mid-term future outlook (12-18 months).

Format your response as a valid JSON object matching this structure:
{{
  "reasoning": "...",
  "top_reasons": ["...", "...", "..."],
  "major_risks": ["...", "...", "..."],
  "future_outlook": "..."
}}
Do not include markdown code fence formatting or any text outside the JSON object.
"""

# Professional A4 Investment Research Report Template (Bloomberg/Morningstar style)
REPORT_HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>InvestIQ Research Report — {name} ({ticker})</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
        @page {{
            size: A4;
            margin: 0;
        }}
        html, body {{
            margin: 0;
            padding: 0;
            width: 210mm;
            background: white;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            color: #0F172A;
            font-size: 10pt;
            line-height: 1.55;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }}
        .page {{
            width: 210mm;
            height: 297mm; /* Exact physical A4 page height */
            padding: 16mm; /* Exact physical A4 page margin */
            position: relative;
            page-break-after: always;
            break-after: page;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            background: white;
            box-sizing: border-box;
        }}
        .page:last-child {{
            page-break-after: avoid;
            break-after: avoid;
        }}
        .page-footer {{
            position: relative;
            margin-top: auto;
            padding-top: 8px;
            border-top: 1px solid #e2e8f0;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 7.5pt;
            color: #94a3b8;
        }}
        .page-footer strong {{ color: #64748b; }}
        
        table, .card, .chart-wrap, .swot-grid, .metric-grid, .two-col, .outlook-box, .disclaimer {{
            page-break-inside: avoid;
            break-inside: avoid;
        }}
        
        h2 {{ font-size: 15pt; font-weight: 800; color: #1e293b; margin-bottom: 12px; }}
        h3 {{ font-size: 11pt; font-weight: 700; color: #334155; margin-bottom: 8px; }}
        p {{ color: #334155; line-height: 1.6; }}
        .section-header {{
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 16px;
            padding-bottom: 10px;
            border-bottom: 2px solid #3B82F6;
        }}
        .section-header h2 {{ margin-bottom: 0; }}
        .section-badge {{
            font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;
            color: #3B82F6; background: #EFF6FF; border: 1px solid #BFDBFE;
            border-radius: 4px; padding: 2px 7px;
        }}
        .cover {{
            flex: 1;
            background: linear-gradient(135deg, #0F172A 0%, #1e3a5f 50%, #0F172A 100%);
            border-radius: 4px;
            padding: 40px 40px;
            color: white;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }}
        .cover-brand {{ display: flex; align-items: center; gap: 12px; margin-bottom: 32px; }}
        .cover-brand-icon {{
            width: 40px; height: 40px; background: linear-gradient(135deg, #3B82F6, #6366F1);
            border-radius: 10px; display: flex; align-items: center; justify-content: center;
            font-size: 18px; font-weight: 900; color: white;
        }}
        .cover-brand-name {{ font-size: 13pt; font-weight: 800; color: white; letter-spacing: -0.3px; }}
        .cover-brand-sub {{ font-size: 8pt; color: #94a3b8; margin-top: 1px; }}
        .cover-ticker-badge {{
            display: inline-block; background: rgba(59,130,246,0.25);
            border: 1px solid rgba(59,130,246,0.5); color: #93C5FD;
            font-size: 11pt; font-weight: 800; letter-spacing: 1px;
            padding: 5px 14px; border-radius: 6px; margin-bottom: 12px;
        }}
        .cover-title {{ font-size: 30pt; font-weight: 900; color: white; line-height: 1.1; margin-bottom: 8px; }}
        .cover-subtitle {{ font-size: 11pt; color: #94a3b8; margin-bottom: 32px; }}
        .cover-badge-row {{ display: flex; align-items: center; gap: 16px; margin-bottom: 28px; flex-wrap: wrap; }}
        .rec-badge {{
            display: inline-flex; align-items: center; gap: 8px; padding: 10px 24px;
            border-radius: 50px; font-size: 18pt; font-weight: 900; letter-spacing: 2px; text-transform: uppercase;
        }}
        .rec-buy   {{ background: rgba(16,185,129,0.2); border: 2px solid #10B981; color: #34D399; }}
        .rec-hold  {{ background: rgba(245,158,11,0.2);  border: 2px solid #F59E0B; color: #FCD34D; }}
        .rec-pass  {{ background: rgba(239,68,68,0.2);   border: 2px solid #EF4444; color: #F87171; }}
        .cover-score-box {{
            background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15);
            border-radius: 12px; padding: 14px 20px; text-align: center; min-width: 100px;
        }}
        .cover-score-num {{ font-size: 24pt; font-weight: 900; color: #60A5FA; line-height: 1; }}
        .cover-score-label {{ font-size: 7.5pt; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.8px; margin-top: 3px; }}
        .cover-meta {{ display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px; margin-bottom: 32px; }}
        .cover-meta-label {{ color: #64748b; font-weight: 600; text-transform: uppercase; font-size: 7.5pt; letter-spacing: 0.5px; }}
        .cover-meta-value {{ color: #cbd5e1; font-weight: 500; margin-top: 1px; font-size: 9pt; }}
        .cover-tech-row {{ display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }}
        .cover-tech-pill {{
            background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15);
            border-radius: 100px; padding: 4px 10px; font-size: 7.5pt; color: #94a3b8;
        }}
        .metric-grid {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }}
        .metric-card {{ background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 12px 14px; }}
        .metric-card .label {{ font-size: 7.5pt; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #64748B; margin-bottom: 4px; }}
        .metric-card .value {{ font-size: 14pt; font-weight: 800; color: #0F172A; line-height: 1.1; }}
        .metric-card .sub   {{ font-size: 8pt; color: #64748B; margin-top: 2px; }}
        .metric-card.blue   {{ border-left: 3px solid #3B82F6; }}
        .metric-card.green  {{ border-left: 3px solid #10B981; }}
        .metric-card.amber  {{ border-left: 3px solid #F59E0B; }}
        .metric-card.red    {{ border-left: 3px solid #EF4444; }}
        .metric-card.purple {{ border-left: 3px solid #8B5CF6; }}
        .metric-card.teal   {{ border-left: 3px solid #14B8A6; }}
        .data-table {{ width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 14px; }}
        .data-table th {{
            background: #F1F5F9; color: #475569; font-weight: 700; font-size: 8pt;
            text-transform: uppercase; letter-spacing: 0.5px; padding: 8px 10px;
            text-align: left; border-bottom: 2px solid #E2E8F0;
        }}
        .data-table td {{ padding: 7px 10px; border-bottom: 1px solid #F1F5F9; color: #334155; word-wrap: break-word; overflow-wrap: anywhere; }}
        .data-table tr:last-child td {{ border-bottom: none; }}
        .data-table tr:nth-child(even) td {{ background: #F8FAFC; }}
        .data-table td.num {{ text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }}
        .score-row {{ display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }}
        .score-row .name {{ width: 130px; font-size: 9pt; font-weight: 600; color: #334155; flex-shrink: 0; }}
        .score-bar-bg {{ flex: 1; height: 8px; background: #E2E8F0; border-radius: 100px; overflow: hidden; }}
        .score-bar-fill {{ height: 100%; border-radius: 100px; }}
        .score-row .num {{ width: 55px; text-align: right; font-size: 9pt; font-weight: 700; flex-shrink: 0; }}
        .two-col {{ display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }}
        .card {{ background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 16px; margin-bottom: 14px; }}
        .swot-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }}
        .swot-cell {{ border-radius: 10px; padding: 12px 14px; }}
        .swot-s {{ background: #F0FDF4; border: 1px solid #BBF7D0; }}
        .swot-w {{ background: #FFF7ED; border: 1px solid #FDE68A; }}
        .swot-o {{ background: #EFF6FF; border: 1px solid #BFDBFE; }}
        .swot-t {{ background: #FFF1F2; border: 1px solid #FECDD3; }}
        .swot-title {{ font-size: 9pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }}
        .swot-s .swot-title {{ color: #15803D; }} .swot-w .swot-title {{ color: #B45309; }}
        .swot-o .swot-title {{ color: #1D4ED8; }} .swot-t .swot-title {{ color: #BE123C; }}
        .swot-list {{ padding-left: 14px; }}
        .swot-list li {{ font-size: 8.5pt; color: #334155; margin-bottom: 4px; line-height: 1.45; word-wrap: break-word; }}
        .news-card {{ border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; }}
        .news-card.positive {{ background: #F0FDF4; border: 1px solid #BBF7D0; border-left: 3px solid #10B981; }}
        .news-card.negative {{ background: #FFF1F2; border: 1px solid #FECDD3; border-left: 3px solid #EF4444; }}
        .news-card .headline {{ font-size: 9pt; font-weight: 700; color: #0F172A; line-height: 1.4; margin-bottom: 3px; word-wrap: break-word; }}
        .news-card .meta {{ font-size: 7.5pt; color: #64748B; }}
        .reason-list {{ padding: 0; list-style: none; }}
        .reason-list li {{ display: flex; align-items: flex-start; gap: 8px; padding: 6px 0; border-bottom: 1px solid #F1F5F9; font-size: 9pt; color: #334155; word-wrap: break-word; }}
        .reason-list li:last-child {{ border-bottom: none; }}
        .reason-list .icon {{ flex-shrink: 0; margin-top: 1px; }}
        .peer-table {{ width: 100%; border-collapse: collapse; font-size: 8.5pt; }}
        .peer-table th {{ background: #0F172A; color: white; font-weight: 700; padding: 8px 10px; text-align: left; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.5px; }}
        .peer-table td {{ padding: 7px 10px; border-bottom: 1px solid #E2E8F0; color: #334155; word-wrap: break-word; overflow-wrap: anywhere; }}
        .peer-table tr:nth-child(even) td {{ background: #F8FAFC; }}
        .peer-table td .pill {{ display: inline-block; background: #EFF6FF; color: #3B82F6; border-radius: 4px; padding: 1px 6px; font-weight: 700; font-size: 7.5pt; }}
        .disclaimer {{ background: #FFF7ED; border: 1px solid #FDE68A; border-left: 3px solid #F59E0B; border-radius: 8px; padding: 12px 14px; font-size: 7.5pt; color: #78350F; line-height: 1.5; word-wrap: break-word; }}
        .outlook-box {{ background: #EFF6FF; border: 1px solid #BFDBFE; border-left: 3px solid #3B82F6; border-radius: 8px; padding: 14px 16px; font-size: 9.5pt; color: #1E3A5F; line-height: 1.65; word-wrap: break-word; margin-bottom: 14px; }}
        .chart-wrap {{ background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 16px; margin-bottom: 14px; }}
        .chart-title {{ font-size: 9pt; font-weight: 700; color: #334155; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; }}
        .chart-legend {{ display: flex; gap: 12px; margin-top: 8px; flex-wrap: wrap; }}
        .chart-legend-item {{ display: flex; align-items: center; gap: 5px; font-size: 7.5pt; color: #64748B; }}
        .chart-legend-dot {{ width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }}
        .no-data {{ font-size: 9pt; color: #94a3b8; font-style: italic; padding: 20px 0; text-align: center; }}
    </style>
</head>
<body>

<!-- PAGE 1: COVER -->
<div class="page">
<div class="cover">
  <div>
    <div class="cover-brand">
      <div class="cover-brand-icon">⚡</div>
      <div><div class="cover-brand-name">InvestIQ</div><div class="cover-brand-sub">Investment Research Platform</div></div>
    </div>
    <div class="cover-ticker-badge">{ticker}</div>
    <div class="cover-title">{name}</div>
    <div class="cover-subtitle">AI-Powered Equity Research Report &nbsp;·&nbsp; {sector}</div>
    <div class="cover-badge-row">
      <span class="rec-badge rec-{recommendation_class}">{recommendation}</span>
      <div class="cover-score-box"><div class="cover-score-num">{ai_score}</div><div class="cover-score-label">AI Score</div></div>
      <div class="cover-score-box"><div class="cover-score-num">{confidence}%</div><div class="cover-score-label">Confidence</div></div>
      <div class="cover-score-box"><div class="cover-score-num" style="font-size:13pt;padding-top:4px;">{risk_level}</div><div class="cover-score-label">Risk Level</div></div>
    </div>
    <div class="cover-meta">
      <div><div class="cover-meta-label">Exchange</div><div class="cover-meta-value">{exchange}</div></div>
      <div><div class="cover-meta-label">Currency</div><div class="cover-meta-value">{currency}</div></div>
      <div><div class="cover-meta-label">Report ID</div><div class="cover-meta-value" style="font-size:7pt;font-family:monospace;">{report_id}</div></div>
      <div><div class="cover-meta-label">Generated</div><div class="cover-meta-value">{generated_at}</div></div>
      <div><div class="cover-meta-label">Investment Horizon</div><div class="cover-meta-value">{horizon}</div></div>
      <div><div class="cover-meta-label">Industry</div><div class="cover-meta-value">{industry}</div></div>
    </div>
  </div>
  <div>
    <div style="font-size:7.5pt;color:#475569;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">Powered By</div>
    <div class="cover-tech-row">
      <span class="cover-tech-pill">Gemini 2.5 Flash</span>
      <span class="cover-tech-pill">LangGraph Agents</span>
      <span class="cover-tech-pill">Yahoo Finance</span>
      <span class="cover-tech-pill">10-Node AI Pipeline</span>
    </div>
    <div style="margin-top:20px;font-size:8pt;color:#475569;border-top:1px solid rgba(255,255,255,0.1);padding-top:14px;">
      This report was generated by an autonomous AI research pipeline. All data sourced from Yahoo Finance. For informational purposes only.
    </div>
  </div>
</div>
</div>

<!-- PAGE 2: EXECUTIVE SUMMARY -->
<div class="page">
<div class="section-header"><h2>Executive Summary</h2><span class="section-badge">Page 2 of 8</span></div>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;">
  <div class="metric-card blue"><div class="label">AI Score</div><div class="value">{ai_score}<span style="font-size:9pt;font-weight:500;color:#64748B;">/100</span></div><div class="sub">Weighted composite</div></div>
  <div class="metric-card green"><div class="label">Recommendation</div><div class="value" style="font-size:16pt;">{recommendation}</div><div class="sub">Based on 5 dimensions</div></div>
  <div class="metric-card purple"><div class="label">Confidence</div><div class="value">{confidence}%</div><div class="sub">Statistical certainty</div></div>
  <div class="metric-card amber"><div class="label">Risk Level</div><div class="value" style="font-size:13pt;">{risk_level}</div><div class="sub">Portfolio risk classification</div></div>
  <div class="metric-card teal"><div class="label">Investment Horizon</div><div class="value" style="font-size:11pt;padding-top:3px;">{horizon}</div><div class="sub">Recommended holding period</div></div>
  <div class="metric-card red"><div class="label">News Sentiment</div><div class="value">{score_sentiment}<span style="font-size:9pt;font-weight:500;color:#64748B;">/100</span></div><div class="sub">Media &amp; press coverage</div></div>
</div>
<div class="card"><h3 style="color:#3B82F6;">Investment Thesis</h3><p style="font-size:9.5pt;">{explanation}</p></div>
<div class="two-col">
  <div class="card" style="margin-bottom:0;"><h3 style="color:#10B981;">✅ Top Reasons to Invest</h3><ul class="reason-list">{top_reasons}</ul></div>
  <div class="card" style="margin-bottom:0;"><h3 style="color:#EF4444;">⚠ Key Risks</h3><ul class="reason-list">{major_risks}</ul></div>
</div>
<div class="page-footer"><strong>InvestIQ</strong><span>{ticker} &nbsp;·&nbsp; {generated_at} &nbsp;·&nbsp; Page 2 of 8</span><span>Investment Research Report</span></div>
</div>

<!-- PAGE 3: COMPANY OVERVIEW -->
<div class="page">
<div class="section-header"><h2>Company Overview</h2><span class="section-badge">Page 3 of 8</span></div>
<div class="card" style="margin-bottom:14px;"><h3>{name}</h3><p style="font-size:9.5pt;line-height:1.7;word-wrap:break-word;">{description}</p></div>
<h3 style="margin-bottom:10px;">Company Metadata</h3>
<table class="data-table">
  <tbody>
    <tr><td style="width:22%;font-weight:700;color:#475569;">Ticker</td><td>{ticker}</td><td style="width:22%;font-weight:700;color:#475569;">Sector</td><td>{sector}</td></tr>
    <tr><td style="font-weight:700;color:#475569;">Industry</td><td style="word-wrap:break-word;">{industry}</td><td style="font-weight:700;color:#475569;">Exchange</td><td>{exchange}</td></tr>
    <tr><td style="font-weight:700;color:#475569;">CEO</td><td>{ceo}</td><td style="font-weight:700;color:#475569;">Employees</td><td>{employees}</td></tr>
    <tr><td style="font-weight:700;color:#475569;">Country</td><td>{country}</td><td style="font-weight:700;color:#475569;">Currency</td><td>{currency}</td></tr>
    <tr><td style="font-weight:700;color:#475569;">Market Cap</td><td>{market_cap_fmt}</td><td style="font-weight:700;color:#475569;">Website</td><td style="word-wrap:break-word;overflow-wrap:anywhere;">{website}</td></tr>
  </tbody>
</table>
<h3 style="margin:14px 0 10px;">Report Metadata</h3>
<table class="data-table">
  <tbody>
    <tr><td style="width:22%;font-weight:700;color:#475569;">Report ID</td><td colspan="3" style="word-wrap:break-word;font-family:monospace;font-size:8pt;">{report_id}</td></tr>
    <tr><td style="font-weight:700;color:#475569;">Model</td><td>Gemini 2.5 Flash</td><td style="font-weight:700;color:#475569;">Data Source</td><td>Yahoo Finance</td></tr>
    <tr><td style="font-weight:700;color:#475569;">Pipeline</td><td>LangGraph 10-Node</td><td style="font-weight:700;color:#475569;">Generated</td><td>{generated_at}</td></tr>
  </tbody>
</table>
<div class="page-footer"><strong>InvestIQ</strong><span>{ticker} &nbsp;·&nbsp; {generated_at} &nbsp;·&nbsp; Page 3 of 8</span><span>Investment Research Report</span></div>
</div>

<!-- PAGE 4: FINANCIAL HIGHLIGHTS -->
<div class="page">
<div class="section-header"><h2>Financial Highlights</h2><span class="section-badge">Page 4 of 8</span></div>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;">
  <div class="metric-card blue"><div class="label">Financial Health</div><div class="value">{score_health}<span style="font-size:9pt;color:#64748B;">/100</span></div><div class="sub">Liquidity &amp; solvency</div></div>
  <div class="metric-card green"><div class="label">Growth Score</div><div class="value">{score_growth}<span style="font-size:9pt;color:#64748B;">/100</span></div><div class="sub">YoY revenue &amp; earnings</div></div>
  <div class="metric-card amber"><div class="label">Valuation Score</div><div class="value">{score_valuation}<span style="font-size:9pt;color:#64748B;">/100</span></div><div class="sub">P/E, P/B, EV/EBITDA</div></div>
  <div class="metric-card red"><div class="label">Risk Score</div><div class="value">{score_raw_risk}<span style="font-size:9pt;color:#64748B;">/100</span></div><div class="sub">Structural leverage risk</div></div>
  <div class="metric-card purple"><div class="label">ROE</div><div class="value">{roe_fmt}</div><div class="sub">Return on equity</div></div>
  <div class="metric-card teal"><div class="label">Operating Margin</div><div class="value">{op_margin_fmt}</div><div class="sub">Operating efficiency</div></div>
</div>
<h3 style="margin-bottom:10px;">Key Financial Ratios</h3>
<table class="data-table">
  <thead><tr><th>Metric</th><th>Value</th><th>Metric</th><th>Value</th></tr></thead>
  <tbody>
    <tr><td>Revenue Growth (YoY)</td><td class="num">{rev_growth_fmt}</td><td>Net Profit Margin</td><td class="num">{net_margin_fmt}</td></tr>
    <tr><td>Earnings Per Share (EPS)</td><td class="num">{eps_fmt}</td><td>Return on Equity (ROE)</td><td class="num">{roe_fmt}</td></tr>
    <tr><td>Debt-to-Equity Ratio</td><td class="num">{de_ratio_fmt}</td><td>Current Ratio</td><td class="num">{current_ratio_fmt}</td></tr>
    <tr><td>Operating Margin</td><td class="num">{op_margin_fmt}</td><td>Price-to-Earnings (P/E)</td><td class="num">{pe_fmt}</td></tr>
    <tr><td>Price-to-Book (P/B)</td><td class="num">{pb_fmt}</td><td>Price-to-Sales (P/S)</td><td class="num">{ps_fmt}</td></tr>
  </tbody>
</table>
<h3 style="margin:14px 0 10px;">Score Breakdown</h3>
<div class="score-row"><span class="name">Financial Health</span><div class="score-bar-bg"><div class="score-bar-fill" style="width:{score_health}%;background:#3B82F6;"></div></div><span class="num" style="color:#3B82F6;">{score_health}/100</span></div>
<div class="score-row"><span class="name">Growth</span><div class="score-bar-bg"><div class="score-bar-fill" style="width:{score_growth}%;background:#8B5CF6;"></div></div><span class="num" style="color:#8B5CF6;">{score_growth}/100</span></div>
<div class="score-row"><span class="name">Valuation</span><div class="score-bar-bg"><div class="score-bar-fill" style="width:{score_valuation}%;background:#F59E0B;"></div></div><span class="num" style="color:#F59E0B;">{score_valuation}/100</span></div>
<div class="score-row"><span class="name">Risk (lower=safer)</span><div class="score-bar-bg"><div class="score-bar-fill" style="width:{score_raw_risk}%;background:#EF4444;"></div></div><span class="num" style="color:#EF4444;">{score_raw_risk}/100</span></div>
<div class="score-row"><span class="name">News Sentiment</span><div class="score-bar-bg"><div class="score-bar-fill" style="width:{score_sentiment}%;background:#10B981;"></div></div><span class="num" style="color:#10B981;">{score_sentiment}/100</span></div>
<div class="page-footer"><strong>InvestIQ</strong><span>{ticker} &nbsp;·&nbsp; {generated_at} &nbsp;·&nbsp; Page 4 of 8</span><span>Investment Research Report</span></div>
</div>

<!-- PAGE 5: FINANCIAL CHARTS -->
<div class="page">
<div class="section-header"><h2>Financial Charts</h2><span class="section-badge">Page 5 of 8</span></div>
<div class="chart-wrap">
  <div class="chart-title">Revenue &amp; Net Income — 5 Year History</div>
  {svg_revenue_chart}
  <div class="chart-legend">
    <div class="chart-legend-item"><div class="chart-legend-dot" style="background:#3B82F6;"></div> Revenue</div>
    <div class="chart-legend-item"><div class="chart-legend-dot" style="background:#10B981;"></div> Net Income</div>
  </div>
</div>
<div class="chart-wrap">
  <div class="chart-title">Operating Cash Flow — 5 Year History</div>
  {svg_cashflow_chart}
  <div class="chart-legend">
    <div class="chart-legend-item"><div class="chart-legend-dot" style="background:#8B5CF6;"></div> Operating Cash Flow</div>
  </div>
</div>
<h3 style="margin:10px 0 8px;">Historical Financial Data</h3>
{financial_history_table}
<div class="page-footer"><strong>InvestIQ</strong><span>{ticker} &nbsp;·&nbsp; {generated_at} &nbsp;·&nbsp; Page 5 of 8</span><span>Investment Research Report</span></div>
</div>

<!-- PAGE 6: NEWS ANALYSIS -->
<div class="page">
<div class="section-header"><h2>News &amp; Sentiment Analysis</h2><span class="section-badge">Page 6 of 8</span></div>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px;">
  <div class="metric-card green"><div class="label">Sentiment Score</div><div class="value">{score_sentiment}<span style="font-size:9pt;color:#64748B;">/100</span></div><div class="sub">Overall news tone</div></div>
  <div class="metric-card blue"><div class="label">Positive Headlines</div><div class="value">{pos_news_count}</div><div class="sub">Favorable articles</div></div>
  <div class="metric-card red"><div class="label">Risk Headlines</div><div class="value">{neg_news_count}</div><div class="sub">Adverse articles</div></div>
</div>
<div class="two-col">
  <div><h3 style="color:#10B981;margin-bottom:10px;">✅ Positive Catalysts</h3>{pos_news_html}</div>
  <div><h3 style="color:#EF4444;margin-bottom:10px;">⚠ Risk Headlines</h3>{neg_news_html}</div>
</div>
{neutral_news_section}
<div class="page-footer"><strong>InvestIQ</strong><span>{ticker} &nbsp;·&nbsp; {generated_at} &nbsp;·&nbsp; Page 6 of 8</span><span>Investment Research Report</span></div>
</div>

<!-- PAGE 7: SWOT & DECISION -->
<div class="page">
<div class="section-header"><h2>SWOT Analysis &amp; Decision Breakdown</h2><span class="section-badge">Page 7 of 8</span></div>
<div class="swot-grid">
  <div class="swot-cell swot-s"><div class="swot-title">💪 Strengths</div><ul class="swot-list">{strengths}</ul></div>
  <div class="swot-cell swot-w"><div class="swot-title">⚡ Weaknesses</div><ul class="swot-list">{weaknesses}</ul></div>
  <div class="swot-cell swot-o"><div class="swot-title">🚀 Opportunities</div><ul class="swot-list">{opportunities}</ul></div>
  <div class="swot-cell swot-t"><div class="swot-title">🛡 Threats</div><ul class="swot-list">{threats}</ul></div>
</div>
<h3 style="margin-bottom:10px;">Decision Score Breakdown</h3>
<div class="score-row"><span class="name">Financial Health</span><div class="score-bar-bg"><div class="score-bar-fill" style="width:{score_health}%;background:#3B82F6;"></div></div><span class="num" style="color:#3B82F6;">{score_health}/100</span></div>
<div class="score-row"><span class="name">Growth</span><div class="score-bar-bg"><div class="score-bar-fill" style="width:{score_growth}%;background:#8B5CF6;"></div></div><span class="num" style="color:#8B5CF6;">{score_growth}/100</span></div>
<div class="score-row"><span class="name">Valuation</span><div class="score-bar-bg"><div class="score-bar-fill" style="width:{score_valuation}%;background:#F59E0B;"></div></div><span class="num" style="color:#F59E0B;">{score_valuation}/100</span></div>
<div class="score-row"><span class="name">Risk Safety</span><div class="score-bar-bg"><div class="score-bar-fill" style="width:{score_risk_safety}%;background:#EF4444;"></div></div><span class="num" style="color:#EF4444;">{score_risk_safety}/100</span></div>
<div class="score-row"><span class="name">News Sentiment</span><div class="score-bar-bg"><div class="score-bar-fill" style="width:{score_sentiment}%;background:#10B981;"></div></div><span class="num" style="color:#10B981;">{score_sentiment}/100</span></div>
<div class="two-col" style="margin-top:14px;">
  <div class="card" style="margin-bottom:0;"><h3 style="color:#10B981;">Reasons to Invest</h3><ul class="reason-list">{top_reasons_list}</ul></div>
  <div class="card" style="margin-bottom:0;"><h3 style="color:#EF4444;">Reasons to Be Careful</h3><ul class="reason-list">{major_risks_list}</ul></div>
</div>
<div class="page-footer"><strong>InvestIQ</strong><span>{ticker} &nbsp;·&nbsp; {generated_at} &nbsp;·&nbsp; Page 7 of 8</span><span>Investment Research Report</span></div>
</div>

<!-- PAGE 8: PEER COMPARISON + OUTLOOK + DISCLAIMER -->
<div class="page">
<div class="section-header"><h2>Peer Comparison &amp; Investment Outlook</h2><span class="section-badge">Page 8 of 8</span></div>
<h3 style="margin-bottom:10px;">Competitor Benchmarking</h3>
<table class="peer-table" style="margin-bottom:16px;">
  <thead><tr><th>Ticker</th><th>Company Name</th><th>Sector</th><th>Market Cap</th><th>Similarity</th><th>Rationale</th></tr></thead>
  <tbody>{peers_rows}</tbody>
</table>
<h3 style="margin-bottom:10px;">Investment Outlook (12–18 Months)</h3>
<div class="outlook-box">{future_outlook}</div>
<h3 style="margin-bottom:10px;">Legal Disclaimer</h3>
<div class="disclaimer">
  <strong>IMPORTANT DISCLAIMER:</strong> This report was generated by the InvestIQ research system using data from Yahoo Finance
  and analysis by Gemini 2.5 Flash via LangGraph. This report is for <strong>informational and educational purposes only</strong>
  and does not constitute investment advice, a recommendation to buy or sell any security, or an offer to purchase any financial instrument.
  Past performance does not guarantee future results. Always consult a qualified financial advisor before making investment decisions.
  The AI models used may produce errors or omissions. Market conditions can change rapidly. InvestIQ assumes no liability
  for investment decisions made based on this report. Report generated on {generated_at}.
</div>
<div class="page-footer" style="margin-top:20px;">
  <strong>InvestIQ &nbsp;·&nbsp; Investment Research Report</strong>
  <span>{ticker} &nbsp;·&nbsp; {generated_at} &nbsp;·&nbsp; Page 8 of 8</span>
  <span style="color:#94a3b8;">© InvestIQ. Not financial advice.</span>
</div>
</div>

</body>
</html>
"""


CHAT_FOLLOWUP_PROMPT = """
You are the InvestIQ Research Assistant.
You recently compiled a comprehensive investment report for {company_name} ({ticker}).
Below is the full report context and previous conversation log:

---
REPORT CONTEXT:
{report_context}
---
CONVERSATION LOG:
{message_history}
---

Answer the user's follow-up question.
Verify if the query matches any of these shortcut commands:
1. "Explain this chart" -> Focus on explaining the graphical metrics and financial charts of this stock in details.
2. "Compare revenue" -> Provide comparative revenue statistics with peers or historical yearly growth.
3. "Summarize" -> Compile a single concise, bulleted executive summary of the recommendation thesis.
4. "Explain simply" -> Explain the key positive and negative points in plain language suitable for a beginner retail investor.
5. "Risks only" -> Enumerate only the risk factors and structural weaknesses.
6. "Positive points only" -> Enumerate only the strengths and key opportunities.

If so, format your response specifically targeting the chosen shortcut command structure!
Ensure your response:
1. Directly references data points from the report.
2. Maintains a professional, objective financial tone.
3. Uses clean markdown tables or lists to organize figures.
"""

EXPLAIN_FINANCIAL_HEALTH_PROMPT = """
You are a Senior Financial Analyst.
Explain why {company_name} ({ticker}) received a score of {score}/100 for Financial Health.

Actual Metric Values:
- ROE: {roe}
- Debt to Equity: {debt_to_equity}
- Current Ratio: {current_ratio}
- Operating Margin: {operating_margin}

Requirements:
- Explain ONLY why these metrics resulted in a Financial Health score of {score}/100.
- Never discuss unrelated metrics (like P/E ratios, growth rates, or news).
- Provide concise, structured bullet points starting with a brief summary.
- The output should contain only the bullet points.
"""

EXPLAIN_GROWTH_PROMPT = """
You are a growth equity investor.
Explain why {company_name} ({ticker}) received a score of {score}/100 for Growth.

Actual Metric Values:
- Revenue Growth (YoY): {revenue_growth}
- Profit/Net Income Growth (YoY): {profit_growth}
- EPS Growth (YoY): {eps_growth}

Requirements:
- Explain ONLY why these metrics resulted in a Growth score of {score}/100.
- Never discuss unrelated metrics (like debt, current ratio, P/E ratios, or news).
- Provide concise, structured bullet points starting with a brief summary.
- The output should contain only the bullet points.
"""

EXPLAIN_VALUATION_PROMPT = """
You are a Valuation & Modeling Specialist.
Explain why {company_name} ({ticker}) received a score of {score}/100 for Valuation.

Actual Metric Values:
- P/E Ratio: {pe_ratio}
- P/B Ratio: {pb_ratio}
- P/S Ratio: {ps_ratio}
- EV to EBITDA: {ev_to_ebitda}

Requirements:
- Explain ONLY why these metrics resulted in a Valuation score of {score}/100.
- Never discuss unrelated metrics (like news, operational risks, or cash flow safety).
- Provide concise, structured bullet points starting with a brief summary.
- The output should contain only the bullet points.
"""

EXPLAIN_RISK_SAFETY_PROMPT = """
You are a Lead Financial Risk Officer.
Explain why {company_name} ({ticker}) received a score of {score}/100 for Risk Safety.

Actual Metric Values:
- Debt to Equity: {debt_to_equity}
- ROA: {roa}
- Beta: {beta}

Requirements:
- Explain ONLY why these metrics resulted in a Risk Safety score of {score}/100.
- Never discuss unrelated metrics (like P/E ratios, news, or growth rates).
- Provide concise, structured bullet points starting with a brief summary.
- The output should contain only the bullet points.
"""

EXPLAIN_NEWS_SENTIMENT_PROMPT = """
You are a Media Sentiment Intelligence Specialist.
Explain why {company_name} ({ticker}) received a score of {score}/100 for News Sentiment.

Recent News Context:
{news_context}

Requirements:
- Explain ONLY why this news context resulted in a News Sentiment score of {score}/100.
- Never discuss unrelated metrics (like P/E ratio, debt, or financial health).
- Provide concise, structured bullet points starting with a brief summary.
- The output should contain only the bullet points.
"""
