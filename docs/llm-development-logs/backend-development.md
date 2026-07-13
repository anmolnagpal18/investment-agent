# LLM Development Logs — Backend Implementation

This log details the backend development of the InvestIQ REST API, tracking the implementation of JWT security, stock resolution layers, and the LangGraph integration.

---

## 1. Phase 3 — Authentication & Security

We implemented authentication using **Django REST Framework (DRF)** and **Simple JWT**.

### Key Decisions
- **Custom Profiles**: Extended the default Django User model with a `UserProfile` model connected via a One-to-One relationship to hold user investment profiles (`experience_level` and `favorite_sectors`).
- **Token Blacklisting**: Enabled Simple JWT token rotation and blacklist settings in `config/settings.py` to ensure that logged-out JWT tokens cannot be re-used.

---

## 2. Phase 4 — Stock Resolution Layer & Services

When building the data fetcher, we encountered a mapping bug: searching for `"Reliance"` returned the NYSE-listed company `"Reliance Steel & Aluminum Co. (RS)"` instead of the Indian conglomerate `"Reliance Industries Limited (RELIANCE.NS)"`.

### The Resolution Service
To resolve this, we built a resolver logic in `companies/services/resolver.py`:
1. Check if the input is an exact stock ticker matching Yahoo Finance.
2. If it is a company name, run a fuzzy matching search against a predefined registry of local and international equities.
3. Offer possible matches to the user to choose from if ambiguity is detected, rather than auto-selecting the top US ticker.

---

## 3. Phase 5 & 6 — LangGraph Integration & APIs

The `AnalyzeView` integrates the LangGraph workflow with Django's async executor.

### Handling Long-Running Tasks
Since full multi-node research (fetching stock profiles, financials, scraping news, scoring, and writing reports) takes 15–20 seconds, we needed a way to display progress to the user:
- **Solution**: We added a `status` field to the `AIConversation` database model.
- Each node in the LangGraph updates the state thread and writes the active step (e.g., `financial_analysis`, `news_analysis`) to the database.
- The React frontend polls this status endpoint dynamically, achieving a live research progress effect without websocket overhead.
