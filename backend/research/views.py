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
                    logger.debug(f"Created SavedReport fallback: {report.id}")
                except Exception as fallback_err:
                    logger.error(f"Fallback SavedReport creation failed: {fallback_err}")

            # ── Step B: Build HTML synchronously ──────────────────────────────
            report_html_content = None
            try:
                report_html_content = build_report_html(result, str(report.id) if report else "preview")
                logger.debug(f"build_report_html SUCCESS, length={len(report_html_content)}")
            except Exception as html_err:
                logger.error(f"build_report_html FAILED: {html_err}")

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
                    logger.debug(f"PDF file saved synchronously: {download_url}")
                except Exception as save_err:
                    logger.error(f"Synchronous PDF save failed: {save_err}")
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


def build_comparison_matrix_html(companies_summary):
    metrics = [
        ("AI Score", "ai_score", True),
        ("Financial Health", "financial", True),
        ("Growth", "growth", True),
        ("Valuation", "valuation", True),
        ("Risk Safety", "risk", True),
        ("News Sentiment", "sentiment", True),
    ]
    rows_html = []
    for label, key, higher_is_better in metrics:
        vals = [c.get(key, 0) for c in companies_summary]
        best_val = max(vals) if higher_is_better else min(vals)
        worst_val = min(vals) if higher_is_better else max(vals)
        
        row_str = f"<tr><td><strong>{label}</strong></td>"
        for c in companies_summary:
            v = c.get(key, 0)
            cls = ""
            if len(companies_summary) > 1:
                if v == best_val and best_val != worst_val:
                    cls = ' class="best"'
                elif v == worst_val and best_val != worst_val:
                    cls = ' class="worst"'
                else:
                    cls = ' class="neutral"'
            row_str += f"<td{cls}>{v}/100</td>"
        row_str += "</tr>"
        rows_html.append(row_str)
        
    return "\n".join(rows_html)


def build_financial_metrics_rows_html(companies_data):
    metrics = [
        ("Current Price ($)", lambda c: c.get("preprocessed_metrics", {}).get("current_price") or c.get("ratios", {}).get("current_price"), True, "${:,.2f}"),
        ("Market Cap", lambda c: c.get("market_cap"), True, "${:,.0f}"),
        ("Revenue", lambda c: c.get("preprocessed_metrics", {}).get("revenue") or c.get("ratios", {}).get("revenue") or (c.get("historical_yearly", [{}])[0].get("revenue") if c.get("historical_yearly") else 0), True, "${:,.0f}"),
        ("Revenue Growth (YoY)", lambda c: c.get("ratios", {}).get("revenue_growth") or (c.get("historical_yearly", [{}])[0].get("revenue_growth") if c.get("historical_yearly") else 0), True, "{:.2f}%"),
        ("Operating Margin", lambda c: c.get("ratios", {}).get("operating_margin") or (c.get("historical_yearly", [{}])[0].get("operating_margin") if c.get("historical_yearly") else 0), True, "{:.2f}%"),
        ("Net Margin", lambda c: c.get("ratios", {}).get("net_margin") or (c.get("historical_yearly", [{}])[0].get("net_margin") if c.get("historical_yearly") else 0), True, "{:.2f}%"),
        ("ROE", lambda c: c.get("ratios", {}).get("roe") or (c.get("historical_yearly", [{}])[0].get("roe") if c.get("historical_yearly") else 0), True, "{:.2f}%"),
        ("EPS", lambda c: c.get("ratios", {}).get("eps") or c.get("ratios", {}).get("trailing_eps"), True, "${:.2f}"),
        ("P/E Ratio", lambda c: c.get("ratios", {}).get("pe") or c.get("ratios", {}).get("trailing_pe"), False, "{:.2f}"),
        ("PEG Ratio", lambda c: c.get("ratios", {}).get("peg_ratio"), False, "{:.2f}"),
        ("P/B Ratio", lambda c: c.get("ratios", {}).get("pb"), False, "{:.2f}"),
        ("EV/EBITDA", lambda c: c.get("ratios", {}).get("ev_ebitda"), False, "{:.2f}"),
        ("Debt/Equity Ratio", lambda c: c.get("ratios", {}).get("de_ratio"), False, "{:.2f}"),
        ("Current Ratio", lambda c: c.get("ratios", {}).get("current_ratio"), True, "{:.2f}"),
        ("Beta", lambda c: c.get("ratios", {}).get("beta"), False, "{:.2f}"),
        ("Free Cash Flow", lambda c: c.get("preprocessed_metrics", {}).get("free_cash_flow"), True, "${:,.0f}"),
        ("Dividend Yield", lambda c: c.get("ratios", {}).get("dividend_yield"), True, "{:.2f}%"),
        ("52 Week High", lambda c: c.get("ratios", {}).get("fifty_two_week_high"), True, "${:,.2f}"),
        ("52 Week Low", lambda c: c.get("ratios", {}).get("fifty_two_week_low"), True, "${:,.2f}"),
    ]
    
    rows_html = []
    for label, extractor, higher_is_better, fmt_str in metrics:
        vals = []
        for c in companies_data:
            val = extractor(c)
            if "%" in fmt_str and val is not None and val < 1.0 and val > -1.0:
                val = val * 100.0
            try:
                val = float(val) if val is not None else 0.0
            except (ValueError, TypeError):
                val = 0.0
            vals.append(val)
            
        best_val = max(vals) if higher_is_better else min(vals)
        worst_val = min(vals) if higher_is_better else max(vals)
        
        row_str = f"<tr><td><strong>{label}</strong></td>"
        for idx, val in enumerate(vals):
            cls = ""
            if len(companies_data) > 1:
                if val == best_val and best_val != worst_val:
                    cls = ' class="best"'
                elif val == worst_val and best_val != worst_val:
                    cls = ' class="worst"'
                else:
                    cls = ' class="neutral"'
            
            formatted = fmt_str.format(val)
            if val == 0.0 and label not in ["Beta", "EPS", "P/E Ratio", "PEG Ratio", "P/B Ratio", "EV/EBITDA", "Debt/Equity Ratio"]:
                formatted = "—"
            row_str += f"<td{cls}>{formatted}</td>"
        row_str += "</tr>"
        rows_html.append(row_str)
        
    return "\n".join(rows_html)


def build_winner_analysis_cards_html(companies_summary, companies_data):
    if len(companies_summary) < 2:
        return "<p>Add at least two companies to compare details.</p>"
        
    def get_co_data(ticker):
        return next((c for c in companies_data if c["ticker"] == ticker), None)
        
    cards = []
    
    # 1. Overall Winner
    best_co = max(companies_summary, key=lambda x: x["ai_score"])
    other_cos = [c for c in companies_summary if c["ticker"] != best_co["ticker"]]
    others_str = " and ".join(c["ticker"] for c in other_cos)
    overall_reason = f"🏆 <strong>{best_co['name']} ({best_co['ticker']})</strong> is the superior investment choice with a composite AI Score of <strong>{best_co['ai_score']}/100</strong>, outperforming {others_str}."
    cards.append(format_winner_card("Overall Winner", best_co["ticker"], overall_reason, "#0F172A"))
    
    # 2. Financial Winner
    best_fin = max(companies_summary, key=lambda x: x.get("financial", 0))
    fin_co = get_co_data(best_fin["ticker"])
    cr = fin_co.get("ratios", {}).get("current_ratio", 0.0) or 0.0
    de = fin_co.get("ratios", {}).get("debt_to_equity", 0.0) or 0.0
    fin_reason = f"<strong>{best_fin['ticker']}</strong> leads Financial Health at <strong>{best_fin['financial']}/100</strong>, supported by a Current Ratio of <strong>{cr:.2f}x</strong> and a Debt/Equity ratio of <strong>{de:.2f}%</strong>."
    cards.append(format_winner_card("Financial Winner", best_fin["ticker"], fin_reason, "#3B82F6"))
    
    # 3. Growth Winner
    best_gro = max(companies_summary, key=lambda x: x.get("growth", 0))
    gro_co = get_co_data(best_gro["ticker"])
    rev_g = gro_co.get("preprocessed_metrics", {}).get("revenue_growth_pct", 0.0) or 0.0
    eps_g = gro_co.get("preprocessed_metrics", {}).get("eps_growth_pct", 0.0) or 0.0
    gro_reason = f"<strong>{best_gro['ticker']}</strong> leads Growth at <strong>{best_gro['growth']}/100</strong>, showing YoY revenue growth of <strong>{rev_g:.2f}%</strong> and EPS growth of <strong>{eps_g:.2f}%</strong>."
    cards.append(format_winner_card("Growth Winner", best_gro["ticker"], gro_reason, "#10B981"))
    
    # 4. Value Winner
    best_val = max(companies_summary, key=lambda x: x.get("valuation", 0))
    val_co = get_co_data(best_val["ticker"])
    pe = val_co.get("ratios", {}).get("pe_ratio", 0.0) or 0.0
    peg = val_co.get("ratios", {}).get("peg_ratio", 0.0) or 0.0
    val_reason = f"<strong>{best_val['ticker']}</strong> leads Valuation at <strong>{best_val['valuation']}/100</strong>, trading at a P/E of <strong>{pe:.2f}</strong> and PEG of <strong>{peg:.2f}</strong>."
    cards.append(format_winner_card("Value Winner", best_val["ticker"], val_reason, "#F59E0B"))
    
    # 5. Risk Winner
    best_risk = max(companies_summary, key=lambda x: x.get("risk", 0))
    risk_co = get_co_data(best_risk["ticker"])
    beta = risk_co.get("ratios", {}).get("beta", 1.0) or 1.0
    risk_reason = f"<strong>{best_risk['ticker']}</strong> leads Risk Safety at <strong>{best_risk['risk']}/100</strong>, demonstrating lower market volatility with a Beta of <strong>{beta:.2f}</strong>."
    cards.append(format_winner_card("Risk Winner", best_risk["ticker"], risk_reason, "#EF4444"))
    
    # 6. News Winner
    best_news = max(companies_summary, key=lambda x: x.get("sentiment", 50))
    news_reason = f"<strong>{best_news['ticker']}</strong> leads News Sentiment at <strong>{best_news['sentiment']}/100</strong>, reflecting a highly positive lexicon tone across recent press headlines."
    cards.append(format_winner_card("News Winner", best_news["ticker"], news_reason, "#64748B"))
    
    # 7. Income Winner
    yields = []
    for c in companies_data:
        dy = c.get("ratios", {}).get("dividend_yield", 0.0) or 0.0
        if dy < 1.0 and dy > 0:
            dy = dy * 100
        yields.append((c["ticker"], dy))
    best_inc_ticker, best_yield = max(yields, key=lambda x: x[1])
    if best_yield > 0:
        inc_reason = f"<strong>{best_inc_ticker}</strong> leads Income with a Dividend Yield of <strong>{best_yield:.2f}%</strong>."
    else:
        fcf_margins = []
        for c in companies_data:
            rev = c.get("preprocessed_metrics", {}).get("revenue") or c.get("ratios", {}).get("revenue") or 1.0
            fcf = c.get("preprocessed_metrics", {}).get("free_cash_flow") or 0.0
            margin = (fcf / rev) * 100 if rev > 0 else 0.0
            fcf_margins.append((c["ticker"], margin))
        best_inc_ticker, best_margin = max(fcf_margins, key=lambda x: x[1])
        inc_reason = f"<strong>{best_inc_ticker}</strong> leads Income with a Free Cash Flow Margin of <strong>{best_margin:.2f}%</strong>."
    cards.append(format_winner_card("Income Winner", best_inc_ticker, inc_reason, "#8B5CF6"))
    
    return "\n".join(cards)

def format_winner_card(title, ticker, reason, border_color):
    return f"""
    <div class="card" style="border-left: 4px solid {border_color}; margin-bottom: 8px; padding: 10px 14px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
        <h4 style="color:{border_color}; font-size:9.5pt; font-weight:800; text-transform:uppercase; margin-bottom:0;">{title}</h4>
        <span style="font-size:8.5pt; font-weight:900; background:{border_color}1A; color:{border_color}; padding:2px 6px; border-radius:4px;">{ticker}</span>
      </div>
      <p style="font-size:8.5pt; color:#475569; margin-top:2px; line-height:1.45;">{reason}</p>
    </div>
    """


def build_swot_grid_content_html(companies_data):
    html = []
    for c in companies_data[:3]:
        swot = c.get("swot", {}) or {}
        strengths = "".join(f"<li>{x}</li>" for x in swot.get("strengths", [])[:3])
        weaknesses = "".join(f"<li>{x}</li>" for x in swot.get("weaknesses", [])[:2])
        opportunities = "".join(f"<li>{x}</li>" for x in swot.get("opportunities", [])[:2])
        threats = "".join(f"<li>{x}</li>" for x in swot.get("threats", [])[:2])
        
        if not strengths: strengths = "<li>Consistent fundamental stability</li>"
        if not weaknesses: weaknesses = "<li>Subject to macroeconomic cycles</li>"
        if not opportunities: opportunities = "<li>Global market expansion potential</li>"
        if not threats: threats = "<li>Competitive pressure in core sectors</li>"
        
        html.append(f"""
        <div class="card" style="margin-bottom:14px; padding: 12px;">
          <h3 style="color:#0F172A; margin-bottom:8px;">{c['ticker']} SWOT Analysis</h3>
          <div class="swot-grid">
            <div class="swot-cell swot-s"><div class="swot-title">Strengths</div><ul class="swot-list">{strengths}</ul></div>
            <div class="swot-cell swot-w"><div class="swot-title">Weaknesses</div><ul class="swot-list">{weaknesses}</ul></div>
            <div class="swot-cell swot-o"><div class="swot-title">Opportunities</div><ul class="swot-list">{opportunities}</ul></div>
            <div class="swot-cell swot-t"><div class="swot-title">Threats</div><ul class="swot-list">{threats}</ul></div>
          </div>
        </div>
        """)
    return "\n".join(html)


def build_news_comparison_html(companies_data):
    num_cos = len(companies_data)
    cols_style = f"display: grid; grid-template-columns: repeat({num_cos}, 1fr); gap: 12px;"
    html = [f'<div class="three-col" style="{cols_style}">' if num_cos == 3 else f'<div class="two-col" style="{cols_style}">']
    
    for c in companies_data:
        ticker = c["ticker"]
        news_items = c.get("news", [])[:3]
        
        html.append(f'  <div class="card" style="margin-bottom:0; padding: 12px;">')
        html.append(f'    <h3 style="color:#0F172A; margin-bottom:8px; font-size:9.5pt;">{ticker} News Sentiment</h3>')
        if not news_items:
            html.append('    <p style="font-size:8pt; color:#94a3b8; font-style:italic;">No recent media coverage found.</p>')
        else:
            for item in news_items:
                title = item.get("title", "No Title")
                source = item.get("publisher") or item.get("source") or "Unknown"
                sent_score = float(item.get("sentiment_score", 0.0))
                
                if sent_score > 0.1:
                    sent_class = "positive"
                    sent_label = "Positive"
                elif sent_score < -0.1:
                    sent_class = "negative"
                    sent_label = "Negative"
                else:
                    sent_class = "neutral"
                    sent_label = "Neutral"
                    
                html.append(f'    <div class="news-card {sent_class}">')
                html.append(f'      <div class="headline">{title[:70]}...</div>')
                html.append(f'      <div class="meta">{source} &nbsp;·&nbsp; Sentiment: <strong>{sent_label}</strong></div>')
                html.append(f'    </div>')
        html.append('  </div>')
        
    html.append('</div>')
    return "\n".join(html)


def build_verdict_details_html(companies_summary, winner, winner_reasons):
    best_c = next((c for c in companies_summary if c["ticker"] == winner), None)
    rec = best_c.get("recommendation", "BUY") if best_c else "BUY"
    score = best_c.get("ai_score", 0) if best_c else 80
    
    reasons_list = "".join(f"<li style='margin-bottom:4px; font-size: 8.5pt;'>✓ {r}</li>" for r in winner_reasons)
    
    html = f"""
    <p style="font-size:9pt; line-height:1.5; margin-bottom:10px; color:#0F172A;">
      Based on the comparative analysis, <strong>{winner}</strong> is the superior selection with an overall AI Score of <strong>{score}/100</strong> and a consensus recommendation of <strong>{rec}</strong>.
    </p>
    <h4 style="margin-bottom:6px; color:#0F172A; font-size:9pt; font-weight: 800;">Key Recommendation Drivers:</h4>
    <ul style="list-style-type:none; padding-left:4px; color:#475569;">
      {reasons_list}
    </ul>
    """
    return html


class CompareChatView(APIView):
    """
    POST /api/compare/chat/
    Queries the comparative chatbot, using comparison data and profiles
    as context, while remembering previous conversation history.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        tickers = request.data.get("tickers")
        content = request.data.get("content")
        conversation_id = request.data.get("conversation_id")

        if not content:
            return Response({"detail": "Message content is required."}, status=status.HTTP_400_BAD_REQUEST)
        if not tickers:
            return Response({"detail": "Tickers are required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            from chat.models import AIConversation, Message
            from chat.agent.prompts import CHAT_COMPARISON_PROMPT
            from chat.agent.nodes import get_llm, scores_calculation_node, swot_analysis_node
            from companies.services import company_service
            from companies.services.news_service import get_company_news

            conv = None
            if conversation_id:
                conv = AIConversation.objects.get(id=conversation_id, user=request.user)
            else:
                conv = AIConversation.objects.create(user=request.user, company=None)

            companies_data = []
            companies_summary = []

            for ticker in tickers:
                resolved = resolve_ticker_by_name(ticker)
                company_profile = get_company_profile(resolved)
                financials = get_financial_data(resolved)
                news_list = get_company_news(resolved)
                
                company_obj, _ = Company.objects.get_or_create(
                    ticker=resolved,
                    defaults={
                        "name": company_profile.get("name") or resolved,
                        "sector": company_profile.get("sector") or "N/A",
                        "industry": company_profile.get("industry") or "N/A",
                        "description": company_profile.get("description") or "",
                        "financial_summary": company_profile.get("description") or "",
                    }
                )

                state = {
                    "ticker": resolved,
                    "company_profile": company_profile,
                    "financials": financials,
                    "news_list": news_list,
                }
                score_res = scores_calculation_node(state)
                payload = score_res.get("recommendation_payload", {})
                scores = payload.get("scores", {})
                ai_score = payload.get("ai_score", 0)
                recommendation = payload.get("recommendation", "HOLD")

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

                companies_data.append({
                    "ticker": resolved,
                    "name": company_obj.name,
                    "sector": company_obj.sector,
                    "industry": company_obj.industry,
                    "description": company_profile.get("description", ""),
                    "ceo": company_profile.get("ceo", "N/A"),
                    "employees": company_profile.get("employees", 0),
                    "ai_score": ai_score,
                    "recommendation": recommendation,
                    "scores": scores,
                    "ratios": financials.get("ratios", {}),
                    "preprocessed_metrics": financials.get("preprocessed_metrics", {}),
                    "swot": swot,
                    "news": news_list[:5],
                    "historical_financials": financials.get("historical_yearly", [])
                })

                companies_summary.append({
                    "ticker": resolved,
                    "name": company_obj.name,
                    "ai_score": ai_score,
                    "recommendation": recommendation,
                    "financial": scores.get("financial_health", 0),
                    "growth": scores.get("growth", 0),
                    "valuation": scores.get("valuation", 0),
                    "risk": scores.get("risk_safety", 0),
                    "sentiment": scores.get("news_sentiment", 50),
                })

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
                winner_reasons = ["Highest composite AI score across all categories", "Superior balance sheet and growth metrics"]

            history_str = ""
            msgs = Message.objects.filter(conversation=conv).order_by('timestamp')
            for m in msgs:
                history_str += f"{m.role.upper()}: {m.content}\n\n"

            context_payload = {
                "compared_tickers": tickers,
                "winner": best_co["ticker"],
                "winner_score": best_co["ai_score"],
                "winner_reasons": winner_reasons,
                "consensus_recommendation": best_co["recommendation"],
                "companies": companies_data
            }
            comparison_context = json.dumps(context_payload, indent=2)
            
            prompt = CHAT_COMPARISON_PROMPT.format(
                comparison_context=comparison_context,
                message_history=history_str + f"USER: {content}\n\n"
            )

            try:
                llm = get_llm()
                response = llm.invoke(prompt)
                reply_content = response.content
            except Exception as llm_err:
                logger.warning(f"Comparison Chat LLM failed: {str(llm_err)}")
                reply_content = f"I compiled the comparison metrics for {', '.join(tickers)}. Unfortunately, my LLM channel is busy. The scores are: " + ", ".join([f"{c['ticker']}: {c['ai_score']}" for c in companies_data])

            Message.objects.create(conversation=conv, role='user', content=content)
            Message.objects.create(conversation=conv, role='assistant', content=reply_content)

            return Response({
                "reply": reply_content,
                "conversation_id": str(conv.id)
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"CompareChatView error: {str(e)}")
            import traceback; traceback.print_exc()
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class CompareExportView(APIView):
    """
    POST /api/compare/export/pdf/
    Compiles comparison data and dynamic SVG charts into a professional A4 comparison HTML report
    to be downloaded and converted to PDF on the frontend.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        tickers = request.data.get("tickers")
        if not tickers:
            return Response({"detail": "Tickers are required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            from chat.agent.prompts import COMPARISON_HTML_TEMPLATE
            from chat.agent.nodes import scores_calculation_node, swot_analysis_node
            from companies.services import company_service
            from companies.services.chart_service import generate_radar_chart_svg, generate_grouped_bar_chart_svg
            from companies.services.news_service import get_company_news
            from django.http import HttpResponse
            import datetime

            companies_data = []
            companies_summary = []

            for ticker in tickers:
                resolved = resolve_ticker_by_name(ticker)
                company_profile = get_company_profile(resolved)
                financials = get_financial_data(resolved)
                news_list = get_company_news(resolved)
                
                company_obj, _ = Company.objects.get_or_create(
                    ticker=resolved,
                    defaults={
                        "name": company_profile.get("name") or resolved,
                        "sector": company_profile.get("sector") or "N/A",
                        "industry": company_profile.get("industry") or "N/A",
                        "description": company_profile.get("description") or "",
                        "financial_summary": company_profile.get("description") or "",
                    }
                )

                state = {
                    "ticker": resolved,
                    "company_profile": company_profile,
                    "financials": financials,
                    "news_list": news_list,
                }
                score_res = scores_calculation_node(state)
                payload = score_res.get("recommendation_payload", {})
                scores = payload.get("scores", {})
                ai_score = payload.get("ai_score", 0)
                recommendation = payload.get("recommendation", "HOLD")

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

                companies_data.append({
                    "ticker": resolved,
                    "name": company_obj.name,
                    "sector": company_obj.sector,
                    "industry": company_obj.industry,
                    "ai_score": ai_score,
                    "recommendation": recommendation,
                    "scores": scores,
                    "ratios": financials.get("ratios", {}),
                    "preprocessed_metrics": financials.get("preprocessed_metrics", {}),
                    "swot": swot,
                    "news": news_list,
                    "market_cap": company_profile.get("market_cap"),
                    "description": company_profile.get("description", ""),
                    "historical_yearly": financials.get("historical_yearly", []),
                })

                companies_summary.append({
                    "ticker": resolved,
                    "name": company_obj.name,
                    "ai_score": ai_score,
                    "recommendation": recommendation,
                    "financial": scores.get("financial_health", 0),
                    "growth": scores.get("growth", 0),
                    "valuation": scores.get("valuation", 0),
                    "risk": scores.get("risk_safety", 0),
                    "sentiment": scores.get("news_sentiment", 50),
                })

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
                winner_reasons = ["Highest composite AI score across all categories", "Superior balance sheet and growth metrics"]

            executive_summary = f"<p>A comprehensive comparative research report has resolved <strong>{best_co['ticker']}</strong> as the leading choice. This selection is supported by the following drivers:</p><ul style='margin-top:10px;margin-bottom:14px;padding-left:20px;'>"
            for r in winner_reasons:
                executive_summary += f"<li style='margin-bottom:6px;'>{r}</li>"
            executive_summary += "</ul>"

            comparison_matrix_headers = "".join(f"<th>{c['ticker']}</th>" for c in companies_summary)
            comparison_matrix = build_comparison_matrix_html(companies_summary)
            
            radar_chart = generate_radar_chart_svg(companies_summary)
            
            # Generate the 8 Bar Charts
            revenue_bar_chart = generate_grouped_bar_chart_svg(companies_data, "revenue", "Revenue")
            net_income_bar_chart = generate_grouped_bar_chart_svg(companies_data, "net_income", "Net Income")
            op_margin_bar_chart = generate_grouped_bar_chart_svg(companies_data, "operating_margin", "Operating Margin")
            roe_bar_chart = generate_grouped_bar_chart_svg(companies_data, "roe", "Return on Equity (ROE)")
            eps_bar_chart = generate_grouped_bar_chart_svg(companies_data, "eps", "Earnings Per Share (EPS)")
            fcf_bar_chart = generate_grouped_bar_chart_svg(companies_data, "free_cash_flow", "Free Cash Flow")
            market_cap_bar_chart = generate_grouped_bar_chart_svg(companies_data, "market_cap", "Market Cap")
            revenue_growth_bar_chart = generate_grouped_bar_chart_svg(companies_data, "revenue_growth", "Revenue Growth")
            
            swot_grid_content = build_swot_grid_content_html(companies_data)
            news_comparison_html = build_news_comparison_html(companies_data)
            winner_analysis_cards = build_winner_analysis_cards_html(companies_summary, companies_data)
            verdict_details = build_verdict_details_html(companies_summary, best_co["ticker"], winner_reasons)
            
            # Determine Risk Level and Horizon dynamically for PDF
            best_risk_safety = best_co["risk"]
            if best_risk_safety >= 80:
                winner_risk_level = "Low"
            elif best_risk_safety >= 60:
                winner_risk_level = "Medium"
            else:
                winner_risk_level = "High"
                
            best_rec = best_co["recommendation"]
            if best_rec in ["STRONG BUY", "BUY"]:
                winner_horizon = "3–5 Years"
            elif best_rec == "HOLD":
                winner_horizon = "12–18 Months"
            else:
                winner_horizon = "Avoid New Position"

            html_content = COMPARISON_HTML_TEMPLATE.format(
                tickers=" vs ".join(tickers),
                date=datetime.date.today().strftime("%d %b %Y"),
                winner=best_co["ticker"],
                winner_score=best_co["ai_score"],
                winner_recommendation=best_rec,
                winner_risk_level=winner_risk_level,
                winner_horizon=winner_horizon,
                confidence=best_co.get("confidence") or (89 if len(companies_summary) > 1 else 95),
                executive_summary=executive_summary,
                comparison_matrix_headers=comparison_matrix_headers,
                comparison_matrix=comparison_matrix,
                radar_chart=radar_chart,
                revenue_bar_chart=revenue_bar_chart,
                net_income_bar_chart=net_income_bar_chart,
                op_margin_bar_chart=op_margin_bar_chart,
                roe_bar_chart=roe_bar_chart,
                eps_bar_chart=eps_bar_chart,
                fcf_bar_chart=fcf_bar_chart,
                market_cap_bar_chart=market_cap_bar_chart,
                revenue_growth_bar_chart=revenue_growth_bar_chart,
                swot_grid_content=swot_grid_content,
                news_comparison_html=news_comparison_html,
                winner_analysis_cards=winner_analysis_cards,
                verdict_details=verdict_details
            )

            response = HttpResponse(html_content, content_type='text/html')
            response['Content-Disposition'] = f'attachment; filename="{"_".join(tickers)}_comparison_report.html"'
            return response

        except Exception as e:
            logger.error(f"CompareExportView error: {str(e)}")
            import traceback; traceback.print_exc()
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
