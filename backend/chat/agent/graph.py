from langgraph.graph import StateGraph, START, END
from .state import AgentState
from .nodes import (
    initialize_state_node,
    company_research_node,
    financial_analysis_node,
    metrics_calculation_node,
    scores_calculation_node,
    news_analysis_node,
    risk_analysis_node,
    swot_analysis_node,
    recommendation_thesis_node,
    report_generator_node
)

def build_research_graph():
    """
    Registers the 10 multi-agent research nodes and builds the sequential graph.
    """
    builder = StateGraph(AgentState)
    
    # Register Nodes
    builder.add_node("initialize", initialize_state_node)
    builder.add_node("company_research", company_research_node)
    builder.add_node("financial_analysis", financial_analysis_node)
    builder.add_node("metrics_calculation", metrics_calculation_node)
    builder.add_node("scores_calculation", scores_calculation_node)
    builder.add_node("news_analysis", news_analysis_node)
    builder.add_node("risk_analysis", risk_analysis_node)
    builder.add_node("swot_analysis", swot_analysis_node)
    builder.add_node("recommendation", recommendation_thesis_node)
    builder.add_node("report_generator", report_generator_node)
    
    # Define Sequential Edges
    builder.add_edge(START, "initialize")
    builder.add_edge("initialize", "company_research")
    builder.add_edge("company_research", "financial_analysis")
    builder.add_edge("financial_analysis", "metrics_calculation")
    builder.add_edge("metrics_calculation", "scores_calculation")
    builder.add_edge("scores_calculation", "news_analysis")
    builder.add_edge("news_analysis", "risk_analysis")
    builder.add_edge("risk_analysis", "swot_analysis")
    builder.add_edge("swot_analysis", "recommendation")
    builder.add_edge("recommendation", "report_generator")
    builder.add_edge("report_generator", END)
    
    return builder.compile()
