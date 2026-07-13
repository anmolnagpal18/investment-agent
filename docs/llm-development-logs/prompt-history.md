# LLM Development Logs — Prompt History & Refinements

This document records the exact system instructions and refinement prompts used to guide the AI coding assistant through the build lifecycle of InvestIQ AI.

---

## 1. Initial Scaffold Prompt
Used to establish the workspace layout, requirements, and JWT configurations:
> *“Implement JWT Authentication using DRF and Simple JWT. Use Django's built-in User model and create a UserProfile to store experience levels (BEGINNER, INTERMEDIATE, ADVANCED) and favorite sectors. Avoid creating frontend files in this phase, only focus on production-ready API security.”*

---

## 2. Stock Resolver Refinement Prompt
Used to handle the international vs. local ticker resolution bug:
> *“Modify the company service layer. When a user inputs a query like 'Reliance', do not automatically assign the US ticker. Run a search matching query against both NSE and international exchanges, and return a selection dropdown of possible matches so the user can verify their target asset.”*

---

## 3. LangGraph Workflow Prompt
Used to construct the cyclic state machine:
> *“Define a LangGraph workflow with 8 distinct nodes: company_research, financial_analysis, news_analysis, risk_analysis, swot_analysis, scores_calculation, recommendation, and report_generator. Carry state across all nodes in a TypedDict, and update a conversation's status in the database at the beginning of each node execution.”*

---

## 4. UI Polish & Streaming Prompt
Used to build the premium, responsive dashboard and company page:
> *“Create a React page for the research workspace. When the analysis starts, poll the backend status endpoint to update a Perplexity-style live progress step list. Stagger the rendering of report sections so they slide in sequentially. Add an SVG score ring and a waterfall contribution chart to explain the confidence percentage.”*
