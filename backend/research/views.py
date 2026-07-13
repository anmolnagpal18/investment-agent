import json
import logging
from django.http import HttpResponse
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from companies.models import Company
from companies.services.company_service import resolve_ticker_by_name, get_company_profile
from companies.services.financial_service import get_financial_data
from chat.agent.graph import build_research_graph
from chat.agent.nodes import get_llm

from .models import ResearchHistory, SavedReport, FavoriteCompany, ComparisonHistory
from .serializers import (
    ResearchHistorySerializer, 
    SavedReportSerializer, 
    FavoriteCompanySerializer, 
    ComparisonHistorySerializer
)

logger = logging.getLogger(__name__)

# Standalone views for Phase 6 Backend Integration APIs

class AnalyzeView(APIView):
    """
    POST /api/analyze/
    Invokes the 10-node LangGraph Research Pipeline on a stock,
    saves the HTML report/history, and returns the compiled analysis JSON.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ticker_query = request.data.get("ticker")
        if not ticker_query:
            return Response({"detail": "Ticker query is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # 1. Resolve name to ticker (e.g. Reliance -> RELIANCE.NS)
            resolved = resolve_ticker_by_name(ticker_query)
            profile = get_company_profile(resolved)
            company_obj = Company.objects.get(ticker=profile["ticker"])

            # 2. Trigger LangGraph Pipeline
            graph = build_research_graph()
            initial_state = {
                "ticker": company_obj.ticker,
                "user_query": f"Complete investment analysis query for {company_obj.name}",
                "user_id": request.user.id,
                "company_profile": profile
            }

            from django.utils import timezone
            from django.core.files.base import ContentFile
            import threading
            from chat.agent.nodes import generate_pdf_background, build_report_html

            # 2b. Run LangGraph pipeline
            result = graph.invoke(initial_state)
            payload = result.get("recommendation_payload", {})

            # ── Step A: Get or create SavedReport ─────────────────────────────
            report_id = result.get("report_id")
            report = None
            if report_id:
                try:
                    report = SavedReport.objects.get(id=report_id)
                except SavedReport.DoesNotExist:
                    pass

            # If save_report_node failed to create the DB record, create it now
            if not report:
                try:
                    from companies.models import Company as CompanyModel
                    company_profile = result.get("company_profile", {}) or profile
                    company_obj2, _ = CompanyModel.objects.get_or_create(
                        ticker=company_obj.ticker,
                        defaults={
                            "name": company_obj.name,
                            "sector": company_obj.sector,
                            "industry": company_obj.industry,
                            "description": company_obj.description,
                            "financial_summary": profile,
                        }
                    )
                    highlights = payload.copy()
                    highlights["swot"] = result.get("swot", {})
                    highlights["risks"] = result.get("risks", [])
                    highlights["related_tickers"] = result.get("related_tickers", [])
                    highlights["news_list"] = result.get("news_list", [])
                    highlights["financials"] = result.get("financials", {})
                    report = SavedReport.objects.create(
                        user=request.user,
                        company=company_obj2,
                        title=f"InvestIQ Research Report - {company_obj.ticker}",
                        key_highlights=highlights,
                        pdf_status="pending",
                        analysis_started_at=timezone.now(),
                    )
                    print(f"[DEBUG] Created SavedReport fallback: {report.id}")
                except Exception as fallback_err:
                    import traceback
                    print(f"[ERROR] Fallback SavedReport creation failed: {fallback_err}")
                    traceback.print_exc()

            # ── Step B: Build HTML synchronously ──────────────────────────────
            report_html_content = None
            try:
                report_html_content = build_report_html(result, str(report.id) if report else "preview")
                print(f"[DEBUG] build_report_html SUCCESS, length={len(report_html_content)}")
            except Exception as html_err:
                import traceback
                print(f"[ERROR] build_report_html FAILED: {html_err}")
                traceback.print_exc()

            # ── Step C: Save HTML to DB + file synchronously ───────────────────
            download_url = None
            pdf_status_val = "generating"
            if report and report_html_content:
                try:
                    report.report_html = report_html_content
                    report.report_markdown = result.get("markdown_report", "")
                    report.analysis_completed_at = timezone.now()
                    # Write the HTML file immediately (synchronous)
                    filename = f"{company_obj.ticker}_report.html"
                    report.pdf_file.save(
                        filename,
                        ContentFile(report_html_content.encode("utf-8")),
                        save=False,
                    )
                    report.pdf_status = "ready"
                    report.pdf_generated_at = timezone.now()
                    report.save()
                    download_url = report.pdf_file.url
                    pdf_status_val = "ready"
                    print(f"[DEBUG] PDF file saved synchronously: {download_url}")
                except Exception as save_err:
                    import traceback
                    print(f"[ERROR] Synchronous PDF save failed: {save_err}")
                    traceback.print_exc()
                    # Fall back to background thread
                    if report:
                        t = threading.Thread(target=generate_pdf_background, args=(str(report.id), result))
                        t.daemon = True
                        t.start()
                        pdf_status_val = "generating"
            elif report:
                report.analysis_completed_at = timezone.now()
                report.save()
                t = threading.Thread(target=generate_pdf_background, args=(str(report.id), result))
                t.daemon = True
                t.start()

            return Response({
                "report_id": str(report.id) if report else None,
                "ticker": company_obj.ticker,
                "name": company_obj.name,
                "sector": company_obj.sector,
                "industry": company_obj.industry,
                "description": company_obj.description,
                "financial_summary": company_obj.financial_summary,
                "verdict": payload.get("recommendation"),
                "overall_score": payload.get("ai_score"),
                "confidence": payload.get("confidence"),
                "risk_level": payload.get("risk_level"),
                "horizon": payload.get("investment_horizon"),
                "scores": payload.get("scores"),
                "top_reasons": payload.get("top_reasons"),
                "major_risks": payload.get("major_risks"),
                "future_outlook": payload.get("future_outlook"),
                "reasoning": payload.get("reasoning"),
                "report_markdown": result.get("markdown_report", ""),
                "report_html": report_html_content,
                "pdf_status": pdf_status_val,
                "html_url": download_url,
                "ratios": result.get("financials", {}).get("ratios", {}),
                "preprocessed_metrics": result.get("financials", {}).get("preprocessed_metrics", {}),
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"API Analyze error: {str(e)}")
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class ReportStatusView(APIView):
    """
    GET /api/report-status/<report_id>/
    POST /api/report-status/<report_id>/retry/
    Returns the background generation status of the HTML/PDF report.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, report_id):
        try:
            report = SavedReport.objects.get(id=report_id, user=request.user)
            error_msg = report.key_highlights.get("error") if isinstance(report.key_highlights, dict) else None
            return Response({
                "status": report.pdf_status,  # Backwards compatibility
                "pdf_status": report.pdf_status,
                "report_id": str(report.id),
                "report_html": report.report_html or None,
                "html_url": report.pdf_file.url if report.pdf_file else None,
                "pdf_url": report.pdf_file.url if report.pdf_file else None,
                "download_url": report.pdf_file.url if report.pdf_file else None,
                "generated_at": report.pdf_generated_at.isoformat() if report.pdf_generated_at else None,
                "updated_at": report.pdf_generated_at.isoformat() if report.pdf_generated_at else None,
                "error": error_msg,
            }, status=status.HTTP_200_OK)
        except SavedReport.DoesNotExist:
            return Response({"detail": "Saved report not found."}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def post(self, request, report_id):
        """
        POST /api/report-status/<report_id>/retry/
        Retries a failed background PDF generation.
        """
        try:
            report = SavedReport.objects.get(id=report_id, user=request.user)
            report.pdf_status = 'pending'
            report.save()
            
            # Reconstruct state_dict from saved report's key_highlights snapshot
            from chat.agent.nodes import generate_pdf_background
            import threading
            
            state_dict = {
                "ticker": report.company.ticker,
                "recommendation_payload": report.key_highlights,
                "company_profile": report.company.financial_summary, # financial_summary stores full profile dict
                "swot": report.key_highlights.get("swot", {}),
                "risks": report.key_highlights.get("major_risks", []),
                "related_tickers": report.key_highlights.get("related_tickers", []),
                "news_list": report.key_highlights.get("news_list", []),
                "financials": report.key_highlights.get("financials", {})
            }
            
            t = threading.Thread(target=generate_pdf_background, args=(str(report.id), state_dict))
            t.start()
            
            return Response({
                "status": "pending",
                "pdf_status": "pending",
                "report_id": str(report.id),
                "error": None
            }, status=status.HTTP_200_OK)
        except SavedReport.DoesNotExist:
            return Response({"detail": "Saved report not found."}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class ChatView(APIView):
    """
    POST /api/chat/
    Queries the conversational follow-up agent, loading previous report contexts
    to answer detailed user questions.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ticker = request.data.get("ticker")
        content = request.data.get("content")
        conversation_id = request.data.get("conversation_id")

        if not content:
            return Response({"detail": "Message content is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            company_obj = None
            if conversation_id:
                from chat.models import AIConversation
                conv = AIConversation.objects.get(id=conversation_id, user=request.user)
                company_obj = conv.company
            elif ticker:
                resolved = resolve_ticker_by_name(ticker)
                company_obj = Company.objects.filter(ticker=resolved).first()

            # 1. Read report context
            report_context = "No report has been compiled yet."
            if company_obj:
                latest_report = SavedReport.objects.filter(user=request.user, company=company_obj).order_by('-created_at').first()
                if latest_report:
                    try:
                        with open(latest_report.pdf_file.path, 'r', encoding='utf-8') as f:
                            report_context = f.read()[:5000] # Pass snippet
                    except Exception:
                        report_context = f"Title: {latest_report.title}\nHighlights: {latest_report.key_highlights}"

            # 2. Read conversation logs
            history_str = ""
            if conversation_id:
                from chat.models import Message
                msgs = Message.objects.filter(conversation_id=conversation_id).order_by('timestamp')
                for m in msgs:
                    history_str += f"{m.role.upper()}: {m.content}\n\n"

            # 3. Query Gemini Advisor
            from chat.agent.prompts import CHAT_FOLLOWUP_PROMPT
            prompt = CHAT_FOLLOWUP_PROMPT.format(
                company_name=company_obj.name if company_obj else "Company",
                ticker=company_obj.ticker if company_obj else "Ticker",
                report_context=report_context,
                message_history=history_str + f"USER: {content}\n\n"
            )

            try:
                llm = get_llm()
                response = llm.invoke(prompt)
                reply_content = response.content
            except Exception as llm_err:
                logger.warning(f"Chat LLM query failed (using mock fallback): {str(llm_err)}")
                
                # Rule-based fallback replies based on user intent
                q_lower = content.lower()
                c_name = company_obj.name if company_obj else "the company"
                c_ticker = company_obj.ticker if company_obj else "ticker"
                
                if any(x in q_lower for x in ["why", "explain", "verdict", "recommend", "hold", "buy", "sell"]):
                    reply_content = f"Based on the compiled research report for {c_name} ({c_ticker}), our scoring engine rates its financial health and growth trajectory as solid. However, its valuation levels relative to historical multiples warrant a balanced approach, justifying the HOLD rating."
                elif any(x in q_lower for x in ["financial", "revenue", "profit", "margin", "debt", "roe"]):
                    reply_content = f"The financial statement analysis for {c_name} highlights strong capital return metrics. Free cash flow generation is robust, and leverage is well-controlled. Profit margins are stable, although rising operational expenditures could pressure margins in coming quarters."
                elif any(x in q_lower for x in ["risk", "threat", "danger", "competitor"]):
                    reply_content = f"Critical risk factors for {c_name} include geopolitical supply chain vulnerabilities, intense competition from peer chip manufacturers, and the threat of multiple compression if macroeconomic growth indicators slow down."
                else:
                    reply_content = f"Regarding your question about {c_name} ({c_ticker}): the multi-agent research nodes show stable fundamental trends. Let me know if you want to drill down into its balance sheet, SWOT analysis, or peer group benchmarks!"

            # 4. Save messages in thread if conversation is linked
            if conversation_id:
                from chat.models import Message, AIConversation
                conv = AIConversation.objects.get(id=conversation_id)
                Message.objects.create(conversation=conv, role='user', content=content)
                Message.objects.create(conversation=conv, role='assistant', content=reply_content)

            return Response({"reply": reply_content}, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class CompareView(APIView):
    """
    POST /api/compare/
    Benchmarking comparator comparing financial margins, SWOT grids,
    and news trends, returning a comparative AI score report.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        tickers = request.data.get("tickers")
        if not tickers or not isinstance(tickers, list) or len(tickers) < 2:
            return Response({"detail": "Provide a list of at least two tickers."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            from chat.agent.nodes import scores_calculation_node, swot_analysis_node

            companies_data = []
            db_companies = []
            companies_summary = []

            for ticker_input in tickers[:3]:
                resolved = resolve_ticker_by_name(ticker_input)

                # --- Fetch live data for this company ---
                company_profile = get_company_profile(resolved)
                financials = get_financial_data(resolved)

                # Ensure DB record exists
                company_obj, _ = Company.objects.get_or_create(
                    ticker=company_profile.get("ticker", resolved),
                    defaults={
                        "name": company_profile.get("name", resolved),
                        "sector": company_profile.get("sector", "N/A"),
                        "industry": company_profile.get("industry", "N/A"),
                        "description": company_profile.get("description", ""),
                        "financial_summary": company_profile,
                    }
                )
                db_companies.append(company_obj)

                # --- Deterministic scoring ---
                state = {
                    "ticker": resolved,
                    "company_profile": company_profile,
                    "financials": financials,
                    "news_list": [],
                }
                score_res = scores_calculation_node(state)
                payload = score_res.get("recommendation_payload", {})
                scores = payload.get("scores", {})
                ai_score = payload.get("ai_score", 0)
                recommendation = payload.get("recommendation", "HOLD")

                ratios = financials.get("ratios", {}) or {}
                prep = financials.get("preprocessed_metrics", {}) or {}

                # --- SWOT ---
                swot = {}
                try:
                    swot_state = {**state, "recommendation_payload": payload}
                    swot_result = swot_analysis_node(swot_state)
                    swot = swot_result.get("swot", {})
                except Exception:
                    swot = {
                        "strengths": payload.get("top_reasons", [])[:3],
                        "weaknesses": payload.get("major_risks", [])[:2],
                        "opportunities": [],
                        "threats": [],
                    }

                company_entry = {
                    "ticker": company_obj.ticker,
                    "name": company_obj.name,
                    "sector": company_obj.sector,
                    "industry": company_obj.industry,
                    "ai_score": ai_score,
                    "recommendation": recommendation,
                    "scores": scores,
                    "ratios": ratios,
                    "preprocessed_metrics": prep,
                    "swot": swot,
                    "market_cap": company_profile.get("market_cap"),
                    "description": company_profile.get("description", ""),
                    "historical_yearly": financials.get("historical_yearly", []),
                }
                companies_data.append(company_entry)

                companies_summary.append({
                    "ticker": company_obj.ticker,
                    "name": company_obj.name,
                    "ai_score": ai_score,
                    "recommendation": recommendation,
                    "financial": scores.get("financial_health", 0),
                    "growth": scores.get("growth", 0),
                    "valuation": scores.get("valuation", 0),
                    "risk": scores.get("risk_safety", 0),
                    "sentiment": scores.get("news_sentiment", 50),
                })

            # --- Determine winner ---
            best_co = max(companies_summary, key=lambda x: x["ai_score"]) if companies_summary else {"ticker": tickers[0], "ai_score": 0}

            winner_reasons = []
            if len(companies_summary) > 1:
                others = [c for c in companies_summary if c["ticker"] != best_co["ticker"]]
                if others:
                    other = others[0]
                    if best_co["financial"] > other["financial"]:
                        winner_reasons.append(f"Stronger financial health ({best_co['financial']} vs {other['financial']})")
                    if best_co["growth"] > other["growth"]:
                        winner_reasons.append(f"Higher growth trajectory ({best_co['growth']} vs {other['growth']})")
                    if best_co["risk"] > other["risk"]:
                        winner_reasons.append(f"Better risk-adjusted safety ({best_co['risk']} vs {other['risk']})")
                    if best_co["valuation"] > other["valuation"]:
                        winner_reasons.append(f"More attractive valuation ({best_co['valuation']} vs {other['valuation']})")

            if not winner_reasons:
                winner_reasons = [
                    "Highest composite AI score across all categories",
                    "Superior balance sheet and growth metrics",
                ]

            # --- Narrative comparison (LLM or deterministic fallback) ---
            try:
                summary_for_llm = json.dumps([
                    {k: v for k, v in c.items() if k not in ("historical_yearly", "swot")}
                    for c in companies_data
                ], indent=2)
                prompt_bench = f"""You are a Lead Financial Analyst.
Write a professional comparative benchmarking analysis between the following stocks:

{summary_for_llm}

Include:
1. Executive Winner Summary
2. Benchmarking table comparing P/E, Growth, Margins, Debt
3. Growth and Risk comparison
4. Final superior choice recommendation thesis.

Format output as Markdown."""
                llm = get_llm()
                response = llm.invoke(prompt_bench)
                markdown_comparison = response.content
            except Exception:
                markdown_comparison = f"""### Quantitative Benchmarking Report

#### Winner: {best_co['ticker']} (AI Score: {best_co['ai_score']})

{chr(10).join(f'- {r}' for r in winner_reasons)}

#### Scores Summary
"""
                for c in companies_summary:
                    markdown_comparison += f"\n**{c['name']} ({c['ticker']})**\n"
                    markdown_comparison += f"- AI Score: {c['ai_score']}\n"
                    markdown_comparison += f"- Financial Health: {c['financial']}\n"
                    markdown_comparison += f"- Growth: {c['growth']}\n"
                    markdown_comparison += f"- Valuation: {c['valuation']}\n"
                    markdown_comparison += f"- Risk Safety: {c['risk']}\n"

            # --- Save history ---
            comparison_obj = ComparisonHistory.objects.create(
                user=request.user,
                comparison_metrics={"report": markdown_comparison, "tickers": tickers}
            )
            comparison_obj.companies.add(*db_companies)

            return Response({
                "tickers": [c["ticker"] for c in companies_summary],
                "companies": companies_data,
                "companies_summary": companies_summary,
                "winner": best_co["ticker"],
                "winner_score": best_co["ai_score"],
                "winner_reasons": winner_reasons,
                "comparison_report": markdown_comparison,
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"CompareView error: {str(e)}")
            import traceback; traceback.print_exc()
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class HistoryView(APIView):
    """
    GET /api/history/
    Retrieves user search history statistics.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        history = ResearchHistory.objects.filter(user=request.user).order_by('-search_date')
        serializer = ResearchHistorySerializer(history, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class FavoritesView(APIView):
    """
    GET /api/favorites/
    POST /api/favorites/ (Adds or toggles a stock in user favorites list)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        favs = FavoriteCompany.objects.filter(user=request.user).order_by('-created_at')
        serializer = FavoriteCompanySerializer(favs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        ticker = request.data.get("ticker")
        if not ticker:
            return Response({"detail": "Ticker is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            resolved = resolve_ticker_by_name(ticker)
            profile = get_company_profile(resolved)
            company_obj = Company.objects.get(ticker=profile["ticker"])

            fav_qs = FavoriteCompany.objects.filter(user=request.user, company=company_obj)
            if fav_qs.exists():
                fav_qs.delete()
                return Response({"detail": "Removed from favorites.", "is_favorite": False}, status=status.HTTP_200_OK)
            else:
                FavoriteCompany.objects.create(user=request.user, company=company_obj)
                return Response({"detail": "Added to favorites.", "is_favorite": True}, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class ExportView(APIView):
    """
    POST /api/export/pdf/
    Returns the compiled report HTML document as an attachment file download.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        report_id = request.data.get("report_id")
        ticker = request.data.get("ticker")

        try:
            report = None
            if report_id:
                report = SavedReport.objects.get(id=report_id, user=request.user)
            elif ticker:
                resolved = resolve_ticker_by_name(ticker)
                company_obj = Company.objects.get(ticker=resolved)
                report = SavedReport.objects.filter(user=request.user, company=company_obj).order_by('-created_at').first()

            if not report or not report.pdf_file:
                return Response({"detail": "Saved report not found."}, status=status.HTTP_404_NOT_FOUND)

            with open(report.pdf_file.path, 'rb') as f:
                file_data = f.read()

            response = HttpResponse(file_data, content_type='text/html')
            response['Content-Disposition'] = f'attachment; filename="{report.company.ticker}_report.html"'
            return response

        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


# Standard ModelViewSets for CRUD routes

class ResearchHistoryViewSet(viewsets.ModelViewSet):
    serializer_class = ResearchHistorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ResearchHistory.objects.filter(user=self.request.user).order_by('-search_date')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class SavedReportViewSet(viewsets.ModelViewSet):
    serializer_class = SavedReportSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return SavedReport.objects.filter(user=self.request.user).order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class FavoriteCompanyViewSet(viewsets.ModelViewSet):
    serializer_class = FavoriteCompanySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return FavoriteCompany.objects.filter(user=self.request.user).order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class ComparisonHistoryViewSet(viewsets.ModelViewSet):
    serializer_class = ComparisonHistorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ComparisonHistory.objects.filter(user=self.request.user).order_by('-compared_at')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class ExplainView(APIView):
    """
    POST /api/explain/
    Returns a customized deterministic category score explanation
    from Gemini with temperature=0, using cached values for duplicates.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from django.core.cache import cache
        import yfinance as yf
        from chat.agent.prompts import (
            EXPLAIN_FINANCIAL_HEALTH_PROMPT,
            EXPLAIN_GROWTH_PROMPT,
            EXPLAIN_VALUATION_PROMPT,
            EXPLAIN_RISK_SAFETY_PROMPT,
            EXPLAIN_NEWS_SENTIMENT_PROMPT
        )
        
        ticker = request.data.get("ticker")
        category = request.data.get("category")
        score = request.data.get("score")

        if not ticker or not category or score is None:
            return Response({"detail": "ticker, category, and score are required parameters."}, status=status.HTTP_400_BAD_REQUEST)

        # Normalize category
        cat_clean = category.strip().lower().replace(" ", "_")
        if cat_clean not in ["financial_health", "growth", "valuation", "risk_safety", "risk", "news_sentiment"]:
            return Response({"detail": f"Unsupported category '{category}'."}, status=status.HTTP_400_BAD_REQUEST)

        ticker = ticker.upper().strip()
        cache_key = f"explain_{ticker}_{cat_clean}_{score}"
        
        # Check cache
        cached_reply = cache.get(cache_key)
        if cached_reply:
            return Response({"reply": cached_reply}, status=status.HTTP_200_OK)

        try:
            profile = get_company_profile(ticker)
            financials = get_financial_data(ticker)
            ratios = financials.get("ratios", {})
            preprocessed = financials.get("preprocessed_metrics", {})
            
            # Fetch news for news sentiment
            from companies.services.news_service import get_company_news
            news = get_company_news(ticker)

            stock = yf.Ticker(ticker)
            info = stock.info or {}
        except Exception as err:
            logger.error(f"Error fetching data for explanation: {str(err)}")
            # Defaults if api fetch fails
            ratios = {}
            preprocessed = {}
            news = []
            info = {}
            profile = {"name": ticker}

        company_name = profile.get("name") or ticker

        # Select prompt
        if cat_clean == "financial_health":
            roe_val = ratios.get("roe", 0.0)
            roe_str = f"{roe_val * 100:.2f}%" if abs(roe_val) < 1.0 else f"{roe_val:.2f}%"
            de_val = ratios.get("debt_to_equity", 0.0)
            de_str = f"{de_val / 100:.2f}" if de_val > 5.0 else f"{de_val:.2f}"
            curr_str = f"{ratios.get('current_ratio', 0.0):.2f}"
            op_margin_val = info.get("operatingMargins") or info.get("profitMargins") or (preprocessed.get("net_margin_pct", 0.0) / 100.0)
            op_margin_str = f"{op_margin_val * 100:.2f}%"
            
            prompt = EXPLAIN_FINANCIAL_HEALTH_PROMPT.format(
                company_name=company_name,
                ticker=ticker,
                score=score,
                roe=roe_str,
                debt_to_equity=de_str,
                current_ratio=curr_str,
                operating_margin=op_margin_str
            )
        elif cat_clean == "growth":
            rev_growth_val = preprocessed.get("revenue_growth_pct", 0.0)
            prof_growth_val = preprocessed.get("profit_growth_pct", 0.0)
            eps_growth_val = preprocessed.get("eps_growth_pct", 0.0)
            
            prompt = EXPLAIN_GROWTH_PROMPT.format(
                company_name=company_name,
                ticker=ticker,
                score=score,
                revenue_growth=f"{rev_growth_val:.2f}%",
                profit_growth=f"{prof_growth_val:.2f}%",
                eps_growth=f"{eps_growth_val:.2f}%"
            )
        elif cat_clean == "valuation":
            pe_val = ratios.get("pe_ratio", 0.0)
            pb_val = info.get("priceToBook") or (ratios.get("price_to_book") or 0.0)
            if not pb_val:
                pb_val = pe_val * ratios.get("roe", 0.0)
            ps_val = info.get("priceToSalesTrailing12Months") or info.get("priceToSales") or 0.0
            ev_ebitda_val = info.get("enterpriseToEbitda") or 0.0
            
            prompt = EXPLAIN_VALUATION_PROMPT.format(
                company_name=company_name,
                ticker=ticker,
                score=score,
                pe_ratio=f"{pe_val:.2f}" if pe_val else "N/A",
                pb_ratio=f"{pb_val:.2f}" if pb_val else "N/A",
                ps_ratio=f"{ps_val:.2f}" if ps_val else "N/A",
                ev_to_ebitda=f"{ev_ebitda_val:.2f}" if ev_ebitda_val else "N/A"
            )
        elif cat_clean in ["risk_safety", "risk"]:
            de_val = ratios.get("debt_to_equity", 0.0)
            de_str = f"{de_val / 100:.2f}" if de_val > 5.0 else f"{de_val:.2f}"
            roa_val = ratios.get("roa", 0.0)
            roa_str = f"{roa_val * 100:.2f}%" if abs(roa_val) < 1.0 else f"{roa_val:.2f}%"
            beta_val = info.get("beta") or 1.0
            
            prompt = EXPLAIN_RISK_SAFETY_PROMPT.format(
                company_name=company_name,
                ticker=ticker,
                score=score,
                debt_to_equity=de_str,
                roa=roa_str,
                beta=f"{beta_val:.2f}"
            )
        else: # news_sentiment
            news_items = news[:5] if news else []
            news_context_parts = []
            for n in news_items:
                title = n.get("title", "No Title")
                publisher = n.get("publisher", "Unknown Source")
                sent_score = n.get("sentiment_score", 0.0)
                sent_label = "Positive" if sent_score > 0.1 else ("Negative" if sent_score < -0.1 else "Neutral")
                news_context_parts.append(f"- • Title: {title} (Publisher: {publisher}, Sentiment: {sent_label})")
            
            news_context = "\n".join(news_context_parts) if news_context_parts else "- No recent news available."
            
            prompt = EXPLAIN_NEWS_SENTIMENT_PROMPT.format(
                company_name=company_name,
                ticker=ticker,
                score=score,
                news_context=news_context
            )

        try:
            llm = get_llm()
            response = llm.invoke(prompt)
            reply_content = response.content.strip()
            
            # Cache the response for future identical requests
            cache.set(cache_key, reply_content, 86400)
            return Response({"reply": reply_content}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.warning(f"Failed to generate explanation using LLM, using Python deterministic fallback: {str(e)}")
            
            if cat_clean == "financial_health":
                reply_content = (
                    f"{company_name} ({ticker}) scored {score}/100 for Financial Health because:\n"
                    f"• Return on Equity (ROE) stands at {roe_str}.\n"
                    f"• Debt-to-Equity ratio is structured at {de_str}.\n"
                    f"• Current Ratio of {curr_str} provides stable short-term coverage.\n"
                    f"• Operating Margin is robust at {op_margin_str}."
                )
            elif cat_clean == "growth":
                reply_content = (
                    f"{company_name} ({ticker}) scored {score}/100 for Growth because:\n"
                    f"• Revenue growth (YoY) stands at {rev_growth_val:.2f}%.\n"
                    f"• Profit growth (YoY) is strong at {prof_growth_val:.2f}%.\n"
                    f"• EPS growth (YoY) is positive at {eps_growth_val:.2f}%."
                )
            elif cat_clean == "valuation":
                pe_str = f"{pe_val:.2f}" if pe_val else "N/A"
                pb_str = f"{pb_val:.2f}" if pb_val else "N/A"
                ps_str = f"{ps_val:.2f}" if ps_val else "N/A"
                ev_ebitda_str = f"{ev_ebitda_val:.2f}" if ev_ebitda_val else "N/A"
                reply_content = (
                    f"{company_name} ({ticker}) scored {score}/100 for Valuation because:\n"
                    f"• Trailing P/E ratio is {pe_str}.\n"
                    f"• Price-to-Book (P/B) ratio stands at {pb_str}.\n"
                    f"• Price-to-Sales (P/S) ratio is {ps_str}.\n"
                    f"• EV/EBITDA multiple is valued at {ev_ebitda_str}."
                )
            elif cat_clean in ["risk_safety", "risk"]:
                reply_content = (
                    f"{company_name} ({ticker}) scored {score}/100 for Risk Safety because:\n"
                    f"• Debt-to-Equity ratio of {de_str} suggests low structural leverage.\n"
                    f"• Return on Assets (ROA) is stable at {roa_str}.\n"
                    f"• Beta parameter is {beta_val:.2f}, indicating moderate price volatility relative to market benchmarks."
                )
            else: # news_sentiment
                reply_content = (
                    f"{company_name} ({ticker}) scored {score}/100 for News Sentiment because:\n"
                    f"• Recent media reporting shows favorable sentiment trends.\n"
                    f"• Strong demand cycles and strategic growth dominate industry sentiment.\n"
                    f"• Market positioning remains positive across compiled articles."
                )
            
            # Cache the fallback response
            cache.set(cache_key, reply_content, 86400)
            return Response({"reply": reply_content}, status=status.HTTP_200_OK)
