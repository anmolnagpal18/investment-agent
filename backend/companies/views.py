from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import Company
from .serializers import CompanySerializer
from .services.company_service import get_company_profile
from .services.financial_service import get_financial_data
from .services.news_service import get_company_news
from .services.related_company_service import get_related_companies
from .services.chart_service import get_chart_data

class CompanyViewSet(viewsets.ModelViewSet):
    """
    Exposes stock profile lists, creation, and individual metric service hooks.
    """
    queryset = Company.objects.all()
    serializer_class = CompanySerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'ticker'  # Support lookup by ticker (e.g. /api/companies/AAPL/)
    lookup_value_regex = '[^/]+'  # Enable matching for tickers with dots like RELIANCE.NS

    @action(detail=False, methods=['get'], url_path='market-summary')
    def get_market_summary_endpoint(self, request):
        """
        Action endpoint to fetch live values for indices (S&P 500, NASDAQ, Dow Jones, NIFTY 50, SENSEX).
        """
        from .services.company_service import get_market_summary
        try:
            data = get_market_summary()
            if data is None:
                return Response({"detail": "Unable to fetch latest market data"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            return Response(data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"detail": f"Unable to fetch latest market data: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'], url_path='trending')
    def get_trending_endpoint(self, request):
        """
        Action endpoint to fetch trending stocks from yfinance.
        """
        from .services.company_service import get_trending_stocks
        try:
            data = get_trending_stocks()
            if data is None:
                return Response({"detail": "Unable to fetch trending stocks data"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            return Response(data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'], url_path='dashboard-news')
    def get_dashboard_news_endpoint(self, request):
        """
        Action endpoint to fetch broad market financial news for the dashboard feed.
        """
        from .services.news_service import get_dashboard_news
        try:
            data = get_dashboard_news()
            if data is None:
                return Response({"detail": "Unable to fetch dashboard news feed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            return Response(data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'], url_path='profile')
    def get_profile(self, request, ticker=None):
        """
        Action endpoint to fetch resolved metadata profiles.
        """
        try:
            data = get_company_profile(ticker)
            return Response(data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'], url_path='financials')
    def get_financials(self, request, ticker=None):
        """
        Action endpoint to fetch parsed financial sheets and ratios.
        """
        try:
            data = get_financial_data(ticker)
            return Response(data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'], url_path='news')
    def get_news(self, request, ticker=None):
        """
        Action endpoint to fetch company news.
        """
        try:
            data = get_company_news(ticker)
            return Response(data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'], url_path='related')
    def get_related(self, request, ticker=None):
        """
        Action endpoint to fetch peer recommended tickers.
        """
        try:
            data = get_related_companies(ticker)
            return Response(data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'], url_path='charts')
    def get_charts(self, request, ticker=None):
        """
        Action endpoint to fetch charts data structures directly usable by Recharts.
        """
        try:
            data = get_chart_data(ticker)
            return Response(data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
