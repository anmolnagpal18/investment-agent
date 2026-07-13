import yfinance as yf
from companies.services.company_service import resolve_ticker_by_name

def calculate_dcf(ticker_or_name, growth_rate=0.05, discount_rate=0.09, terminal_growth=0.02, years=5):
    """
    Computes a simplified Discounted Cash Flow (DCF) valuation model.
    """
    ticker = resolve_ticker_by_name(ticker_or_name)
    if not ticker:
        return {"error": "Could not resolve ticker"}
        
    try:
        stock = yf.Ticker(ticker)
        cf = stock.cashflow
        info = stock.info
        
        # 1. Extract latest Free Cash Flow (FCF)
        # Safely search cash flow indices
        fcf_row = None
        for name in ['Free Cash Flow', 'freeCashFlow']:
            if cf is not None and name in cf.index:
                fcf_row = cf.loc[name]
                break
                
        if fcf_row is None or fcf_row.empty:
            # Fallback to Operating Cash Flow minus CapEx approximation
            ocf_row = None
            for ocf_name in ['Operating Cash Flow', 'operatingCashFlow', 'Total Cash From Operating Activities']:
                if cf is not None and ocf_name in cf.index:
                    ocf_row = cf.loc[ocf_name]
                    break
            if ocf_row is not None and not ocf_row.empty:
                # Approximate FCF as 80% of Operating Cash Flow
                latest_fcf = float(ocf_row.iloc[0]) * 0.8
            else:
                # Hard fallback to Net Income proxy
                latest_fcf = info.get("marketCap", 0) * 0.05 # assume 5% FCF Yield
        else:
            latest_fcf = float(fcf_row.iloc[0])
            
        if latest_fcf <= 0:
            # Adjust if negative
            latest_fcf = info.get("marketCap", 0) * 0.03 # assume 3% positive FCF
            
        # 2. Project future Cash Flows
        projected_fcfs = []
        discount_factors = []
        discounted_fcfs = []
        
        current_fcf = latest_fcf
        for year in range(1, years + 1):
            current_fcf = current_fcf * (1 + growth_rate)
            factor = (1 + discount_rate) ** year
            discounted_val = current_fcf / factor
            
            projected_fcfs.append(round(current_fcf, 2))
            discount_factors.append(round(factor, 4))
            discounted_fcfs.append(round(discounted_val, 2))
            
        # 3. Terminal Value
        terminal_value = (current_fcf * (1 + terminal_growth)) / (discount_rate - terminal_growth)
        discounted_terminal_value = terminal_value / ((1 + discount_rate) ** years)
        
        # 4. Enterprise Value
        enterprise_value = sum(discounted_fcfs) + discounted_terminal_value
        
        # 5. Equity Value & Intrinsic Price
        total_debt = info.get("totalDebt", 0) or 0
        total_cash = info.get("totalCash", 0) or info.get("cashAndCashEquivalents", 0) or 0
        equity_value = enterprise_value + total_cash - total_debt
        
        shares_outstanding = info.get("sharesOutstanding")
        if shares_outstanding and shares_outstanding > 0:
            intrinsic_price = equity_value / shares_outstanding
        else:
            intrinsic_price = 0.0
            
        return {
            "ticker": ticker,
            "latest_fcf": round(latest_fcf, 2),
            "projected_fcfs": projected_fcfs,
            "discounted_fcfs": discounted_fcfs,
            "terminal_value": round(terminal_value, 2),
            "discounted_terminal_value": round(discounted_terminal_value, 2),
            "enterprise_value": round(enterprise_value, 2),
            "equity_value": round(equity_value, 2),
            "shares_outstanding": shares_outstanding,
            "intrinsic_price": round(intrinsic_price, 2) if intrinsic_price > 0 else "N/A"
        }
    except Exception as e:
        return {"error": f"Failed to compute DCF model: {str(e)}"}
