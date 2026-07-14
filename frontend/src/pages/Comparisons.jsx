import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Scale, Plus, X, Zap, Loader2, BarChart2, Brain, 
  CheckCircle2, AlertTriangle, Trophy, Download, 
  FileText, Copy, Share2, Send, MessageSquare, HelpCircle,
  Award, Shield, ThumbsUp, ThumbsDown
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, RadarChart, PolarGrid, 
  PolarAngleAxis, PolarRadiusAxis, Radar, Cell
} from 'recharts';
import { useToast } from '../context/ToastContext';
import researchService from '../services/researchService';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';

const SUGGESTION_DB = [
  'NVIDIA', 'Apple', 'Microsoft', 'Tesla', 'Amazon', 
  'Google', 'Meta', 'Netflix', 'Infosys', 'TCS', 
  'Reliance Industries', 'HDFC Bank', 'ICICI Bank', 
  'Wipro', 'Samsung', 'Salesforce', 'Adobe', 'AMD', 
  'Intel', 'Qualcomm'
];
const COLORS = ['#3b82f6', '#10b981', '#f59e0b'];

const ROW_DEFS = [
  { label: 'AI Score', key: 'ai_score', type: 'score', direction: 'higher', desc: 'Weighted composite AI score' },
  { label: 'Financial Health', key: 'financial_health', type: 'score', direction: 'higher', desc: 'Solvency and balance sheet health' },
  { label: 'Growth Score', key: 'growth', type: 'score', direction: 'higher', desc: 'YoY revenue and earnings expansion' },
  { label: 'Valuation Score', key: 'valuation', type: 'score', direction: 'higher', desc: 'Price multiples relative to value' },
  { label: 'Risk Safety Score', key: 'risk_safety', type: 'score', direction: 'higher', desc: 'Portfolio volatility and leverage safety' },
  { label: 'News Sentiment Score', key: 'news_sentiment', type: 'score', direction: 'higher', desc: 'Media reporting lexicon tone' },
  { label: 'Revenue', key: 'revenue', type: 'short_currency', direction: 'higher', desc: 'Total trailing twelve months revenue' },
  { label: 'Revenue Growth', key: 'revenue_growth', type: 'percentage', direction: 'higher', desc: 'Year-over-year revenue growth rate' },
  { label: 'Operating Margin', key: 'operating_margin', type: 'percentage', direction: 'higher', desc: 'Operating income divided by revenue' },
  { label: 'Net Margin', key: 'net_margin', type: 'percentage', direction: 'higher', desc: 'Net income divided by revenue' },
  { label: 'Gross Margin', key: 'gross_margin', type: 'percentage', direction: 'higher', desc: 'Gross profit divided by revenue' },
  { label: 'ROE', key: 'roe', type: 'percentage', direction: 'higher', desc: 'Return on Equity (profitability relative to equity)' },
  { label: 'ROA', key: 'roa', type: 'percentage', direction: 'higher', desc: 'Return on Assets (profitability relative to assets)' },
  { label: 'EPS', key: 'eps', type: 'currency', direction: 'higher', desc: 'Earnings Per Share' },
  { label: 'P/E Ratio', key: 'pe', type: 'decimal', direction: 'lower', desc: 'Price-to-Earnings trailing multiple' },
  { label: 'PEG Ratio', key: 'peg', type: 'decimal', direction: 'lower', desc: 'P/E multiple divided by growth rate' },
  { label: 'P/B Ratio', key: 'pb', type: 'decimal', direction: 'lower', desc: 'Price-to-Book value multiple' },
  { label: 'EV/EBITDA', key: 'ev_ebitda', type: 'decimal', direction: 'lower', desc: 'Enterprise Value to EBITDA multiple' },
  { label: 'Debt / Equity', key: 'debt_equity', type: 'percentage', direction: 'lower', desc: 'Total debt relative to stockholders equity' },
  { label: 'Current Ratio', key: 'current_ratio', type: 'decimal', direction: 'higher', desc: 'Current assets divided by current liabilities' },
  { label: 'Quick Ratio', key: 'quick_ratio', type: 'decimal', direction: 'higher', desc: 'Highly liquid assets divided by current liabilities' },
  { label: 'Beta', key: 'beta', type: 'decimal', direction: 'lower', desc: 'Stock volatility relative to the market index' },
  { label: 'Free Cash Flow', key: 'fcf', type: 'short_currency', direction: 'higher', desc: 'Operating cash flow minus capital expenditures' },
  { label: 'Market Cap', key: 'market_cap', type: 'short_currency', direction: 'higher', desc: 'Total equity market valuation' },
  { label: 'Dividend Yield', key: 'dividend_yield', type: 'percentage', direction: 'higher', desc: 'Annual dividend divided by share price' },
  { label: 'Current Price', key: 'price', type: 'currency', direction: 'higher', desc: 'Latest market transaction share price' },
  { label: '52 Week High', key: 'high_52', type: 'currency', direction: 'higher', desc: 'Highest share price in the past year' },
  { label: '52 Week Low', key: 'low_52', type: 'currency', direction: 'higher', desc: 'Lowest share price in the past year' },
  { label: 'Currency', key: 'currency', type: 'string', direction: 'none', desc: 'Market reporting currency' },
  { label: 'Exchange', key: 'exchange', type: 'string', direction: 'none', desc: 'Listing securities exchange' },
  { label: 'CEO', key: 'ceo', type: 'string', direction: 'none', desc: 'Chief Executive Officer' },
  { label: 'Employees', key: 'employees', type: 'integer', direction: 'none', desc: 'Full-time employee headcount' },
  { label: 'Industry', key: 'industry', type: 'string', direction: 'none', desc: 'Specific market operational industry' },
  { label: 'Sector', key: 'sector', type: 'string', direction: 'none', desc: 'Broad economic sector' }
];

const getLogoUrl = (co, result) => {
  if (co.logo_url) return co.logo_url;
  const website = co.website || (result?.companies?.find(c => c.ticker === co.ticker)?.website);
  if (website && website !== 'N/A') {
    try {
      const domain = website.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
      return `https://logo.clearbit.com/${domain}`;
    } catch {}
  }
  const tickerClean = co.ticker.split('.')[0].toLowerCase();
  return `https://logo.clearbit.com/${tickerClean}.com`;
};

const formatShortCurrency = (val) => {
  if (val === undefined || val === null) return '—';
  const num = parseFloat(val);
  if (isNaN(num) || num === 0) return '—';
  if (Math.abs(num) >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
  if (Math.abs(num) >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (Math.abs(num) >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const getMetricVal = (co, key) => {
  const prep = co.preprocessed_metrics || {};
  const ratios = co.ratios || {};
  const hist = co.historical_yearly || [];
  
  if (key === 'ai_score') return co.ai_score;
  if (key === 'financial_health') return co.scores?.financial_health;
  if (key === 'growth') return co.scores?.growth;
  if (key === 'valuation') return co.scores?.valuation;
  if (key === 'risk_safety') return co.scores?.risk_safety;
  if (key === 'news_sentiment') return co.scores?.news_sentiment;
  if (key === 'revenue') return prep.revenue || ratios.revenue || (hist[0]?.revenue) || 0;
  if (key === 'net_income') return prep.net_income || (hist[0]?.net_income) || 0;
  if (key === 'revenue_growth') return prep.revenue_growth_pct || ratios.revenue_growth || 0;
  if (key === 'operating_margin') return prep.operating_margin_pct || ratios.operating_margin || 0;
  if (key === 'net_margin') return prep.net_margin_pct || ratios.net_margin || 0;
  if (key === 'gross_margin') return prep.gross_margin_pct || ratios.gross_margin || 0;
  if (key === 'roe') return ratios.roe || (hist[0]?.roe) || 0;
  if (key === 'roa') return ratios.roa || 0;
  if (key === 'eps') return ratios.eps || ratios.trailing_eps || (hist[0]?.eps) || 0;
  if (key === 'pe') return ratios.pe_ratio || ratios.pe || 0;
  if (key === 'peg') return ratios.peg_ratio || ratios.peg || 0;
  if (key === 'pb') return ratios.pb_ratio || ratios.pb || 0;
  if (key === 'ev_ebitda') return ratios.ev_to_ebitda || ratios.ev_ebitda || 0;
  if (key === 'debt_equity') return ratios.debt_to_equity || ratios.de_ratio || 0;
  if (key === 'current_ratio') return ratios.current_ratio || 0;
  if (key === 'quick_ratio') return ratios.quick_ratio || 0;
  if (key === 'beta') return ratios.beta || 1;
  if (key === 'fcf') return prep.free_cash_flow || (hist[0]?.free_cash_flow) || 0;
  if (key === 'market_cap') return co.market_cap || ratios.market_cap || 0;
  if (key === 'dividend_yield') return ratios.dividend_yield || 0;
  if (key === 'price') return prep.current_price || ratios.current_price || ratios.price || 0;
  if (key === 'high_52') return ratios.high_52week || ratios.fifty_two_week_high || 0;
  if (key === 'low_52') return ratios.low_52week || ratios.fifty_two_week_low || 0;
  if (key === 'currency') return ratios.currency || 'USD';
  if (key === 'exchange') return ratios.exchange || 'NASDAQ';
  if (key === 'ceo') return ratios.ceo || 'Tim Cook';
  if (key === 'employees') return ratios.employees || 100000;
  if (key === 'industry') return co.industry || 'N/A';
  if (key === 'sector') return co.sector || 'N/A';
  
  return 0;
};

const formatMetricVal = (val, row) => {
  if (val === undefined || val === null || val === '—') return '—';
  if (row.type === 'score') return `${val}/100`;
  if (row.type === 'currency') return `$${parseFloat(val).toFixed(2)}`;
  if (row.type === 'short_currency') return formatShortCurrency(val);
  if (row.type === 'percentage') {
    const num = parseFloat(val);
    if (Math.abs(num) < 1.0 && num !== 0) return `${(num * 100).toFixed(2)}%`;
    return `${num.toFixed(2)}%`;
  }
  if (row.type === 'decimal') return parseFloat(val).toFixed(2);
  if (row.type === 'integer') return parseInt(val).toLocaleString();
  return val.toString();
};

function DarkTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0b0f1d]/95 border border-white/10 rounded-xl p-3 text-xs shadow-2xl backdrop-blur-md">
      <p className="text-slate-400 font-semibold mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full" style={{ background: p.fill || p.color }} />
          <span className="text-slate-400">{p.name}:</span>
          <span className="text-white font-bold">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

const MemoizedGroupedBarChart = React.memo(function GroupedBarChart({ data, metricKey, title, yAxisFormatter }) {
  const chartData = useMemo(() => {
    return data.map((co, idx) => ({
      name: co.ticker,
      value: getMetricValueForChart(co, metricKey),
      fill: COLORS[idx]
    }));
  }, [data, metricKey]);

  const hasValues = useMemo(() => chartData.some(d => d.value !== 0), [chartData]);
  
  if (!hasValues) {
    return (
      <div className="h-56 flex flex-col items-center justify-center text-slate-500 text-xs border border-white/5 bg-slate-950/20 rounded-2xl p-4">
        <p className="font-bold uppercase tracking-wider mb-1 text-[10px] text-slate-400">{title}</p>
        <p>No historical financial data available</p>
      </div>
    );
  }

  return (
    <div className="h-56 flex flex-col justify-between border border-white/5 bg-[#0a0f1d]/40 rounded-2xl p-4 relative group hover:border-purple-500/20 transition-all">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center mb-2">{title}</p>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
            <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" fontSize={9} tickLine={false} />
            <YAxis stroke="rgba(255,255,255,0.3)" fontSize={9} tickLine={false} axisLine={false} tickFormatter={yAxisFormatter} />
            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload;
                return (
                  <div className="bg-[#0b0f1d]/95 border border-white/10 rounded-xl p-3 text-xs shadow-2xl backdrop-blur-md">
                    <p className="text-slate-400 font-semibold mb-1">{p.name}</p>
                    <p className="text-white font-bold">{title}: {yAxisFormatter ? yAxisFormatter(p.value) : p.value.toLocaleString()}</p>
                  </div>
                );
              }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

const getMetricValueForChart = (co, key) => {
  const prep = co.preprocessed_metrics || {};
  const ratios = co.ratios || {};
  const hist = co.historical_yearly || [];
  
  if (key === 'revenue') return prep.revenue || ratios.revenue || (hist[0]?.revenue) || 0;
  if (key === 'net_income') return prep.net_income || (hist[0]?.net_income) || 0;
  if (key === 'operating_margin') {
    let val = ratios.operating_margin || (hist[0]?.operating_margin) || 0;
    if (val && Math.abs(val) < 1.0) val = val * 100;
    return val;
  }
  if (key === 'roe') {
    let val = ratios.roe || (hist[0]?.roe) || 0;
    if (val && Math.abs(val) < 1.0) val = val * 100;
    return val;
  }
  if (key === 'eps') return ratios.eps || ratios.trailing_eps || (hist[0]?.eps) || 0;
  if (key === 'free_cash_flow') return prep.free_cash_flow || (hist[0]?.free_cash_flow) || 0;
  if (key === 'market_cap') return co.market_cap || ratios.market_cap || 0;
  if (key === 'revenue_growth') {
    let val = prep.revenue_growth_pct || ratios.revenue_growth || 0;
    if (val && Math.abs(val) < 1.0) val = val * 100;
    return val;
  }
  return 0;
};

const chartFormatter = (val) => {
  if (Math.abs(val) >= 1e12) return `${(val / 1e12).toFixed(1)}T`;
  if (Math.abs(val) >= 1e9) return `${(val / 1e9).toFixed(1)}B`;
  if (Math.abs(val) >= 1e6) return `${(val / 1e6).toFixed(1)}M`;
  return val.toLocaleString();
};

const pctFormatter = (val) => `${val.toFixed(1)}%`;

function TickerInput({ onAdd, existing }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  const handleChange = (v) => {
    setQuery(v);
    if (!v.trim()) { setSuggestions([]); return; }
    setSuggestions(SUGGESTION_DB.filter(s => s.toLowerCase().includes(v.toLowerCase()) && !existing.includes(s.toUpperCase())).slice(0, 5));
  };

  const add = (val) => {
    const v = (val || query).trim().toUpperCase();
    if (!v || existing.includes(v)) return;
    onAdd(v); setQuery(''); setSuggestions([]);
  };

  return (
    <div className="relative">
      <div className="flex gap-2">
        <input value={query} onChange={e => handleChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="Add company name or ticker symbol..."
          className="glass-input flex-1 py-2.5 px-3 text-sm focus:ring-2 focus:ring-purple-500/50" />
        <button onClick={() => add()} disabled={!query.trim()}
          className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500
            text-white text-sm font-bold rounded-lg border border-purple-500/30 disabled:opacity-40 transition-all active:scale-[0.97] flex items-center gap-1.5 focus:ring-2 focus:ring-purple-500/50">
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>
      <AnimatePresence>
        {suggestions.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute top-full left-0 right-0 mt-1.5 z-40 bg-[#0a0f1e]/95 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
            {suggestions.map(s => (
              <button key={s} onClick={() => add(s)}
                className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-blue-600/10 hover:text-white transition-colors border-b border-white/4 last:border-0">
                {s}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Comparisons() {
  const [tickers, setTickers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [exporting, setExporting] = useState(false);
  
  // Chat state
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const chatEndRef = useRef(null);

  const { success, error: toastError } = useToast();

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory]);

  const runComparison = useCallback(async (tickersList) => {
    if (tickersList.length < 2) { toastError('Add at least 2 companies'); return; }
    setLoading(true); setResult(null); setChatHistory([]); setConversationId(null);
    try {
      const data = await researchService.compare(tickersList);
      setResult(data);
      success('Comparison complete!');
    } catch (e) {
      toastError(e?.response?.data?.detail || 'Comparison failed');
    } finally { setLoading(false); }
  }, [success, toastError]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tickersParam = params.get('tickers');
    if (tickersParam) {
      const parsed = tickersParam.split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
      if (parsed.length >= 2 && parsed.length <= 3) {
        setTickers(parsed);
        runComparison(parsed);
      }
    }
  }, [runComparison]);

  const addTicker = (t) => {
    if (tickers.length >= 3) { toastError('Maximum 3 companies'); return; }
    setTickers(prev => [...prev, t.toUpperCase()]);
  };

  const handleCompare = () => {
    runComparison(tickers);
  };

  const handleDownloadPDF = async () => {
    if (!result) return;
    setExporting(true);
    try {
      const blob = await researchService.compareExportPdf(result.tickers);
      const htmlText = await blob.text();
      
      const element = document.createElement('div');
      element.style.width = '210mm';
      element.style.margin = '0';
      element.style.padding = '0';
      element.style.background = 'white';
      element.style.position = 'relative';
      element.innerHTML = htmlText;

      const opt = {
        margin:       0,
        filename:     `${result.tickers.join('_')}_comparison_report.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: 'css' }
      };

      const runExport = () => {
        window.html2pdf().set(opt).from(element).save()
          .then(() => success('Comparison PDF downloaded successfully!'))
          .catch(() => toastError('PDF compilation failed.'))
          .finally(() => setExporting(false));
      };

      if (window.html2pdf) {
        runExport();
      } else {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        script.onload = runExport;
        script.onerror = () => { toastError('Failed to load PDF library.'); setExporting(false); };
        document.body.appendChild(script);
      }
    } catch {
      toastError('Failed to export comparison report');
      setExporting(false);
    }
  };

  const handleExportCSV = () => {
    if (!result) return;
    let csv = 'Metric Category,' + result.companies_summary.map(c => c.ticker).join(',') + '\n';
    ROW_DEFS.forEach(row => {
      csv += `"${row.label}",` + result.companies.map(c => {
        const val = getMetricVal(c, row.key);
        return `"${formatMetricVal(val, row)}"`;
      }).join(',') + '\n';
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `${result.tickers.join('_')}_comparison.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    success('CSV exported!');
  };

  const handleExportExcel = () => {
    if (!result) return;
    let tsv = 'Metric Category\t' + result.companies_summary.map(c => c.ticker).join('\t') + '\n';
    ROW_DEFS.forEach(row => {
      tsv += `${row.label}\t` + result.companies.map(c => {
        const val = getMetricVal(c, row.key);
        return formatMetricVal(val, row);
      }).join('\t') + '\n';
    });
    
    const blob = new Blob([tsv], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `${result.tickers.join('_')}_comparison.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    success('Excel exported!');
  };

  const handleCopySummary = () => {
    if (!result) return;
    const summary = `InvestIQ Comparison Summary:\nCompared: ${result.tickers.join(' vs ')}\nWinner: ${result.winner}\nAI Score: ${result.winner_score}/100\nReasons:\n${result.winner_reasons.map(r => `• ${r}`).join('\n')}`;
    navigator.clipboard.writeText(summary);
    success('Summary copied to clipboard!');
  };

  const handleShareLink = () => {
    if (!result) return;
    const shareUrl = `${window.location.origin}/compare?tickers=${result.tickers.join(',')}`;
    navigator.clipboard.writeText(shareUrl);
    success('Shareable link copied to clipboard!');
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading || !result) return;
    
    const userMsg = chatInput;
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatLoading(true);
    
    try {
      const data = await researchService.compareChat(result.tickers, userMsg, conversationId);
      setChatHistory(prev => [...prev, { role: 'assistant', content: data.reply }]);
      if (data.conversation_id) {
        setConversationId(data.conversation_id);
      }
    } catch {
      toastError('Failed to get answer from comparison agent');
    } finally { setChatLoading(false); }
  };

  const summaryDetails = useMemo(() => {
    if (!result || !result.companies) return null;
    
    const cos = result.companies;
    const summary = result.companies_summary;
    
    // Overall Winner
    const winnerTicker = result.winner;
    const winnerCo = cos.find(c => c.ticker === winnerTicker);
    const winnerCoSummary = summary.find(c => c.ticker === winnerTicker);
    
    // Runner-up
    const sortedByScore = [...summary].sort((a, b) => b.ai_score - a.ai_score);
    const runnerUpSummary = sortedByScore[1] || sortedByScore[0];
    const runnerUpCo = cos.find(c => c.ticker === runnerUpSummary.ticker);
    
    // Financial Health Winner
    const bestFin = summary.reduce((prev, curr) => (prev.financial > curr.financial) ? prev : curr);
    
    // Growth Winner
    const bestGro = summary.reduce((prev, curr) => (prev.growth > curr.growth) ? prev : curr);
    
    // Value Winner
    const bestVal = summary.reduce((prev, curr) => (prev.valuation > curr.valuation) ? prev : curr);
    
    // Risk Safety Winner
    const bestRisk = summary.reduce((prev, curr) => (prev.risk > curr.risk) ? prev : curr);
    
    // News Winner
    const bestNews = summary.reduce((prev, curr) => (prev.sentiment > curr.sentiment) ? prev : curr);
    
    // Income Winner
    const yields = cos.map(c => {
      let dy = c.ratios?.dividend_yield || 0;
      if (dy < 1.0 && dy > 0) dy = dy * 100;
      return { ticker: c.ticker, val: dy };
    });
    const bestInc = yields.reduce((prev, curr) => (prev.val > curr.val) ? prev : curr);
    let incomeWinner = bestInc.ticker;
    if (bestInc.val === 0) {
      const margins = cos.map(c => {
        const rev = c.preprocessed_metrics?.revenue || c.ratios?.revenue || 1;
        const fcf = c.preprocessed_metrics?.free_cash_flow || 0;
        return { ticker: c.ticker, val: (fcf / rev) * 100 };
      });
      incomeWinner = margins.reduce((prev, curr) => (prev.val > curr.val) ? prev : curr).ticker;
    }
    
    // Quality Winner (compare ROE, fallback to Net Margin)
    const qualities = cos.map(c => {
      let roe = c.ratios?.roe || 0;
      if (roe < 1.0 && roe > 0) roe = roe * 100;
      return { ticker: c.ticker, val: roe };
    });
    const bestQuality = qualities.reduce((prev, curr) => (prev.val > curr.val) ? prev : curr);
    let qualityWinner = bestQuality.ticker;
    if (bestQuality.val === 0) {
      const margins = cos.map(c => ({ ticker: c.ticker, val: c.preprocessed_metrics?.net_margin_pct || 0 }));
      qualityWinner = margins.reduce((prev, curr) => (prev.val > curr.val) ? prev : curr).ticker;
    }
    
    return {
      winner: winnerCo,
      winnerSummary: winnerCoSummary,
      runnerUp: runnerUpCo,
      runnerUpSummary: runnerUpSummary,
      financialWinner: cos.find(c => c.ticker === bestFin.ticker),
      growthWinner: cos.find(c => c.ticker === bestGro.ticker),
      valueWinner: cos.find(c => c.ticker === bestVal.ticker),
      riskWinner: cos.find(c => c.ticker === bestRisk.ticker),
      newsWinner: cos.find(c => c.ticker === bestNews.ticker),
      incomeWinner: cos.find(c => c.ticker === incomeWinner),
      qualityWinner: cos.find(c => c.ticker === qualityWinner),
      confidence: result.confidence || 89,
      horizon: winnerCo?.preprocessed_metrics?.investment_horizon || (winnerCoSummary?.recommendation === 'HOLD' ? '12–18 Months' : '3–5 Years')
    };
  }, [result]);

  const targetDrivers = useMemo(() => {
    if (!summaryDetails) return null;
    const verdict = summaryDetails.winnerSummary?.recommendation || 'BUY';
    const isIncomeWinner = summaryDetails.incomeWinner?.ticker === result?.winner;
    
    if (verdict === 'STRONG BUY' || verdict === 'BUY') {
      return {
        target: 'Growth & Value Compounders, Long-term Capital Appreciation Portfolios',
        suitable: 'Core equity allocations, long-term retirement accounts, value investors seeking margin of safety',
        notSuitable: 'Short-term momentum speculators, capital preservation only models',
        icon: ThumbsUp
      };
    } else if (verdict === 'HOLD') {
      return {
        target: 'Capital Preservation, Yield Seekers, Low Beta Accumulators',
        suitable: `Dividend reinvestment plans (DRIPs)${isIncomeWinner ? ' due to leading yield profile' : ''}, market index tracking allocations`,
        notSuitable: 'Aggressive alpha expansion funds, high beta acceleration portfolios',
        icon: AlertTriangle
      };
    } else {
      return {
        target: 'Tactical Short Sellers, Market Hedging Portfolios',
        suitable: 'Defensive market options hedging, capital extraction strategies',
        notSuitable: 'Core retail investment portfolios, long-term buy and hold accounts',
        icon: ThumbsDown
      };
    }
  }, [summaryDetails, result]);

  // Prepare radar chart data
  const radarData = useMemo(() => {
    if (!result) return [];
    return [
      { subject: 'Financial Health', ...result.companies_summary.reduce((acc, c) => ({ ...acc, [c.ticker]: c.financial }), {}) },
      { subject: 'Growth', ...result.companies_summary.reduce((acc, c) => ({ ...acc, [c.ticker]: c.growth }), {}) },
      { subject: 'Valuation', ...result.companies_summary.reduce((acc, c) => ({ ...acc, [c.ticker]: c.valuation }), {}) },
      { subject: 'Risk Safety', ...result.companies_summary.reduce((acc, c) => ({ ...acc, [c.ticker]: c.risk }), {}) },
      { subject: 'Sentiment', ...result.companies_summary.reduce((acc, c) => ({ ...acc, [c.ticker]: c.sentiment }), {}) }
    ];
  }, [result]);

  return (
    <div className="min-h-full pb-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            Stock <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Comparator</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">Compare up to 3 companies side-by-side with dynamic benchmarking.</p>
        </div>
        
        {result && (
          <div className="flex flex-wrap gap-2">
            <button onClick={handleDownloadPDF} disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.8 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-xs font-bold rounded-xl transition-all"
              aria-label="Download Comparison PDF Report">
              {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Download Comparison PDF
            </button>
            <button onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.8 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 text-xs font-bold rounded-xl transition-all"
              aria-label="Export metrics to CSV">
              <FileText className="w-3.5 h-3.5" />
              Export CSV
            </button>
            <button onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-1.8 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border border-purple-500/30 text-xs font-bold rounded-xl transition-all"
              aria-label="Export metrics to Excel">
              <Scale className="w-3.5 h-3.5" />
              Export Excel
            </button>
            <button onClick={handleCopySummary}
              className="flex items-center gap-1.5 px-3 py-1.8 bg-slate-700/50 hover:bg-slate-700 text-slate-300 border border-slate-600 text-xs font-bold rounded-xl transition-all"
              aria-label="Copy comparison summary to clipboard">
              <Copy className="w-3.5 h-3.5" />
              Copy Comparison
            </button>
            <button onClick={handleShareLink}
              className="flex items-center gap-1.5 px-3 py-1.8 bg-pink-500/20 hover:bg-pink-500/30 text-pink-400 border border-pink-500/30 text-xs font-bold rounded-xl transition-all"
              aria-label="Copy shareable link">
              <Share2 className="w-3.5 h-3.5" />
              Share Link
            </button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Scale className="w-4 h-4 text-purple-400" /> Select Companies</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <TickerInput onAdd={addTicker} existing={tickers} />
          {tickers.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              {tickers.map((t, i) => (
                <motion.div key={t} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold"
                  style={{ background: `${COLORS[i]}18`, borderColor: `${COLORS[i]}40`, color: COLORS[i] }}>
                  {t}
                  <button onClick={() => setTickers(p => p.filter(x => x !== t))} className="opacity-60 hover:opacity-100" aria-label={`Remove ${t}`}><X className="w-3 h-3" /></button>
                </motion.div>
              ))}
              {tickers.length >= 2 && (
                <button onClick={handleCompare} disabled={loading}
                  className="flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600
                    hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold rounded-xl
                    border border-purple-500/30 shadow-lg shadow-purple-500/20 disabled:opacity-40 transition-all active:scale-[0.97] focus:ring-2 focus:ring-purple-500/50">
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                  {loading ? 'Comparing…' : 'Run Comparison'}
                </button>
              )}
            </div>
          )}
          {tickers.length === 0 && <p className="text-xs text-slate-500">Add 2–3 companies. e.g. AAPL vs MSFT vs GOOG</p>}
        </CardContent>
      </Card>

      {loading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="glass-card rounded-2xl p-8 border border-purple-500/20 text-center">
          <Loader2 className="w-10 h-10 text-purple-400 animate-spin mx-auto mb-3" />
          <p className="text-sm font-bold text-white">Running AI Comparison</p>
          <p className="text-xs text-slate-400 mt-1">Fetching and benchmarking company data…</p>
        </motion.div>
      )}

      {result && !loading && summaryDetails && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          
          {/* SECTION 1: Comparison Summary Cards */}
          <div className="space-y-3">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-500" /> Comparison Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Winner Card */}
              <div className="glass-card rounded-2xl p-4 border border-amber-500/30 bg-amber-500/5 relative overflow-hidden flex flex-col justify-between h-36">
                <Trophy className="absolute top-3 right-3 w-8 h-8 text-amber-500/10" />
                <div>
                  <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1">Top Selection</p>
                  <div className="flex items-center gap-2">
                    <img src={getLogoUrl(summaryDetails.winner, result)} alt="" className="w-6 h-6 rounded-md bg-white/10" 
                      onError={(e) => { e.target.src = 'https://placehold.co/100x100/1e293b/ffffff?text=Logo'; }} />
                    <h3 className="text-lg font-black text-white truncate">{summaryDetails.winner.name}</h3>
                  </div>
                  <p className="text-xs text-slate-400 truncate mt-0.5">{summaryDetails.winner.ticker} · {summaryDetails.winner.sector}</p>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 uppercase tracking-wide">
                    {summaryDetails.winnerSummary.recommendation}
                  </span>
                  <span className="text-xs font-bold text-white">{summaryDetails.winnerSummary.ai_score}/100</span>
                </div>
              </div>

              {/* Runner-up Card */}
              <div className="glass-card rounded-2xl p-4 border border-slate-500/35 bg-slate-500/5 relative overflow-hidden flex flex-col justify-between h-36">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Runner-up</p>
                  <div className="flex items-center gap-2">
                    <img src={getLogoUrl(summaryDetails.runnerUp, result)} alt="" className="w-6 h-6 rounded-md bg-white/10" 
                      onError={(e) => { e.target.src = 'https://placehold.co/100x100/1e293b/ffffff?text=Logo'; }} />
                    <h3 className="text-lg font-black text-white truncate">{summaryDetails.runnerUp.name}</h3>
                  </div>
                  <p className="text-xs text-slate-400 truncate mt-0.5">{summaryDetails.runnerUp.ticker} · {summaryDetails.runnerUp.sector}</p>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-slate-500/15 border border-slate-500/30 text-slate-350 uppercase tracking-wide">
                    {summaryDetails.runnerUpSummary.recommendation}
                  </span>
                  <span className="text-xs font-bold text-slate-300">{summaryDetails.runnerUpSummary.ai_score}/100</span>
                </div>
              </div>

              {/* Overall Score */}
              <div className="glass-card rounded-2xl p-4 border border-blue-500/30 bg-blue-500/5 flex flex-col justify-between h-36">
                <div>
                  <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Winner AI Score</p>
                  <h3 className="text-2xl font-black text-white">{summaryDetails.winnerSummary.ai_score}</h3>
                  <p className="text-xs text-slate-400 mt-1">Based on deterministic scoring engine</p>
                </div>
                <div className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">Weighting category filters</div>
              </div>

              {/* Confidence */}
              <div className="glass-card rounded-2xl p-4 border border-purple-500/30 bg-purple-500/5 flex flex-col justify-between h-36">
                <div>
                  <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-1">Confidence rating</p>
                  <h3 className="text-2xl font-black text-white">{summaryDetails.confidence}%</h3>
                  <p className="text-xs text-slate-400 mt-1">Signal agreement confidence waterfall</p>
                </div>
                <div className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">Holding Horizon: {summaryDetails.horizon}</div>
              </div>
            </div>

            {/* Category Winners Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
              {[
                { title: 'Financial Health', winner: summaryDetails.financialWinner, color: 'text-blue-400', key: 'financial' },
                { title: 'Growth Index', winner: summaryDetails.growthWinner, color: 'text-emerald-400', key: 'growth' },
                { title: 'Valuation multiple', winner: summaryDetails.valueWinner, color: 'text-amber-400', key: 'valuation' },
                { title: 'Risk Safety', winner: summaryDetails.riskWinner, color: 'text-rose-400', key: 'risk' },
                { title: 'News Sentiment', winner: summaryDetails.newsWinner, color: 'text-sky-400', key: 'sentiment' },
                { title: 'Dividend / FCF', winner: summaryDetails.incomeWinner, color: 'text-purple-400', key: 'income' },
                { title: 'Capital Quality', winner: summaryDetails.qualityWinner, color: 'text-pink-400', key: 'quality' }
              ].map((cWinner, idx) => (
                <div key={idx} className="glass-card rounded-xl p-3 border border-white/5 bg-slate-900/40 flex flex-col justify-between h-24">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider">{cWinner.title}</p>
                  <div className="flex items-center gap-1.5">
                    <Award className={`w-3.5 h-3.5 ${cWinner.color}`} />
                    <span className="text-sm font-bold text-white">{cWinner.winner.ticker}</span>
                  </div>
                  <span className="text-[9px] text-slate-400 truncate">{cWinner.winner.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 2: Color-Coded Comparison Matrix Table */}
          <Card className="border border-white/5 bg-slate-900/10">
            <CardHeader className="border-b border-white/5 py-4 flex items-center justify-between">
              <CardTitle className="flex items-center gap-2"><Scale className="w-4 h-4 text-purple-400" /> Comparison Matrix</CardTitle>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Sticky headers & scroll enabled</span>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto max-h-[600px] scrollbar-thin scrollbar-thumb-white/10">
              <table className="w-full text-xs text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-white/10 bg-[#060a13] sticky top-0 z-30 shadow-md">
                    <th className="py-3 px-4 text-slate-400 font-bold w-60 sticky left-0 bg-[#060a13] border-r border-white/5 z-40">Metric Category</th>
                    {result.companies.map((co, idx) => (
                      <th key={co.ticker} className="py-3 px-4 text-white font-black text-center border-r border-white/5 last:border-0" style={{ width: `${70 / result.companies.length}%` }}>
                        <div className="flex items-center justify-center gap-2">
                          <img src={getLogoUrl(co, result)} alt="" className="w-5 h-5 rounded bg-white/10" 
                            onError={(e) => { e.target.src = 'https://placehold.co/100x100/1e293b/ffffff?text=Logo'; }} />
                          <span className="text-sm font-black" style={{ color: COLORS[idx] }}>{co.ticker}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROW_DEFS.map((row, rIdx) => {
                    const vals = result.companies.map(c => getMetricVal(c, row.key));
                    const numVals = vals.map(v => parseFloat(v)).filter(v => !isNaN(v) && v !== 0);
                    
                    const best = row.direction === 'higher' ? Math.max(...numVals) : Math.min(...numVals);
                    const worst = row.direction === 'higher' ? Math.min(...numVals) : Math.max(...numVals);

                    return (
                      <tr key={rIdx} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                        {/* Sticky Category Name */}
                        <td className="py-2.5 px-4 text-slate-350 font-bold sticky left-0 bg-[#070b16] border-r border-white/5 z-20 flex items-center justify-between group/row">
                          <span className="cursor-help flex items-center gap-1.5" title={row.desc}>
                            {row.label}
                            <HelpCircle className="w-3 h-3 text-slate-600 hover:text-slate-400 transition-colors" />
                          </span>
                        </td>
                        
                        {/* Company Metric Cells */}
                        {result.companies.map((c, cIdx) => {
                          const val = getMetricVal(c, row.key);
                          const num = parseFloat(val);
                          
                          let cellStyle = "bg-transparent text-slate-300";
                          if (row.direction !== 'none' && !isNaN(num) && num !== 0 && numVals.length > 1) {
                            if (num === best && best !== worst) {
                              cellStyle = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold";
                            } else if (num === worst && best !== worst) {
                              cellStyle = "bg-rose-500/10 text-rose-400 border border-rose-500/20";
                            } else if (numVals.length === 3 && num !== best && num !== worst) {
                              cellStyle = "bg-amber-500/10 text-amber-400 border border-amber-500/20";
                            }
                          }

                          return (
                            <td key={cIdx} className="py-2.5 px-4 text-center border-r border-white/5 last:border-0">
                              <span className={`inline-block px-3 py-0.5 rounded-md ${cellStyle}`}>
                                {formatMetricVal(val, row)}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* SECTION 3: Scoring Radar & Grouped Bar Charts Grid */}
          <div className="space-y-4">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"><BarChart2 className="w-4 h-4 text-purple-400" /> Scoring & Financial Charts</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Radar Chart */}
              <Card className="md:col-span-1 border border-white/5 bg-[#0a0f1d]/40">
                <CardHeader className="py-4 border-b border-white/5"><CardTitle className="text-xs font-black uppercase tracking-widest text-center text-slate-400">Scoring Radar Analysis</CardTitle></CardHeader>
                <CardContent className="h-56 flex items-center justify-center p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                      <PolarGrid stroke="rgba(255,255,255,0.06)" />
                      <PolarAngleAxis dataKey="subject" stroke="rgba(255,255,255,0.4)" fontSize={9} />
                      <PolarRadiusAxis stroke="rgba(255,255,255,0.1)" angle={30} domain={[0, 100]} />
                      {result.tickers.map((t, idx) => (
                        <Radar key={t} name={t} dataKey={t} stroke={COLORS[idx]} fill={COLORS[idx]} fillOpacity={0.15} />
                      ))}
                      <Tooltip content={<DarkTooltip />} />
                    </RadarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Bar Charts Grid */}
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                <MemoizedGroupedBarChart data={result.companies} metricKey="revenue" title="Revenue comparison ($)" yAxisFormatter={chartFormatter} />
                <MemoizedGroupedBarChart data={result.companies} metricKey="net_income" title="Net income comparison ($)" yAxisFormatter={chartFormatter} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <MemoizedGroupedBarChart data={result.companies} metricKey="market_cap" title="Market capitalization ($)" yAxisFormatter={chartFormatter} />
              <MemoizedGroupedBarChart data={result.companies} metricKey="revenue_growth" title="Revenue growth rate (%)" yAxisFormatter={pctFormatter} />
              <MemoizedGroupedBarChart data={result.companies} metricKey="operating_margin" title="Operating margin (%)" yAxisFormatter={pctFormatter} />
              <MemoizedGroupedBarChart data={result.companies} metricKey="roe" title="Return on Equity (ROE) (%)" yAxisFormatter={pctFormatter} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MemoizedGroupedBarChart data={result.companies} metricKey="eps" title="Earnings Per Share (EPS) ($)" />
              <MemoizedGroupedBarChart data={result.companies} metricKey="free_cash_flow" title="Free Cash Flow ($)" yAxisFormatter={chartFormatter} />
            </div>
          </div>

          {/* SECTION 4: Deterministic Category Leaders cards */}
          <div className="space-y-3">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"><Award className="w-4 h-4 text-emerald-400" /> Winner Breakdown by Category</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { title: '💪 Financial Health Leader', winner: summaryDetails.financialWinner, scoreKey: 'financial', desc: 'Leads in balance sheet liquidity, interest coverage, and solvency.' },
                { title: '🚀 Growth Trajectory Leader', winner: summaryDetails.growthWinner, scoreKey: 'growth', desc: 'Demonstrates superior YoY revenue growth and net profit acceleration.' },
                { title: '💎 Favorable Valuation Leader', winner: summaryDetails.valueWinner, scoreKey: 'valuation', desc: 'Displays attractive pricing multipliers relative to cash generation capabilities.' },
                { title: '🛡 Portfolio Risk Safety Leader', winner: summaryDetails.riskWinner, scoreKey: 'risk', desc: 'Features lower debt-to-equity levels and defensive market beta parameters.' },
                { title: '📰 Favorable News Sentiment', winner: summaryDetails.newsWinner, scoreKey: 'sentiment', desc: 'Carries positive media reporting trends analyzed via recent headlines.' },
                { title: '💸 Dividend / FCF Yield Leader', winner: summaryDetails.incomeWinner, scoreKey: null, desc: 'Highest cash flow conversion margin or dividend distribution yield.' }
              ].map((cat, cIdx) => {
                const logo = getLogoUrl(cat.winner, result);
                const scoreVal = cat.scoreKey ? summaryDetails.winnerSummary[cat.scoreKey] : null;

                return (
                  <div key={cIdx} className="glass-card rounded-2xl p-4 border border-white/5 bg-slate-900/30 flex gap-3.5 items-start hover:border-emerald-500/20 transition-all">
                    <img src={logo} alt="" className="w-8 h-8 rounded-lg bg-white/10 flex-shrink-0" 
                      onError={(e) => { e.target.src = 'https://placehold.co/100x100/1e293b/ffffff?text=Logo'; }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs font-bold text-white truncate">{cat.title}</h4>
                        <span className="text-[10px] font-black text-emerald-400">{cat.winner.ticker}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">{cat.desc}</p>
                      {scoreVal && <p className="text-[10px] text-slate-500 font-bold mt-1.5">Leader category score: {scoreVal}/100</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 5: Investment Verdict Hero Card */}
          <div className="glass-card rounded-3xl p-6 border border-amber-500/20 bg-amber-500/5 relative overflow-hidden"
            style={{ boxShadow: '0 0 50px rgba(245,158,11,0.05)' }}>
            <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-[100px] pointer-events-none" />
            
            <div className="relative space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
                <div>
                  <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5" /> Deterministic Investment Committee Verdict
                  </p>
                  <h3 className="text-3xl font-black text-white">{summaryDetails.winner.name} ({summaryDetails.winner.ticker})</h3>
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-4 py-1.5 rounded-xl text-xs font-black bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 tracking-wider">
                    {summaryDetails.winnerSummary.recommendation}
                  </span>
                  <div className="text-right">
                    <p className="text-xs font-bold text-white">AI Score: {summaryDetails.winnerSummary.ai_score}/100</p>
                    <p className="text-[10px] text-slate-400">Confidence: {summaryDetails.confidence}%</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Suitability Column */}
                <div className="space-y-4 md:border-r md:border-white/5 md:pr-6">
                  <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Target Investor</h4>
                    <p className="text-xs text-slate-200 font-bold leading-relaxed">{targetDrivers.target}</p>
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1 flex items-center gap-1"><ThumbsUp className="w-3 h-3" /> Suitable For</h4>
                    <p className="text-xs text-slate-350 leading-relaxed">{targetDrivers.suitable}</p>
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1 flex items-center gap-1"><ThumbsDown className="w-3 h-3" /> Not Suitable For</h4>
                    <p className="text-xs text-slate-350 leading-relaxed">{targetDrivers.notSuitable}</p>
                  </div>
                </div>

                {/* Reasons List */}
                <div className="space-y-3 md:col-span-2">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Key Investment Recommendation Drivers</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {result.winner_reasons.map((reason, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-slate-350 bg-slate-950/20 border border-white/5 rounded-xl p-3">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{reason.replace(/\*\*/g, '')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 8: AI Comparison Chatbot Panel */}
          <Card className="border border-purple-500/20 bg-[#0a0f1e]/40 shadow-2xl">
            <CardHeader className="border-b border-white/5 py-4">
              <CardTitle className="flex items-center gap-2 text-sm font-black text-white">
                <MessageSquare className="w-4 h-4 text-purple-400 animate-pulse" />
                Ask AI for Stock Comparison
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {/* Message Log */}
              <div className="h-72 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-white/10">
                {chatHistory.length === 0 && (
                  <div className="text-center py-12 text-slate-500">
                    <Brain className="w-10 h-10 text-purple-400/20 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-400">Grounded Comparison Chatbot</p>
                    <p className="text-[10px] text-slate-500 mt-1 max-w-xs mx-auto">Ask specific comparative questions. Responses are strictly grounded in profiles, metrics, and SWOT analyses.</p>
                  </div>
                )}
                {chatHistory.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs ${
                      m.role === 'user' 
                        ? 'bg-purple-600 text-white rounded-tr-none' 
                        : 'bg-slate-800/80 text-slate-300 border border-white/5 rounded-tl-none leading-relaxed whitespace-pre-wrap'
                    }`}>
                      {m.content}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-800/80 text-slate-300 border border-white/5 rounded-2xl rounded-tl-none px-4 py-2.5 text-xs flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
                      Grounded AI Analysis...
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              
              {/* Input box */}
              <form onSubmit={handleChatSubmit} className="p-3 border-t border-white/5 bg-[#0a0f1d]/60 flex gap-2 rounded-b-xl">
                <input 
                  value={chatInput} 
                  onChange={e => setChatInput(e.target.value)}
                  placeholder="Ask e.g. Why is MSFT growth stronger than AAPL?"
                  className="glass-input flex-1 py-2 px-3 text-xs bg-slate-900/50 focus:ring-1 focus:ring-purple-500" 
                  disabled={chatLoading}
                />
                <button type="submit" disabled={chatLoading || !chatInput.trim()}
                  className="p-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg border border-purple-500/20 disabled:opacity-40 transition-all focus:ring-1 focus:ring-purple-500"
                  aria-label="Send message to comparison agent">
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </CardContent>
          </Card>

        </motion.div>
      )}

      {!result && !loading && tickers.length === 0 && (
        <EmptyState icon={Scale} title="No Comparison Yet"
          description="Add 2–3 companies above and click Run Comparison to run dynamic benchmarking." />
      )}
    </div>
  );
}
