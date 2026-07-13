from typing import TypedDict, List, Dict, Any, Optional

class AgentState(TypedDict):
    """
    Shared state interface passed between the LangGraph execution nodes.
    """
    ticker: str
    user_query: str
    user_id: Optional[int]
    conversation_id: Optional[str]
    company_profile: Dict[str, Any]
    financials: Dict[str, Any]
    news_list: List[Dict[str, Any]]
    risks: List[str]
    swot: Dict[str, List[str]]
    related_tickers: List[Dict[str, Any]]
    recommendation_payload: Dict[str, Any]  # Stores rating (BUY/HOLD/PASS), confidence, scores, explanation
    markdown_report: str
    errors: List[str]
