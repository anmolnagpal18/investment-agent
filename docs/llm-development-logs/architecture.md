# LLM Development Logs — Architecture Design

This document details the collaborative design process behind InvestIQ AI's system architecture, explaining how requirements were refined, how LangGraph was chosen, and how structural decisions were navigated.

---

## 1. Initial Prompting & Brainstorming

The architecture was designed iteratively through LLM dialogues. The primary objective was to build a system that avoided common pitfalls of typical AI projects, such as unstructured LLM outputs, raw hallucinations, and sequential failures.

### The Problem of Sequential Chains
In initial architectural drafts, a sequential LangChain flow was proposed:
```
User Query ──> yfinance Data ──> Sentiment analysis ──> LLM Recommendation
```
**Feedback & Refinement**: Through LLM critique, we recognized that if the sentiment analysis step fails or produces empty outputs, the final LLM node still attempts to guess a recommendation without proper information, leading to high error rates.

---

## 2. Transition to LangGraph

To solve these constraints, we designed a **Multi-Node Cooperative State Graph** using LangGraph.

### State Integrity
The state is managed using a structured Python `TypedDict` containing:
- `ticker` (validated resolver string)
- `company_research` (structural profile details)
- `financial_data` (parsed income statements, balance sheets, and key ratios)
- `news_sentiment` (analyzed sentiment score)
- `risk_assessment` (parsed qualitative risks)
- `swot_analysis` (SWOT lists)
- `scores` (intermediate category scores from 0 to 100)
- `verdict` (final BUY, HOLD, PASS rating)

### Cyclic Capabilities
If the `Scoring Node` detects that required inputs are missing or fall below confidence thresholds, it can route execution dynamically back to specific collectors or flag the context rather than throwing a silent exception.

---

## 3. Explanability Engine Decisions

A key design choice was **disallowing the LLM from choosing the final recommendation directly**. 

Instead, the LLM is restricted to providing category scores ($0$ to $100$) and qualitative lists. The final verdict and confidence are calculated using deterministic Python equations:

```python
ai_score = (
    scores['financial_health'] * 0.30 +
    scores['growth'] * 0.25 +
    scores['valuation'] * 0.20 +
    scores['risk_safety'] * 0.15 +
    scores['news_sentiment'] * 0.10
)

if ai_score >= 75:
    verdict = 'BUY'
elif ai_score >= 50:
    verdict = 'HOLD'
else:
    verdict = 'PASS'
```

This structural constraint ensures that the UI can explain *exactly* why a recommendation was made, showing interviewers the exact mathematical breakdown rather than a black-box LLM output.
