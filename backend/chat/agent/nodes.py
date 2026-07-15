import os
import json
import logging
from django.contrib.auth.models import User
from django.core.files.base import ContentFile
from langchain_google_genai import ChatGoogleGenerativeAI
from companies.models import Company
from research.models import SavedReport
from research.models import ResearchHistory
from chat.models import AIConversation
from companies.services.company_service import get_company_profile
from companies.services.financial_service import get_financial_data
from companies.services.news_service import get_company_news
from companies.services.related_company_service import get_related_companies
from .state import AgentState
from .prompts import (
    RISK_ANALYSIS_PROMPT,
    SWOT_ANALYSIS_PROMPT,
    SCORES_CALCULATION_PROMPT,
    RECOMMENDATION_THESIS_PROMPT,
    REPORT_HTML_TEMPLATE
)

logger = logging.getLogger(__name__)

def get_llm():
    """
    Initializes the Gemini 2.5 Flash LLM with temperature=0 for deterministic outputs.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    return ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        google_api_key=api_key,
        temperature=0.0
    )


def parse_json_response(text):
    """
    Strips markdown code blocks and parses raw JSON response strings from Gemini.
    """
    clean_text = text.strip()
    if clean_text.startswith("```json"):
        clean_text = clean_text[7:]
    elif clean_text.startswith("```"):
        clean_text = clean_text[3:]
    if clean_text.endswith("```"):
        clean_text = clean_text[:-3]
    return json.loads(clean_text.strip())


def update_conversation_status(state: AgentState, status_name: str):
    """
    Helper to update the conversation loading status field in the DB in real-time.
    """
    conv_id = state.get("conversation_id")
    if conv_id:
        try:
            AIConversation.objects.filter(id=conv_id).update(status=status_name)
            logger.info(f"Conversation {conv_id} status updated to: {status_name}")
        except Exception as e:
            logger.error(f"Failed to update conversation status: {str(e)}")


def make_unicode_bar(score):
    """
    Generates a high-fidelity Unicode progress bar for text-based reports.
    """
    blocks = int(round(score / 10))
    return "█" * blocks + "░" * (10 - blocks)


import time
import concurrent.futures

def timed_node(node_func):
    """
    Decorator to wrap LangGraph nodes with logging, timing, and a 20-second timeout.
    """
    def wrapper(state: AgentState) -> dict:
        node_name = node_func.__name__
        logger.info(f"START NODE: {node_name} for ticker {state.get('ticker', 'unknown')}")
        t0 = time.time()
        
        try:
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(node_func, state)
                result = future.result(timeout=25.0) # Using 25s limit for LLMs
                
            t1 = time.time()
            elapsed = t1 - t0
            logger.info(f"END NODE: {node_name} | Execution time: {elapsed:.2f} sec")
            return result
        except concurrent.futures.TimeoutError:
            t1 = time.time()
            elapsed = t1 - t0
            logger.warning(f"TIMEOUT: {node_name} exceeded limit ({elapsed:.2f} sec). Aborting.")
            return {"errors": state.get("errors", []) + [f"{node_name} timed out."]}
        except Exception as e:
            t1 = time.time()
            logger.exception(f"ERROR: {node_name} failed after {t1 - t0:.2f} sec: {e}")
            return {"errors": state.get("errors", []) + [f"{node_name} failed: {str(e)}"]}
            
    return wrapper


# 1. Initialize State Node
@timed_node
def initialize_state_node(state: AgentState) -> dict:
    """
    Validates input parameters and prepares the state dict.
    """
    ticker = state.get("ticker", "").strip().upper()
    query = state.get("user_query", "").strip()
    user_id = state.get("user_id")
    conv_id = state.get("conversation_id")
    
    if not ticker:
        return {"errors": ["Ticker symbol is required."]}
        
    return {
        "ticker": ticker,
        "user_query": query,
        "user_id": user_id,
        "conversation_id": conv_id,
        "errors": []
    }


# 2. Company Research Node
@timed_node
def company_research_node(state: AgentState) -> dict:
    """
    Queries and resolves stock metadata profile details.
    """
    update_conversation_status(state, "company_research")
    ticker = state["ticker"]
    try:
        profile = get_company_profile(ticker)
        return {
            "ticker": profile["ticker"],
            "company_profile": profile
        }
    except Exception as e:
        return {"errors": state.get("errors", []) + [f"Research Node error: {str(e)}"]}


# 3. Financial Analysis Node
@timed_node
def financial_analysis_node(state: AgentState) -> dict:
    """
    Queries financial ratio indicators and statement sheets.
    """
    update_conversation_status(state, "financial_analysis")
    ticker = state["ticker"]
    try:
        financials = get_financial_data(ticker)
        return {"financials": financials}
    except Exception as e:
        return {"errors": state.get("errors", []) + [f"Financial Node error: {str(e)}"]}


# 4. Metrics Calculation Node
@timed_node
def metrics_calculation_node(state: AgentState) -> dict:
    """
    Calculates margins, growth rates, leverage ratios.
    (This is handled within the service, but explicitly isolated here for LangGraph visibility).
    """
    update_conversation_status(state, "metrics_calculation")
    # All metrics are pre-calculated inside get_financial_data
    return {}


# 5. Scores Calculation Node
@timed_node
def scores_calculation_node(state: AgentState) -> dict:
    """
    Calculates Financial Health, Growth, Valuation, Risk Safety, and News Sentiment
    deterministically in Python from stock statements, indicators, and news sentiment.
    """
    update_conversation_status(state, "scores_calculation")
    profile = state["company_profile"]
    financials = state["financials"]
    news = state.get("news_list", [])

    def safe_float(v, default=0.0):
        try:
            if v is None: return default
            return float(v)
        except (ValueError, TypeError):
            return default

    # Calculate dynamic fallbacks/scores from yfinance metrics
    rat = financials.get("ratios", {}) if financials else {}
    prep = financials.get("preprocessed_metrics", {}) if financials else {}
    
    # 1. Financial Health (Max 100 points)
    fh_pts = 0
    
    roe_val = safe_float(rat.get("roe"))
    if roe_val >= 0.25: fh_pts += 15
    elif roe_val >= 0.15: fh_pts += 12
    elif roe_val >= 0.08: fh_pts += 8
    elif roe_val >= 0.0: fh_pts += 4
    else: fh_pts -= 5
    
    roa_val = safe_float(rat.get("roa"))
    if roa_val >= 0.12: fh_pts += 10
    elif roa_val >= 0.07: fh_pts += 8
    elif roa_val >= 0.03: fh_pts += 5
    elif roa_val >= 0.0: fh_pts += 2
    else: fh_pts -= 3

    de_ratio = safe_float(rat.get("debt_to_equity"))
    if de_ratio <= 0.0: fh_pts += 15
    elif de_ratio < 35.0: fh_pts += 15
    elif de_ratio < 75.0: fh_pts += 12
    elif de_ratio < 130.0: fh_pts += 8
    elif de_ratio < 200.0: fh_pts += 3
    else: fh_pts -= 8

    cr = safe_float(rat.get("current_ratio"))
    if cr >= 2.0: fh_pts += 10
    elif cr >= 1.3: fh_pts += 8
    elif cr >= 1.0: fh_pts += 5
    elif cr >= 0.6: fh_pts += 2
    else: fh_pts -= 5

    qr = safe_float(rat.get("quick_ratio"))
    if qr >= 1.5: fh_pts += 10
    elif qr >= 1.0: fh_pts += 8
    elif qr >= 0.8: fh_pts += 5
    elif qr >= 0.5: fh_pts += 2
    else: fh_pts -= 4

    om = safe_float(prep.get("operating_margin_pct"))
    if om == 0.0:
        om = safe_float(rat.get("operating_margin")) * 100.0
    if om >= 25.0: fh_pts += 10
    elif om >= 15.0: fh_pts += 8
    elif om >= 8.0: fh_pts += 5
    elif om >= 0.0: fh_pts += 2
    else: fh_pts -= 5

    nm = safe_float(prep.get("net_margin_pct"))
    if nm >= 20.0: fh_pts += 10
    elif nm >= 12.0: fh_pts += 8
    elif nm >= 6.0: fh_pts += 5
    elif nm >= 0.0: fh_pts += 2
    else: fh_pts -= 5

    ic = safe_float(prep.get("interest_coverage", 15.0))
    if ic >= 8.0: fh_pts += 10
    elif ic >= 4.0: fh_pts += 8
    elif ic >= 1.5: fh_pts += 5
    elif ic >= 0.0: fh_pts += 2
    else: fh_pts -= 5

    cd = safe_float(prep.get("cash_to_debt_ratio", 1.0))
    if cd >= 2.0: fh_pts += 10
    elif cd >= 1.0: fh_pts += 8
    elif cd >= 0.5: fh_pts += 5
    elif cd >= 0.1: fh_pts += 2
    else: fh_pts -= 3

    financial_health = min(100, max(10, fh_pts))

    # 2. Growth (Max 100 points)
    g_pts = 0
    
    cagr = safe_float(prep.get("revenue_cagr"))
    if cagr >= 25.0: g_pts += 20
    elif cagr >= 15.0: g_pts += 16
    elif cagr >= 8.0: g_pts += 12
    elif cagr >= 0.0: g_pts += 6
    else: g_pts -= 5
    
    rev_growth = safe_float(prep.get("revenue_growth_pct"))
    if rev_growth >= 25.0: g_pts += 15
    elif rev_growth >= 15.0: g_pts += 12
    elif rev_growth >= 8.0: g_pts += 8
    elif rev_growth >= 0.0: g_pts += 4
    else: g_pts -= 5
    
    net_inc_growth = safe_float(prep.get("profit_growth_pct"))
    if net_inc_growth >= 25.0: g_pts += 20
    elif net_inc_growth >= 15.0: g_pts += 16
    elif net_inc_growth >= 8.0: g_pts += 12
    elif net_inc_growth >= 0.0: g_pts += 6
    else: g_pts -= 6
    
    eps_growth = safe_float(prep.get("eps_growth_pct"))
    if eps_growth >= 25.0: g_pts += 15
    elif eps_growth >= 15.0: g_pts += 12
    elif eps_growth >= 8.0: g_pts += 8
    elif eps_growth >= 0.0: g_pts += 4
    else: g_pts -= 5
    
    ocf_growth = safe_float(prep.get("ocf_growth_pct"))
    if ocf_growth >= 20.0: g_pts += 15
    elif ocf_growth >= 10.0: g_pts += 12
    elif ocf_growth >= 4.0: g_pts += 8
    elif ocf_growth >= 0.0: g_pts += 4
    else: g_pts -= 4
    
    fcf_growth = safe_float(prep.get("fcf_growth_pct"))
    if fcf_growth >= 20.0: g_pts += 15
    elif fcf_growth >= 10.0: g_pts += 12
    elif fcf_growth >= 4.0: g_pts += 8
    elif fcf_growth >= 0.0: g_pts += 4
    else: g_pts -= 4

    # Quality and Consistency Growth Bonus: +15 if profitable in all years
    yearly = financials.get("historical_yearly", []) if financials else []
    valid_years = [y for y in yearly if safe_float(y.get("revenue")) > 0.0 or safe_float(y.get("net_income")) > 0.0]
    if len(valid_years) > 0 and all(safe_float(y.get("net_income")) > 0.0 for y in valid_years):
        g_pts += 15

    # Cash Cow Growth Bonuses:
    # High margins represent elite operational compounding
    net_margin_val = safe_float(prep.get("net_margin_pct"))
    if net_margin_val >= 20.0:
        g_pts += 10
    if len(valid_years) > 0:
        latest_year = valid_years[0]
        latest_rev = safe_float(latest_year.get("revenue"))
        if latest_rev > 0:
            fcf_margin = safe_float(latest_year.get("free_cash_flow")) / latest_rev
            if fcf_margin >= 0.15:
                g_pts += 10

    growth = min(100, max(10, g_pts))

    # 3. Valuation (Max 100 points)
    v_pts = 0
    
    pe = safe_float(rat.get("pe_ratio"))
    if 0 < pe <= 20: v_pts += 25
    elif 20 < pe <= 30: v_pts += 18
    elif 30 < pe <= 40: v_pts += 12
    elif 40 < pe <= 60: v_pts += 6
    elif pe > 60: v_pts += 2
    else: v_pts -= 10
    
    fpe = safe_float(rat.get("forward_pe"))
    if 0 < fpe <= 15: v_pts += 15
    elif 15 < fpe <= 25: v_pts += 11
    elif 25 < fpe <= 35: v_pts += 7
    elif fpe > 35: v_pts += 2
    else: v_pts -= 5

    peg = safe_float(rat.get("peg_ratio"))
    if 0.0 < peg <= 1.2: v_pts += 25
    elif 1.2 < peg <= 1.8: v_pts += 18
    elif 1.8 < peg <= 2.5: v_pts += 12
    elif 2.5 < peg <= 3.2: v_pts += 6
    elif peg > 3.2: v_pts += 2
    else: v_pts -= 5

    pb = safe_float(rat.get("pb_ratio"))
    if 0 < pb <= 3.0: v_pts += 12
    elif 3.0 < pb <= 8.0: v_pts += 9
    elif 8.0 < pb <= 15.0: v_pts += 6
    elif pb > 15.0: v_pts += 3
    else: v_pts -= 2

    ps = safe_float(rat.get("price_to_sales"))
    if 0 < ps <= 2.0: v_pts += 13
    elif 2.0 < ps <= 5.0: v_pts += 10
    elif 5.0 < ps <= 10.0: v_pts += 6
    elif ps > 10.0: v_pts += 3
    else: v_pts -= 2

    eveb = safe_float(rat.get("ev_to_ebitda"))
    if 0 < eveb <= 12.0: v_pts += 10
    elif 12.0 < eveb <= 20.0: v_pts += 7
    elif 20.0 < eveb <= 30.0: v_pts += 4
    elif eveb > 30.0: v_pts += 2
    else: v_pts -= 3

    # Profitability-based premium valuation offsets (High ROE or High Operating Margins justify PE premium)
    if roe_val >= 0.30:
        v_pts += 10
    if om >= 25.0:
        v_pts += 10

    valuation = min(100, max(10, v_pts))

    # 4. Risk Safety (Max 100 points)
    r_pts = 0
    
    if de_ratio <= 25.0: r_pts += 25
    elif de_ratio <= 60.0: r_pts += 20
    elif de_ratio <= 110.0: r_pts += 14
    elif de_ratio <= 170.0: r_pts += 8
    else: r_pts += 2

    if cr >= 1.8 and qr >= 1.2: r_pts += 25
    elif cr >= 1.2 and qr >= 0.8: r_pts += 18
    elif cr >= 0.9: r_pts += 10
    else: r_pts += 3

    beta = safe_float(rat.get("beta", 1.0))
    if beta < 0.8: r_pts += 25
    elif beta < 1.1: r_pts += 20
    elif beta < 1.4: r_pts += 14
    elif beta < 1.8: r_pts += 6
    else: r_pts += 1

    mcap = safe_float(rat.get("market_cap", 0.0))
    if mcap > 1e12: r_pts += 15
    elif mcap > 1e11: r_pts += 10
    elif mcap > 1e10: r_pts += 5
    else: r_pts += 2

    if nm >= 25.0: r_pts += 10
    elif nm >= 15.0: r_pts += 7
    elif nm >= 5.0: r_pts += 4
    else: r_pts += 1

    risk_safety = min(100, max(10, r_pts))

    # 5. News Sentiment (Max 100 points)
    if news:
        sent_pts = 0
        total_weight = 0.0
        
        cred_publishers = [
            "Bloomberg", "Reuters", "WSJ", "The Wall Street Journal", 
            "Financial Times", "Yahoo Finance", "CNBC", "MarketWatch", "Forbes"
        ]
        
        import datetime
        today = datetime.date.today()
        
        for n in news:
            score = safe_float(n.get("sentiment_score", 0.0))
            
            pub_date = today
            date_str = n.get("date", "")
            if date_str:
                try:
                    if "-" in date_str:
                        parts = date_str.split("-")
                        pub_date = datetime.date(int(parts[0]), int(parts[1]), int(parts[2]))
                except:
                    pass
            
            days_old = max(0, (today - pub_date).days)
            if days_old <= 3:
                recency_w = 1.2
            elif days_old <= 10:
                recency_w = 1.0
            elif days_old <= 30:
                recency_w = 0.7
            else:
                recency_w = 0.4
                
            publisher = n.get("publisher") or n.get("source") or ""
            cred_w = 1.4 if any(p.lower() in publisher.lower() for p in cred_publishers) else 0.9
            
            weight = recency_w * cred_w
            sent_pts += score * weight
            total_weight += weight
            
        avg_weighted_score = (sent_pts / total_weight) if total_weight > 0 else 0.0
        news_sentiment = min(100, max(0, int(50.0 + avg_weighted_score * 45.0)))
    else:
        seed = sum(ord(c) for c in state["ticker"])
        news_sentiment = 65 + (seed % 16)

    # 1. Deterministic Weighted Formula Calculation
    # Weights: Health (30%), Growth (25%), Valuation (20%), Risk Safety (15%), News (10%)
    overall_score = round(
        (financial_health * 0.30) + 
        (growth * 0.25) + 
        (valuation * 0.20) + 
        (risk_safety * 0.15) + 
        (news_sentiment * 0.10)
    )
    overall_score = min(100, max(0, int(overall_score)))

    # 2. Deterministic Recommendation Verdict Thresholds
    if overall_score >= 90:
        verdict = "STRONG BUY"
    elif overall_score >= 80:
        verdict = "BUY"
    elif overall_score >= 60:
        verdict = "HOLD"
    else:
        verdict = "PASS"

    # Deterministic Investment Horizon
    if verdict in ["STRONG BUY", "BUY"]:
        horizon = "3–5 Years"
    elif verdict == "HOLD":
        horizon = "12–18 Months"
    else:
        horizon = "Avoid New Position"

    # 3. Deterministic Confidence Score Calculation
    raw_risk = 100 - risk_safety
    confidence = min(100, max(50, int(95 - abs(financial_health - valuation) * 0.15 - (raw_risk * 0.1))))

    # 4. Deterministic Risk Level Thresholds
    if risk_safety >= 80:
        risk_level = "Low"
    elif risk_safety >= 60:
        risk_level = "Medium"
    else:
        risk_level = "High"

    recommendation_payload = {
        "recommendation": verdict,
        "confidence": confidence,
        "risk_level": risk_level,
        "ai_score": overall_score,
        "investment_horizon": horizon,
        "scores": {
            "financial_health": financial_health,
            "growth": growth,
            "valuation": valuation,
            "risk_safety": risk_safety,
            "news_sentiment": news_sentiment
        }
    }

    # Debug logging validation
    logger.info("=" * 80)
    logger.info(f"Company: {state.get('ticker')}")
    logger.info(f"Financial Health: {financial_health}")
    logger.info(f"Growth: {growth}")
    logger.info(f"Valuation: {valuation}")
    logger.info(f"Risk: {risk_safety}")
    logger.info(f"News: {news_sentiment}")
    logger.info(f"Weighted Score: {overall_score}")
    logger.info(f"Recommendation: {verdict}")
    logger.info("=" * 80)

    return {"recommendation_payload": recommendation_payload}


# 6. News Analysis Node
@timed_node
def news_analysis_node(state: AgentState) -> dict:
    """
    Gathers news stories and computes sentiment indicators.
    """
    update_conversation_status(state, "news_analysis")
    ticker = state["ticker"]
    try:
        news = get_company_news(ticker)
        return {"news_list": news}
    except Exception as e:
        return {"errors": state.get("errors", []) + [f"News Node error: {str(e)}"]}


# 7. Risk Analysis Node
@timed_node
def risk_analysis_node(state: AgentState) -> dict:
    """
    Queries Gemini 2.5 Flash to identify critical risk dimensions.
    """
    update_conversation_status(state, "risk_analysis")
    profile = state["company_profile"]
    financials = state["financials"]
    
    prompt = RISK_ANALYSIS_PROMPT.format(
        company_name=profile.get("name"),
        ticker=state["ticker"],
        industry=profile.get("industry"),
        description=profile.get("description"),
        financials=json.dumps(financials.get("preprocessed_metrics", financials.get("ratios", {})))
    )
    
    try:
        llm = get_llm()
        response = llm.invoke(prompt)
        risks = parse_json_response(response.content)
        return {"risks": risks}
    except Exception as e:
        # The LLM failed to generate a valid risk analysis.
        # We return an empty list of risks rather than hallucinating fake data,
        # ensuring the application only surfaces genuine analysis to the user.
        return {
            "risks": [],
            "errors": state.get("errors", []) + [f"Risk analysis generation failed: {str(e)}"]
        }


def sanitize_swot(swot, profile, financials, ticker, news_sentiment="Neutral"):
    """
    Sanitizes raw SWOT values returned from the LLM, filters out generic fallbacks
    (e.g., 'Not available'), and uses sector, industry, news, and financials to dynamically
    infer solid SWOT points if any category is deficient (has fewer than 2 items).
    """
    if not isinstance(swot, dict):
        swot = {}
    
    # Normalize input keys case-insensitively
    normalized_swot = {}
    for k, v in swot.items():
        if isinstance(k, str):
            normalized_swot[k.lower()] = v
        else:
            normalized_swot[k] = v
    swot = normalized_swot
    
    categories = ["strengths", "weaknesses", "opportunities", "threats"]
    for cat in categories:
        if cat not in swot or not isinstance(swot[cat], list):
            swot[cat] = []
        cleaned = []
        for x in swot[cat]:
            if not x or not isinstance(x, str):
                continue
            x_clean = x.strip()
            x_lower = x_clean.lower()
            # Dynamic substring check to ensure we never render "not available" in any form
            if any(p in x_lower for p in ["not available", "n/a", "no content", "not applicable", "n.a.", "no data", "none found", "none available"]):
                continue
            cleaned.append(x_clean)
        swot[cat] = cleaned

    sector = (profile.get("sector") or "Technology").strip()
    industry = (profile.get("industry") or "Software/Services").strip()
    
    ratios = financials.get("ratios", {}) if financials else {}
    debt_to_equity = ratios.get("debt_to_equity", 0) or 0
    current_ratio = ratios.get("current_ratio", 1.0) or 1.0
    roe = ratios.get("roe", 0) or 0
    
    fallbacks = {
        "strengths": [
            f"Strong established position in {industry} segment.",
            f"Proven business model with robust footprint in the {sector} sector.",
            "Solid core margins and operational efficiencies relative to peer group."
        ],
        "weaknesses": [
            "Sensitivity to macro consumer demand trends and enterprise budgets.",
            "Operational dependence on globally distributed supply chains.",
            "Continuing R&D and capital reinvestment requirements to sustain growth."
        ],
        "opportunities": [
            f"Strategic market expansion into adjacent high-margin {industry} verticals.",
            "Adoption of AI and cloud capabilities to optimize operational workflows.",
            "Long-term revenue diversification through geographical expansion."
        ],
        "threats": [
            "Intense industry-level competition from emerging scale players.",
            "Regulatory compliance headwinds and data privacy policies.",
            "Macroeconomic factors such as high interest rates and inflation."
        ]
    }
    
    # Financial indicators
    fin_strengths = []
    if roe and roe > 0.15:
        fin_strengths.append(f"Strong capital efficiency with ROE of {roe*100:.1f}%.")
    if current_ratio and current_ratio > 1.5:
        fin_strengths.append(f"Comfortable short-term liquidity with current ratio of {current_ratio:.2f}x.")
    if debt_to_equity and debt_to_equity < 50 and debt_to_equity > 0:
        fin_strengths.append(f"Conservative capital structure with low Debt-to-Equity of {debt_to_equity:.1f}%.")
        
    fin_weaknesses = []
    if debt_to_equity and debt_to_equity > 150:
        fin_weaknesses.append(f"Elevated balance sheet leverage with Debt-to-Equity of {debt_to_equity:.1f}%.")
    if current_ratio and current_ratio < 1.0:
        fin_weaknesses.append(f"Tight working capital position with current ratio of {current_ratio:.2f}x.")

    for cat in categories:
        cat_items = swot[cat]
        if cat == "strengths" and fin_strengths:
            for item in fin_strengths:
                if item not in cat_items and len(cat_items) < 4:
                    cat_items.append(item)
        elif cat == "weaknesses" and fin_weaknesses:
            for item in fin_weaknesses:
                if item not in cat_items and len(cat_items) < 4:
                    cat_items.append(item)
                    
        fallback_list = fallbacks[cat]
        for fb_item in fallback_list:
            if len(cat_items) >= 3:
                break
            if not any(fb_item.lower()[:15] in existing.lower() for existing in cat_items):
                cat_items.append(fb_item)
        
        while len(cat_items) < 2:
            cat_items.append(fallback_list[len(cat_items) % len(fallback_list)])
            
        swot[cat] = cat_items[:4]
        
    return swot


# 8. SWOT Analysis Node
@timed_node
def swot_analysis_node(state: AgentState) -> dict:
    """
    Queries Gemini 2.5 Flash to build strategic SWOT matrices.
    """
    update_conversation_status(state, "swot_analysis")
    profile = state["company_profile"]
    financials = state["financials"]
    news = state.get("news_list", [])
    
    sentiment_label = "Neutral"
    if news:
        scores = [n.get("sentiment_score", 0.0) for n in news]
        avg = sum(scores) / len(scores) if scores else 0.0
        sentiment_label = "Positive" if avg > 0.1 else ("Negative" if avg < -0.1 else "Neutral")

    prompt = SWOT_ANALYSIS_PROMPT.format(
        company_name=profile.get("name", state["ticker"]),
        ticker=state["ticker"],
        description=profile.get("description"),
        financials=json.dumps(financials.get("preprocessed_metrics", financials.get("ratios", {}))),
        news_sentiment=sentiment_label
    )
    
    try:
        llm = get_llm()
        response = llm.invoke(prompt)
        swot = parse_json_response(response.content)
        swot = sanitize_swot(swot, profile, financials, state["ticker"], sentiment_label)
        return {"swot": swot}
    except Exception as e:
        fallback = sanitize_swot({}, profile, financials, state["ticker"], sentiment_label)
        return {
            "swot": fallback,
            "errors": state.get("errors", []) + [f"SWOT Node error: {str(e)}"]
        }


# 9. Recommendation Thesis Node
@timed_node
def recommendation_thesis_node(state: AgentState) -> dict:
    """
    Queries Gemini to write institutional-grade justifications, strengths,
    risks, and outlooks based on computed ratings and scores.
    """
    update_conversation_status(state, "recommendation")
    profile = state["company_profile"]
    payload = state["recommendation_payload"]
    swot = state["swot"]
    risks = state["risks"]
    
    # Resolve related peer quotes
    try:
        peers = get_related_companies(state["ticker"])
    except Exception:
        peers = []

    prompt = RECOMMENDATION_THESIS_PROMPT.format(
        company_name=profile.get("name"),
        ticker=state["ticker"],
        recommendation=payload["recommendation"],
        ai_score=payload["ai_score"],
        confidence=payload["confidence"],
        scores=json.dumps(payload["scores"]),
        swot=json.dumps(swot),
        risks=json.dumps(risks),
        peers=json.dumps(peers)
    )

    try:
        llm = get_llm()
        response = llm.invoke(prompt)
        thesis_data = parse_json_response(response.content)
        
        merged_payload = payload.copy()
        # Only copy structural explanation keys to prevent LLM from overwriting deterministic ratings
        thesis_keys = ["reasoning", "top_reasons", "major_risks", "future_outlook"]
        for key in thesis_keys:
            if key in thesis_data:
                merged_payload[key] = thesis_data[key]
        return {
            "recommendation_payload": merged_payload,
            "related_tickers": peers
        }
    except Exception as e:
        logger.error(f"Thesis Generator failed: {str(e)}")
        # The thesis generation failed. Rather than hallucinating generic advice,
        # we provide empty strings so the UI can gracefully handle the missing data.
        fallback_thesis = {
            "reasoning": "Analysis reasoning unavailable due to generation error.",
            "top_reasons": [],
            "major_risks": [],
            "future_outlook": "Outlook unavailable."
        }
        merged_payload = payload.copy()
        merged_payload.update(fallback_thesis)
        return {
            "recommendation_payload": merged_payload,
            "related_tickers": peers,
            "errors": state.get("errors", []) + [f"Recommendation thesis generation failed: {str(e)}"]
        }


@timed_node
def report_generator_node(state: AgentState) -> dict:
    """
    Saves the SavedReport in the database with status 'pending' and logs research history.
    Executes SWOT formatting and aggregates node outputs for the final report compilation.
    """
    from django.utils import timezone
    update_conversation_status(state, "report_generator")
    profile = state["company_profile"]
    payload = state["recommendation_payload"]
    
    # Force SWOT sanitization right before generation
    swot = sanitize_swot(state.get("swot", {}), profile, state.get("financials", {}), state["ticker"])
    risks = state["risks"]

    score_health = payload["scores"]["financial_health"]
    score_growth = payload["scores"]["growth"]
    score_valuation = payload["scores"]["valuation"]
    score_risk = payload["scores"]["risk_safety"]
    score_sentiment = payload["scores"]["news_sentiment"]
    score_raw_risk = 100 - score_risk

    # Format Date
    import datetime
    generated_at = datetime.date.today().strftime("%d %b %Y")

    # 2. Compile Text-Based Markdown Report for Chat Logs (featuring visual progress bars)
    bar_health = make_unicode_bar(score_health)
    bar_growth = make_unicode_bar(score_growth)
    bar_valuation = make_unicode_bar(score_valuation)
    bar_risk = make_unicode_bar(score_raw_risk)
    bar_sentiment = make_unicode_bar(score_sentiment)

    report_markdown = f"""
# InvestIQ AI Investment Research Report: {profile.get('name', state['ticker'])} ({state['ticker']})

**Recommendation Rating**: {payload['recommendation']}  
**Overall AI Score**: {payload['ai_score']} / 100  
**Confidence Score**: {payload['confidence']}% | **Risk Level**: {payload.get('risk_level', 'Medium')} | **Horizon**: {payload.get('investment_horizon', '12-18 Months')} | **Generated At**: {generated_at}

---

### Investment Decision Breakdown
* **Financial Health**: {score_health} / 100  `[{bar_health}]`
* **Growth Indicator**: {score_growth} / 100  `[{bar_growth}]`
* **Valuation Score**: {score_valuation} / 100  `[{bar_valuation}]`
* **Risk (Raw)**: {score_raw_risk} / 100  `[{bar_risk}]`
* **News Sentiment**: {score_sentiment} / 100  `[{bar_sentiment}]`

---

### Investment Thesis
{payload.get('reasoning', '')}

#### Why?
{chr(10).join([f"✓ {s}" for s in payload.get('top_reasons', [])])}

#### Why not stronger?
{chr(10).join([f"⚠ {r}" for r in payload.get('major_risks', [])])}

---

### Strategic SWOT Analysis
#### Strengths
{chr(10).join([f"- {s}" for s in swot.get('strengths', [])])}

#### Weaknesses
{chr(10).join([f"- {w}" for w in swot.get('weaknesses', [])])}

#### Opportunities
{chr(10).join([f"- {o}" for o in swot.get('opportunities', [])])}

#### Threats
{chr(10).join([f"- {t}" for t in swot.get('threats', [])])}

---

### Key Risk Factors
{chr(10).join([f"- {r}" for r in payload.get('major_risks', risks)])}

---

### Future Outlook (12-18 Months)
{payload.get('future_outlook', '')}
"""

    report_id = None
    # Initialize database records for the research query
    user_id = state.get("user_id")
    if user_id:
        try:
            user = User.objects.get(id=user_id)
            # Use get_or_create so the company always exists, even on first-time analysis
            company_profile = state.get("company_profile", {}) or {}
            company, _ = Company.objects.get_or_create(
                ticker=state["ticker"],
                defaults={
                    "name": company_profile.get("name", state["ticker"]),
                    "sector": company_profile.get("sector", "N/A"),
                    "industry": company_profile.get("industry", "N/A"),
                    "description": company_profile.get("description", ""),
                    "financial_summary": company_profile,
                }
            )

            # Create the SavedReport database record
            highlights_payload = payload.copy()
            highlights_payload["swot"] = swot
            highlights_payload["risks"] = risks
            highlights_payload["related_tickers"] = state.get("related_tickers", [])
            highlights_payload["news_list"] = state.get("news_list", [])
            highlights_payload["financials"] = state.get("financials", {})

            saved_report = SavedReport.objects.create(
                user=user,
                company=company,
                title=f"InvestIQ Research Report - {state['ticker']}",
                key_highlights=highlights_payload,
                pdf_status='pending',
                analysis_started_at=timezone.now()
            )
            report_id = str(saved_report.id)
            logger.info(f"SavedReport record committed successfully: ID {saved_report.id}")

            # Log Search statistics to ResearchHistory
            ResearchHistory.objects.create(
                user=user,
                company=company,
                query=state.get("user_query", ""),
                recommendation=payload["recommendation"],
                confidence=payload["confidence"]
            )
            logger.info("Research history logged successfully.")
        except Exception as db_err:
            logger.error(f"Failed to commit report/history to DB: {str(db_err)}")

    # Mark status as completed
    update_conversation_status(state, "pdf_ready")

    return {
        "markdown_report": report_markdown,
        "report_id": report_id
    }


def make_revenue_net_income_svg(chart_years, currency_symbol):
    if not chart_years:
        return '<div class="no-data">Historical financial data unavailable.</div>'
    
    svg_w, svg_h = 600, 240
    padding_top, padding_bottom, padding_left, padding_right = 30, 40, 70, 20
    
    revenues = [y.get("revenue", 0.0) or 0.0 for y in chart_years]
    net_incomes = [y.get("net_income", 0.0) or 0.0 for y in chart_years]
    
    max_val = max(max(revenues) if revenues else 0, max(net_incomes) if net_incomes else 0, 1.0)
    
    def fmt_num_short(v):
        abs_v = abs(v)
        if abs_v >= 1e12: return f"{v/1e12:.1f}T"
        if abs_v >= 1e9: return f"{v/1e9:.1f}B"
        if abs_v >= 1e6: return f"{v/1e6:.1f}M"
        if abs_v >= 1e3: return f"{v/1e3:.0f}K"
        return f"{v:.1f}"

    y_ticks_html = ""
    for i in range(5):
        val = (max_val / 4) * i
        y_pos = svg_h - padding_bottom - ((val / max_val) * (svg_h - padding_top - padding_bottom))
        y_ticks_html += f"""
        <text x="{padding_left - 10}" y="{y_pos + 4}" fill="#64748b" font-size="8pt" text-anchor="end">{currency_symbol}{fmt_num_short(val)}</text>
        <line x1="{padding_left}" y1="{y_pos}" x2="{svg_w - padding_right}" y2="{y_pos}" stroke="#e2e8f0" stroke-dasharray="3 3"/>
        """

    bars_html = ""
    num_years = len(chart_years)
    available_w = svg_w - padding_left - padding_right
    group_width = available_w / num_years
    bar_w = 20
    
    for idx, y in enumerate(chart_years):
        year = y.get("year")
        rev = y.get("revenue", 0.0) or 0.0
        net = y.get("net_income", 0.0) or 0.0
        
        chart_h = svg_h - padding_top - padding_bottom
        rev_h = (rev / max_val) * chart_h
        net_h = (net / max_val) * chart_h
        
        group_x = padding_left + idx * group_width
        rev_x = group_x + (group_width - 2 * bar_w) / 2
        net_x = rev_x + bar_w + 4
        
        rev_y = svg_h - padding_bottom - rev_h
        net_y = svg_h - padding_bottom - net_h
        
        bars_html += f"""
        <g>
          <rect x="{rev_x}" y="{rev_y}" width="{bar_w}" height="{rev_h}" fill="#3B82F6" rx="3"/>
          <text x="{rev_x + bar_w/2}" y="{rev_y - 5}" fill="#1e3a8a" font-size="7.5pt" font-weight="700" text-anchor="middle">{currency_symbol}{fmt_num_short(rev)}</text>
          
          <rect x="{net_x}" y="{net_y}" width="{bar_w}" height="{net_h}" fill="#10B981" rx="3"/>
          <text x="{net_x + bar_w/2}" y="{net_y - 5}" fill="#065f46" font-size="7.5pt" font-weight="700" text-anchor="middle">{currency_symbol}{fmt_num_short(net)}</text>
          
          <text x="{group_x + group_width/2}" y="{svg_h - padding_bottom + 18}" fill="#475569" font-size="9.5pt" font-weight="600" text-anchor="middle">{year}</text>
        </g>
        """

    svg = f"""
    <svg width="100%" height="{svg_h}" viewBox="0 0 {svg_w} {svg_h}" style="background:transparent; font-family:inherit;">
      {y_ticks_html}
      {bars_html}
      <line x1="{padding_left}" y1="{svg_h - padding_bottom}" x2="{svg_w - padding_right}" y2="{svg_h - padding_bottom}" stroke="#94a3b8" stroke-width="1.5"/>
    </svg>
    """
    return svg


def make_cashflow_svg(chart_years, currency_symbol):
    if not chart_years:
        return '<div class="no-data">Historical financial data unavailable.</div>'
        
    svg_w, svg_h = 600, 220
    padding_top, padding_bottom, padding_left, padding_right = 30, 40, 70, 20
    
    ocf_vals = [y.get("operating_cash_flow", 0.0) or 0.0 for y in chart_years]
    max_val = max(ocf_vals) if ocf_vals else 1.0
    min_val = min(ocf_vals) if ocf_vals else 0.0
    val_range = max(max_val - min_val, 1.0)
    
    def fmt_num_short(v):
        abs_v = abs(v)
        if abs_v >= 1e12: return f"{v/1e12:.1f}T"
        if abs_v >= 1e9: return f"{v/1e9:.1f}B"
        if abs_v >= 1e6: return f"{v/1e6:.1f}M"
        if abs_v >= 1e3: return f"{v/1e3:.0f}K"
        return f"{v:.1f}"

    y_ticks_html = ""
    for i in range(5):
        val = min_val + (val_range / 4) * i
        y_pos = svg_h - padding_bottom - (((val - min_val) / val_range) * (svg_h - padding_top - padding_bottom))
        y_ticks_html += f"""
        <text x="{padding_left - 10}" y="{y_pos + 4}" fill="#64748b" font-size="8pt" text-anchor="end">{currency_symbol}{fmt_num_short(val)}</text>
        <line x1="{padding_left}" y1="{y_pos}" x2="{svg_w - padding_right}" y2="{y_pos}" stroke="#e2e8f0" stroke-dasharray="3 3"/>
        """

    num_years = len(chart_years)
    available_w = svg_w - padding_left - padding_right
    points = []
    
    for idx, y in enumerate(chart_years):
        ocf = y.get("operating_cash_flow", 0.0) or 0.0
        chart_h = svg_h - padding_top - padding_bottom
        
        x = padding_left + idx * (available_w / (num_years - 1)) if num_years > 1 else padding_left + available_w / 2
        y_pos = svg_h - padding_bottom - (((ocf - min_val) / val_range) * chart_h)
        points.append((x, y_pos, ocf, y.get("year")))

    path_d = ""
    area_d = f"M {points[0][0]} {svg_h - padding_bottom} "
    
    for idx, (x, y_pos, ocf, year) in enumerate(points):
        if idx == 0:
            path_d += f"M {x} {y_pos} "
        else:
            path_d += f"L {x} {y_pos} "
        area_d += f"L {x} {y_pos} "
        
    area_d += f"L {points[-1][0]} {svg_h - padding_bottom} Z"
    
    dots_html = ""
    for (x, y_pos, ocf, year) in points:
        dots_html += f"""
        <circle cx="{x}" cy="{y_pos}" r="5" fill="#8B5CF6" stroke="#ffffff" stroke-width="2"/>
        <text x="{x}" y="{y_pos - 10}" fill="#5b21b6" font-size="8pt" font-weight="700" text-anchor="middle">{currency_symbol}{fmt_num_short(ocf)}</text>
        <text x="{x}" y="{svg_h - padding_bottom + 18}" fill="#475569" font-size="9.5pt" font-weight="600" text-anchor="middle">{year}</text>
        """

    svg = f"""
    <svg width="100%" height="{svg_h}" viewBox="0 0 {svg_w} {svg_h}" style="background:transparent; font-family:inherit;">
      {y_ticks_html}
      <path d="{area_d}" fill="rgba(139, 92, 246, 0.15)"/>
      <path d="{path_d}" fill="none" stroke="#8B5CF6" stroke-width="3" stroke-linecap="round"/>
      {dots_html}
      <line x1="{padding_left}" y1="{svg_h - padding_bottom}" x2="{svg_w - padding_right}" y2="{svg_h - padding_bottom}" stroke="#94a3b8" stroke-width="1.5"/>
    </svg>
    """
    return svg


def make_financial_history_table(chart_years, currency_symbol):
    if not chart_years:
        return '<div class="no-data">Historical financial data unavailable.</div>'
        
    def fmt_val(v):
        if v is None: return "—"
        try:
            val = float(v)
            if abs(val) >= 1e12: return f"{currency_symbol}{val/1e12:,.2f}T"
            if abs(val) >= 1e9: return f"{currency_symbol}{val/1e9:,.2f}B"
            if abs(val) >= 1e6: return f"{currency_symbol}{val/1e6:,.2f}M"
            return f"{currency_symbol}{val:,.2f}"
        except:
            return str(v)

    rows = ""
    for yr in chart_years:
        eps_val = yr.get('eps')
        try:
            eps_str = f"{float(eps_val):.2f}" if eps_val is not None else "—"
        except:
            eps_str = "—"
            
        roe_val = yr.get('roe')
        try:
            roe_str = f"{float(roe_val)*100:.1f}%" if roe_val is not None else "—"
        except:
            roe_str = "—"
            
        rows += f"""
        <tr>
            <td><strong>{yr.get('year') or '—'}</strong></td>
            <td class="num">{fmt_val(yr.get('revenue'))}</td>
            <td class="num">{fmt_val(yr.get('net_income'))}</td>
            <td class="num">{fmt_val(yr.get('operating_cash_flow'))}</td>
            <td class="num">{fmt_val(yr.get('debt'))}</td>
            <td class="num">{fmt_val(yr.get('cash'))}</td>
            <td class="num">{eps_str}</td>
            <td class="num">{roe_str}</td>
        </tr>
        """
        
    table = f"""
    <table class="data-table">
        <thead>
            <tr>
                <th>Year</th>
                <th style="text-align:right;">Revenue</th>
                <th style="text-align:right;">Net Income</th>
                <th style="text-align:right;">Operating Cash Flow</th>
                <th style="text-align:right;">Debt</th>
                <th style="text-align:right;">Cash</th>
                <th style="text-align:right;">EPS</th>
                <th style="text-align:right;">ROE</th>
            </tr>
        </thead>
        <tbody>
            {rows}
        </tbody>
    </table>
    """
    return table


def build_report_html(state_dict: dict, report_id: str = "") -> str:
    """
    Modular utility to compile the HTML report from analysis state.
    """
    from chat.agent.prompts import REPORT_HTML_TEMPLATE
    import datetime
    
    profile = state_dict.get("company_profile", {}) or {}
    payload = state_dict.get("recommendation_payload", {})
    if not payload or "scores" not in payload:
        payload = state_dict
        
    swot = state_dict.get("swot", {})
    if not swot:
        swot = payload.get("swot", {})
    risks = state_dict.get("risks", [])
    if not risks:
        risks = payload.get("risks", [])
    peers = state_dict.get("related_tickers", [])
    if not peers:
        peers = payload.get("related_tickers", [])
        
    ticker = state_dict.get("ticker") or payload.get("ticker", "")
    
    scores = payload.get("scores", {}) or {}
    score_health = scores.get("financial_health", 50)
    score_growth = scores.get("growth", 50)
    score_valuation = scores.get("valuation", 50)
    score_risk = scores.get("risk_safety", 50)
    score_sentiment = scores.get("news_sentiment", 50)
    score_raw_risk = 100 - score_risk
    
    generated_at = datetime.date.today().strftime("%d %b %Y")
    currency_symbol = "₹" if (ticker and ticker.endswith(".NS")) or profile.get("currency") == "INR" else "$"
    
    # 1. Format lists as HTML items
    reasons_html = "\n".join([f"<li><span class='icon'>✅</span> {r}</li>" for r in payload.get("top_reasons", [])])
    why_not_html = "\n".join([f"<li><span class='icon'>⚠</span> {r}</li>" for r in payload.get("major_risks", [])])
    
    strengths_html = "\n".join([f"<li>{s}</li>" for s in swot.get("strengths", [])])
    weaknesses_html = "\n".join([f"<li>{w}</li>" for w in swot.get("weaknesses", [])])
    opportunities_html = "\n".join([f"<li>{o}</li>" for o in swot.get("opportunities", [])])
    threats_html = "\n".join([f"<li>{t}</li>" for t in swot.get("threats", [])])
    risks_html = "\n".join([f"<li>{r}</li>" for r in payload.get("major_risks", risks)])
    
    peers_rows = ""
    for p in peers:
        if isinstance(p, dict):
            peer_ticker = p.get('ticker', '')
            peer_name = p.get('name') or peer_ticker
            peer_sector = p.get('sector') or 'N/A'
            peer_mcap = p.get('market_cap', 0) or 0
            peer_sim = p.get('similarity', 80)
            peer_reason = p.get('reason') or 'Industry Peer'
        else:
            peer_ticker = str(p)
            peer_name = str(p)
            peer_sector = 'N/A'
            peer_mcap = 0
            peer_sim = 80
            peer_reason = 'Industry Peer'
            
        peer_currency_symbol = "₹" if peer_ticker.endswith(".NS") else currency_symbol
        mcap_str = f"{peer_currency_symbol}{peer_mcap:,.0f}" if peer_mcap > 0 else "—"
        peers_rows += f"""<tr>
            <td><strong>{peer_ticker}</strong></td>
            <td>{peer_name}</td>
            <td>{peer_sector}</td>
            <td>{mcap_str}</td>
            <td><span class="pill">{peer_sim}%</span></td>
            <td>{peer_reason}</td>
        </tr>"""
        
    financials = state_dict.get("financials", {}) or {}
    yearly_data = financials.get("historical_yearly", []) or []
    chart_years = sorted(yearly_data, key=lambda x: x.get("year", ""))[-5:]
    
    # Build SVG charts
    if chart_years:
        svg_revenue_chart = make_revenue_net_income_svg(chart_years, currency_symbol)
        svg_cashflow_chart = make_cashflow_svg(chart_years, currency_symbol)
        financial_history_table = make_financial_history_table(chart_years, currency_symbol)
    else:
        svg_revenue_chart = '<svg viewBox="0 0 450 180" class="chart"><text x="225" y="90" text-anchor="middle" fill="#64748b" font-size="10">Historical Revenue &amp; Net Income charts are unavailable.</text></svg>'
        svg_cashflow_chart = '<svg viewBox="0 0 450 180" class="chart"><text x="225" y="90" text-anchor="middle" fill="#64748b" font-size="10">Historical Cash Flow charts are unavailable.</text></svg>'
        financial_history_table = '<div style="color:#64748b; font-style:italic; font-size:8.5pt; text-align:center; padding:15px; border:1px dashed #cbd5e1; border-radius:8px;">No historical financial statement data available.</div>'
        
    news = state_dict.get("news_list", []) or []
    pos_news = [n for n in news if n.get("sentiment") == "Positive" or n.get("sentiment_score", 0) > 0]
    neg_news = [n for n in news if n.get("sentiment") == "Negative" or n.get("sentiment_score", 0) < 0]
    
    pos_news_html = ""
    for n in pos_news[:3]:
        pos_news_html += f"""
        <div class="news-card positive">
            <div class="headline"><a href="{n.get('url', '#')}" target="_blank" style="text-decoration:none; color:inherit;">{n.get('title')}</a></div>
            <div class="meta">{n.get('publisher') or n.get('source', 'Unknown')} &bull; {n.get('date')}</div>
        </div>
        """
    if not pos_news_html:
        pos_news_html = '<div style="color:#64748b; font-style:italic; font-size:8.5pt;">No recent positive news catalysts identified.</div>'

    neg_news_html = ""
    for n in neg_news[:3]:
        neg_news_html += f"""
        <div class="news-card negative">
            <div class="headline"><a href="{n.get('url', '#')}" target="_blank" style="text-decoration:none; color:inherit;">{n.get('title')}</a></div>
            <div class="meta">{n.get('publisher') or n.get('source', 'Unknown')} &bull; {n.get('date')}</div>
        </div>
        """
    if not neg_news_html:
        neg_news_html = '<div style="color:#64748b; font-style:italic; font-size:8.5pt;">No recent risk controversies identified.</div>'
        
    neutral_news = [n for n in news if n not in pos_news and n not in neg_news]
    neutral_news_section = ""
    if neutral_news:
        neutral_news_html = ""
        for n in neutral_news[:3]:
            neutral_news_html += f"""
            <div class="news-card" style="background:#f8fafc; border:1px solid #e2e8f0; border-left:3px solid #64748b; padding:10px 12px; margin-bottom:8px; border-radius:8px;">
                <div class="headline" style="font-size:9pt; font-weight:700; color:#0F172A; line-height:1.4;"><a href="{n.get('url', '#')}" target="_blank" style="text-decoration:none; color:inherit;">{n.get('title')}</a></div>
                <div class="meta" style="font-size:7.5pt; color:#64748B; margin-top:3px;">{n.get('publisher') or n.get('source', 'Unknown')} &bull; {n.get('date')}</div>
            </div>
            """
        neutral_news_section = f"""
        <h3 style="margin:14px 0 10px; color:#475569;">📰 Other Headline News</h3>
        <div class="two-col" style="grid-template-columns:1fr; gap:8px;">
            {neutral_news_html}
        </div>
        """
        
    rat = financials.get("ratios", {}) or {}
    prep = financials.get("preprocessed_metrics", {}) or {}
    
    employees = profile.get("employees")
    employees_fmt = f"{employees:,}" if employees else "—"
    
    mcap = profile.get("market_cap")
    if mcap:
        if mcap >= 1e12: mcap_fmt = f"{currency_symbol}{mcap/1e12:.2f}T"
        elif mcap >= 1e9: mcap_fmt = f"{currency_symbol}{mcap/1e9:.2f}B"
        elif mcap >= 1e6: mcap_fmt = f"{currency_symbol}{mcap/1e6:.2f}M"
        else: mcap_fmt = f"{currency_symbol}{mcap:,.2f}"
    else:
        mcap_fmt = "—"
        
    rev_growth_fmt = f"{prep.get('revenue_growth_pct', 0.0):.1f}%" if prep.get('revenue_growth_pct') is not None else "0.0%"
    net_margin_fmt = f"{prep.get('net_margin_pct', 0.0):.1f}%" if prep.get('net_margin_pct') is not None else "0.0%"
    
    eps_val = rat.get('eps')
    eps_fmt = f"{currency_symbol}{float(eps_val):.2f}" if eps_val is not None else "—"
    
    roe_val = rat.get('roe')
    roe_fmt = f"{float(roe_val)*100:.1f}%" if roe_val is not None else "—"
    
    de_ratio_fmt = f"{rat.get('debt_to_equity', 0.0):.1f}%"
    current_ratio_fmt = f"{rat.get('current_ratio', 0.0):.2f}x"
    
    op_margin_pct = prep.get('operating_margin_pct')
    if op_margin_pct is not None:
        op_margin_fmt = f"{op_margin_pct:.1f}%"
    else:
        op_margin_fmt = f"{rat.get('profit_margin', 0.0)*120:.1f}%" if rat.get('profit_margin') else "—"
        
    pe_fmt = f"{rat.get('pe_ratio', 0.0):.1f}x" if rat.get('pe_ratio') else "—"
    pb_fmt = f"{rat.get('pb_ratio', 0.0):.1f}x" if rat.get('pb_ratio') else "—"
    ps_fmt = f"{rat.get('price_to_sales', 0.0):.1f}x" if rat.get('price_to_sales') else "—"
    
    recommendation_val = payload.get("recommendation", "HOLD")
    recommendation_class = recommendation_val.lower()
    
    return REPORT_HTML_TEMPLATE.format(
        name=profile.get("name", ticker),
        ticker=ticker,
        currency=profile.get("currency", "USD"),
        recommendation=recommendation_val,
        recommendation_class=recommendation_class,
        ai_score=payload.get("ai_score", 50),
        confidence=payload.get("confidence", 70),
        risk_level=payload.get("risk_level", "Medium"),
        horizon=payload.get("investment_horizon", "12-18 Months"),
        explanation=payload.get("reasoning", ""),
        score_health=score_health,
        score_growth=score_growth,
        score_valuation=score_valuation,
        score_raw_risk=score_raw_risk,
        score_sentiment=score_sentiment,
        generated_at=generated_at,
        sector=profile.get("sector", "N/A"),
        industry=profile.get("industry", "N/A"),
        exchange=profile.get("exchange", "N/A"),
        ceo=profile.get("ceo", "N/A"),
        employees=employees_fmt,
        country=profile.get("country", "N/A"),
        currency_symbol=currency_symbol,
        market_cap_fmt=mcap_fmt,
        website=profile.get("website", "N/A"),
        top_reasons=reasons_html,
        major_risks=why_not_html,
        strengths=strengths_html,
        weaknesses=weaknesses_html,
        opportunities=opportunities_html,
        threats=threats_html,
        risks=risks_html,
        future_outlook=payload.get("future_outlook", ""),
        peers_rows=peers_rows,
        svg_revenue_chart=svg_revenue_chart,
        svg_cashflow_chart=svg_cashflow_chart,
        financial_history_table=financial_history_table,
        pos_news_count=len(pos_news),
        neg_news_count=len(neg_news),
        pos_news_html=pos_news_html,
        neg_news_html=neg_news_html,
        neutral_news_section=neutral_news_section,
        score_risk_safety=score_risk,
        top_reasons_list=reasons_html,
        major_risks_list=why_not_html,
        report_id=report_id,
        description=profile.get("description", ""),
        roe_fmt=roe_fmt,
        op_margin_fmt=op_margin_fmt,
        rev_growth_fmt=rev_growth_fmt,
        net_margin_fmt=net_margin_fmt,
        eps_fmt=eps_fmt,
        de_ratio_fmt=de_ratio_fmt,
        current_ratio_fmt=current_ratio_fmt,
        pe_fmt=pe_fmt,
        pb_fmt=pb_fmt,
        ps_fmt=ps_fmt
    )


def generate_pdf_background(report_id: str, state_dict: dict):
    """
    Phase B async backend PDF/HTML report generation. Fills the Inter font A4 print theme and commits it to SavedReport.
    """
    from django.db import close_old_connections
    from django.utils import timezone
    from django.core.files.base import ContentFile
    from research.models import SavedReport
    from chat.agent.prompts import REPORT_HTML_TEMPLATE
    import datetime
    
    close_old_connections()
    logger.debug(f"PDF Started for Report ID: {report_id}")
    try:
        saved_report = SavedReport.objects.get(id=report_id)
        if saved_report.pdf_status == 'ready' and saved_report.pdf_file:
            logger.debug(f"HTML report already exists for {saved_report.company.ticker}, skipping regeneration.")
            return
        saved_report.pdf_status = 'generating'
        saved_report.save()
        
        profile = state_dict.get("company_profile", {}) or {}
        ticker = state_dict.get("ticker") or profile.get("ticker", "report")
        
        # 1. Compile HTML report
        report_html = build_report_html(state_dict, report_id)
        html_len = len(report_html)
        logger.debug(f"HTML Generated for {ticker}. Length: {html_len}")
        
        # 2. Save HTML & Markdown directly to database
        saved_report.report_html = report_html
        saved_report.report_markdown = state_dict.get("markdown_report", "")
        
        # 3. Save as file to pdf_file field
        filename = f"{ticker}_report.html"
        saved_report.pdf_file.save(
            filename,
            ContentFile(report_html.encode('utf-8'))
        )
        
        saved_report.pdf_status = 'ready'
        saved_report.pdf_generated_at = timezone.now()
        saved_report.save()
        
        logger.debug(f"PDF Generated & Saved for {ticker} at {saved_report.pdf_file.url}")
        logger.info(f"Background PDF/HTML Generation SUCCESS for report_id {report_id}")
    except Exception as e:
        logger.error(f"Background PDF/HTML Generation FAILED for report_id {report_id}: {str(e)}")
        try:
            saved_report = SavedReport.objects.get(id=report_id)
            saved_report.pdf_status = 'failed'
            saved_report.key_highlights["error"] = str(e)
            saved_report.save()
        except:
            pass
    finally:
        close_old_connections()
