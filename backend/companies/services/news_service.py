import time
import yfinance as yf
import logging

logger = logging.getLogger(__name__)
from rest_framework.exceptions import ValidationError
from .company_service import resolve_ticker_by_name

def calculate_lexicon_sentiment(title):
    """
    Computes a simplified lexicon-based sentiment value (-1.0 to 1.0) and label
    for headlines. Evaluates headline tone to classify articles as positive, negative, or neutral.
    """
    positive_words = {'beat', 'surge', 'rise', 'grow', 'gain', 'profit', 'up', 'bullish', 'high', 'win', 'boost', 'upgrade', 'expand', 'success'}
    negative_words = {'miss', 'decline', 'fall', 'drop', 'loss', 'down', 'bearish', 'low', 'warn', 'downgrade', 'shrink', 'fail', 'plunge', 'deficit'}
    
    score = 0
    words = title.lower().split()
    for word in words:
        # Strip punctuation
        clean_word = "".join(char for char in word if char.isalnum())
        if clean_word in positive_words:
            score += 0.3
        elif clean_word in negative_words:
            score -= 0.3
            
    # Clip score
    score = max(-1.0, min(1.0, score))
    
    if score > 0.1:
        label = "Positive"
    elif score < -0.1:
        label = "Negative"
    else:
        label = "Neutral"
        
    return {
        "score": round(score, 2),
        "label": label
    }


def get_company_news(ticker_or_name):
    """
    Aggregates, parses, and formats the latest corporate news items for a stock.
    Removes duplicates, filters out empty articles, validates URLs, and provides clean fallbacks.
    """
    ticker = resolve_ticker_by_name(ticker_or_name)
    if not ticker:
        raise ValidationError("Ticker or company name cannot be resolved.")

    try:
        import concurrent.futures
        def fetch_news():
            stock = yf.Ticker(ticker)
            return stock.news
            
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(fetch_news)
            raw_news = future.result(timeout=10.0)

        if not raw_news:
            return []

        formatted_news = []
        seen_titles = set()
        seen_urls = set()

        for item in raw_news:
            if not isinstance(item, dict):
                continue

            content = item.get("content", item)
            if not isinstance(content, dict):
                content = item

            # 1. Title Parsing & Empty Filter
            title = content.get("title") or content.get("headline") or ""
            title = title.strip()
            if not title or title.lower() in ["no title", "untitled", "n/a", "not available", "none"]:
                continue

            # 2. URL Parsing & Validation
            url = ""
            canonical_url_dict = content.get("canonicalUrl")
            if isinstance(canonical_url_dict, dict):
                url = canonical_url_dict.get("url") or ""
            if not url:
                click_through_dict = content.get("clickThroughUrl")
                if isinstance(click_through_dict, dict):
                    url = click_through_dict.get("url") or ""
            if not url:
                url = content.get("link") or content.get("url") or ""
            url = url.strip()
            
            # URL Validation
            if not url or not (url.startswith("http://") or url.startswith("https://")):
                continue

            # 3. Publisher Parsing
            publisher = ""
            provider_dict = content.get("provider")
            if isinstance(provider_dict, dict):
                publisher = provider_dict.get("displayName") or ""
            if not publisher:
                publisher = content.get("publisher") or content.get("source") or content.get("provider") or ""
            
            if isinstance(publisher, dict):
                publisher = publisher.get("displayName") or publisher.get("name") or ""

            publisher = str(publisher).strip()
            if not publisher or publisher.lower() in ["unknown source", "unknown", "n/a", "not available", "none"]:
                publisher = "Financial News"

            # 4. Deduplication
            norm_title = title.lower().strip()
            norm_url = url.lower().strip()
            if norm_title in seen_titles or (norm_url and norm_url in seen_urls):
                continue

            seen_titles.add(norm_title)
            if norm_url:
                seen_urls.add(norm_url)

            # 5. Timestamp/Publication Date Parsing
            pub_time_raw = content.get("pubDate") or content.get("providerPublishTime") or content.get("publishDate")
            if pub_time_raw:
                try:
                    val = float(pub_time_raw)
                    pub_date = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(val))
                except (ValueError, TypeError):
                    pub_time_str = str(pub_time_raw)
                    cleaned = pub_time_str.replace('T', ' ').replace('Z', '')
                    if '.' in cleaned:
                        cleaned = cleaned.split('.')[0]
                    pub_date = cleaned
            else:
                pub_date = time.strftime('%Y-%m-%d %H:%M:%S')

            # 6. Summary Parsing
            summary = content.get("summary") or content.get("description") or title
            summary = summary.strip()

            # 7. Thumbnail parsing
            thumbnail_url = ""
            thumbnail_dict = content.get("thumbnail")
            if isinstance(thumbnail_dict, dict):
                resolutions = thumbnail_dict.get("resolutions", [])
                if resolutions and isinstance(resolutions, list):
                    thumbnail_url = resolutions[0].get("url") or ""
                if not thumbnail_url:
                    thumbnail_url = thumbnail_dict.get("originalUrl") or ""

            # 8. Sentiment Analysis
            sentiment_data = calculate_lexicon_sentiment(title)

            # 9. Category resolution
            category = "Markets"
            # Fuzzy categorize based on headline topics
            title_lower = title.lower()
            if "ai" in title_lower or "tech" in title_lower or "chip" in title_lower or "software" in title_lower:
                category = "Technology"
            elif "fed" in title_lower or "rate" in title_lower or "inflation" in title_lower:
                category = "Macroeconomy"
            elif "sue" in title_lower or "lawsuit" in title_lower or "court" in title_lower:
                category = "Legal"
            elif "earning" in title_lower or "quarter" in title_lower or "revenue" in title_lower:
                category = "Earnings"

            formatted_news.append({
                "title": title,
                "summary": summary,
                "publisher": publisher,
                "source": publisher, # for backward compatibility
                "published_at": pub_date,
                "date": pub_date, # for backward compatibility
                "thumbnail": thumbnail_url,
                "url": url,
                "sentiment": sentiment_data["label"],
                "sentiment_score": sentiment_data["score"],
                "ticker": ticker.upper(),
                "category": category
            })

        return formatted_news

    except Exception as e:
        raise ValidationError(f"Failed to fetch news for '{ticker}': {str(e)}")


def get_dashboard_news():
    """
    Retrieves broad-market financial news using SPY index feed.
    Caches the results for 60 seconds to optimize performance.
    """
    from django.core.cache import cache
    
    cached_news = cache.get("dashboard_news_cache")
    if cached_news:
        return cached_news
        
    try:
        news_data = get_company_news("SPY")
        if news_data:
            cache.set("dashboard_news_cache", news_data, timeout=60)
            return news_data
    except Exception as e:
        logger.error("Failed to fetch dashboard news: %s", e)
        
    return None

