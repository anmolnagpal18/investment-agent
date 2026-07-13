import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Zap, X, Brain, Shield, BarChart2, Newspaper,
  Scale, Download, Copy, Share2, MessageSquare, Bookmark,
  BookmarkCheck, CheckCircle2, AlertTriangle, Globe, Users,
  Building2, DollarSign, Activity, Loader2, Sparkles, Target,
  ArrowRight, FileText, Eye, RefreshCw
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip
} from 'recharts';

import { useToast } from '../context/ToastContext';
import researchService from '../services/researchService';
import api from '../services/api';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { CardSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const SUGGESTION_DB = [
  'Apple Inc','Amazon','Alphabet','AMD','Tesla','TCS','Tata Motors',
  'Microsoft','Meta','Maruti Suzuki','NVIDIA','Netflix','NTPC',
  'Infosys','ICICI Bank','ITC','Samsung','Salesforce','Sony',
  'Reliance Industries','Goldman Sachs','Google','Berkshire Hathaway',
  'Bajaj Finance','HDFC Bank','Hindustan Unilever','Wipro','Walmart','Walt Disney',
];

const ANALYSIS_NODES = [
  { key: 'company_research',   label: 'Company Research',   icon: Globe,       color: '#3b82f6' },
  { key: 'financial_analysis', label: 'Financial Analysis', icon: BarChart2,   color: '#8b5cf6' },
  { key: 'news_analysis',      label: 'News Analysis',      icon: Newspaper,   color: '#06b6d4' },
  { key: 'risk_analysis',      label: 'Risk Assessment',    icon: Shield,      color: '#f59e0b' },
  { key: 'swot_analysis',      label: 'SWOT Analysis',      icon: Target,      color: '#ec4899' },
  { key: 'scores_calculation', label: 'Scoring Engine',     icon: Activity,    color: '#10b981' },
  { key: 'recommendation',     label: 'AI Recommendation',  icon: Brain,       color: '#a78bfa' },
  { key: 'report_generator',   label: 'Generating Report',  icon: FileText,    color: '#f472b6' },
];
const NODE_KEYS = ANALYSIS_NODES.map(n => n.key);

const CATEGORY_WEIGHTS = {
  financial_health: { label: 'Financial Health', weight: 0.30, color: '#3b82f6' },
  growth:           { label: 'Growth',           weight: 0.25, color: '#8b5cf6' },
  valuation:        { label: 'Valuation',         weight: 0.20, color: '#f59e0b' },
  risk_safety:      { label: 'Risk Safety',       weight: 0.15, color: '#ef4444' },
  news_sentiment:   { label: 'News Sentiment',    weight: 0.10, color: '#10b981' },
};

const CHAT_SUGGESTIONS = [
  'Why is the recommendation BUY?',
  'Explain the AI Score breakdown',
  'What are the biggest investment risks?',
  'How does valuation compare to peers?',
  'Should I invest long term?',
  'Summarize key financial metrics',
];

// ─────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────
function fmtNum(v, symbol = '$') {
  if (!v && v !== 0) return 'N/A';
  const n = Number(v);
  if (isNaN(n)) return String(v);
  if (Math.abs(n) >= 1e12) return `${symbol}${(n/1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9)  return `${symbol}${(n/1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6)  return `${symbol}${(n/1e6).toFixed(0)}M`;
  if (Math.abs(n) >= 1e3)  return `${symbol}${(n/1e3).toFixed(0)}K`;
  return `${symbol}${n.toFixed(2)}`;
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
}

// Compute confidence breakdown from scores (deterministic, no backend change)
function calcConfidenceBreakdown(scores = {}) {
  const contributions = Object.entries(CATEGORY_WEIGHTS).map(([key, cfg]) => {
    const raw = scores[key] ?? 0;
    // Contribution = deviation from 50 × weight, scaled to ±30
    const contribution = Math.round((raw - 50) * cfg.weight * 0.6);
    return { key, label: cfg.label, color: cfg.color, weight: cfg.weight, score: raw, contribution };
  });
  return contributions;
}

// Extract SWOT from markdown
function extractSwot(md = '') {
  const result = { strengths:[], weaknesses:[], opportunities:[], threats:[] };
  if (!md) return result;
  const pats = {
    strengths:     /strengths?\s*:?(.*?)(?=weaknesses?|opportunities?|threats?|##|$)/is,
    weaknesses:    /weaknesses?\s*:?(.*?)(?=strengths?|opportunities?|threats?|##|$)/is,
    opportunities: /opportunities?\s*:?(.*?)(?=strengths?|weaknesses?|threats?|##|$)/is,
    threats:       /threats?\s*:?(.*?)(?=strengths?|weaknesses?|opportunities?|##|$)/is,
  };
  for (const [key, pat] of Object.entries(pats)) {
    const match = md.match(pat);
    if (match) {
      result[key] = match[1]
        .split('\n')
        .map(l => l.replace(/^[-*•]\s*/, '').trim())
        .filter(l => l.length > 8 && l.length < 200)
        .slice(0, 4);
    }
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// DARK TOOLTIP
// ─────────────────────────────────────────────────────────────
function DarkTooltip({ active, payload, label, fmt }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0b0f1d]/95 border border-white/10 rounded-xl p-3 shadow-2xl backdrop-blur-md text-xs">
      <p className="text-slate-400 font-semibold mb-2">{label}</p>
      {payload.map((item, i) => (
        <div key={i} className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full" style={{ background: item.color||item.fill }} />
          <span className="text-slate-400">{item.name}:</span>
          <span className="text-white font-bold">{fmt ? fmt(item.value) : item.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// VERDICT BADGE
// ─────────────────────────────────────────────────────────────
function VerdictBadge({ verdict, size = 'sm' }) {
  if (!verdict) return null;
  const map = {
    BUY:  { cls:'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', dot:'bg-emerald-400', glow:'shadow-emerald-500/30' },
    HOLD: { cls:'bg-amber-500/15 text-amber-400 border-amber-500/30',       dot:'bg-amber-400',   glow:'shadow-amber-500/30'  },
    PASS: { cls:'bg-red-500/15 text-red-400 border-red-500/30',             dot:'bg-red-400',     glow:'shadow-red-500/30'    },
  };
  const s = map[(verdict||'').toUpperCase()] || map.HOLD;
  if (size === 'lg') return (
    <motion.span
      initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
      className={`inline-flex items-center gap-2 px-5 py-2 rounded-full border-2 font-black tracking-widest text-base uppercase shadow-xl ${s.cls} ${s.glow}`}
    >
      <motion.span
        className={`w-3 h-3 rounded-full ${s.dot}`}
        animate={{ scale: [1,1.4,1], opacity:[1,0.6,1] }}
        transition={{ duration:2, repeat:Infinity }}
      />
      {verdict.toUpperCase()}
    </motion.span>
  );
  return (
    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${s.cls}`}>
      {verdict.toUpperCase()}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// SCORE RING
// ─────────────────────────────────────────────────────────────
function ScoreRing({ score, size = 90, strokeWidth = 8, color = '#3b82f6' }) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(Math.max(score||0, 0), 100);
  const dash = (pct/100)*circ;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
      <motion.circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circ}
        strokeLinecap="round"
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ - dash }}
        transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// ① LIVE ANALYSIS PROGRESS  (Perplexity-style)
// ─────────────────────────────────────────────────────────────
const ANALYSIS_STEPS = [
  { key: 'company_profile',      label: 'Fetching Company Profile' },
  { key: 'financial_statements', label: 'Fetching Financial Statements' },
  { key: 'latest_news',          label: 'Collecting Latest News' },
  { key: 'financial_scores',     label: 'Calculating Financial Scores' },
  { key: 'ai_recommendation',    label: 'Generating AI Recommendation' },
  { key: 'investment_report',    label: 'Preparing Investment Report' },
  { key: 'pdf_generation',       label: 'Generating PDF' },
];

function getStepIndex(node) {
  if (!node) return 0;
  if (['initialize', 'company_research'].includes(node)) return 0;
  if (['financial_analysis', 'metrics_calculation'].includes(node)) return 1;
  if (['news_analysis', 'risk_analysis'].includes(node)) return 2;
  if (['scores_calculation', 'swot_analysis'].includes(node)) return 3;
  if (['recommendation'].includes(node)) return 4;
  if (['report_generator'].includes(node)) return 5;
  if (['pdf_ready'].includes(node)) return 6;
  return 0;
}

function LiveProgress({ stepsState = [], companyName }) {
  const activeIdx = stepsState.findIndex(s => s.status === 'active');
  const displayIdx = activeIdx !== -1 ? activeIdx : stepsState.findIndex(s => s.status === 'pending');
  const completedCount = stepsState.filter(s => s.status === 'done').length;
  const overallProgress = (completedCount / ANALYSIS_STEPS.length) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-2xl p-6 border border-blue-500/20 shadow-2xl shadow-blue-500/5 max-w-2xl mx-auto"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <motion.div
          className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center"
          animate={{ boxShadow: ['0 0 0px rgba(59,130,246,0)', '0 0 20px rgba(59,130,246,0.3)', '0 0 0px rgba(59,130,246,0)'] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Brain className="w-5 h-5 text-blue-400" />
        </motion.div>
        <div className="flex-1">
          <p className="text-sm font-bold text-white">
            Analyzing <span className="text-blue-400">{companyName}</span>…
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {ANALYSIS_STEPS[displayIdx !== -1 ? displayIdx : 0]?.label || 'Initializing'}…
          </p>
        </div>
        <Loader2 className="w-5 h-5 text-blue-400 animate-spin flex-shrink-0" />
      </div>

      {/* Node checklist */}
      <div className="space-y-2">
        {ANALYSIS_STEPS.map((step, i) => {
          const state = stepsState[i] || { status: 'pending', duration: 0 };
          const done = state.status === 'done';
          const active = state.status === 'active';
          const pending = state.status === 'pending';
          const failed = state.status === 'failed';

          return (
            <motion.div
              key={step.key}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: pending ? 0.35 : 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all border
                ${active  ? 'bg-blue-500/8 border-blue-500/20' : ''}
                ${done    ? 'bg-emerald-500/4 border-emerald-500/10' : ''}
                ${failed  ? 'bg-red-500/5 border-red-500/15' : ''}
                ${pending ? 'border-transparent' : ''}
              `}
            >
              {/* Status Circle / Spinner */}
              {done && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type:'spring', stiffness:300 }}>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                </motion.div>
              )}
              {active && <Loader2 className="w-4 h-4 text-blue-400 animate-spin flex-shrink-0" />}
              {pending && <div className="w-4 h-4 rounded-full border border-white/15 flex-shrink-0" />}
              {failed && <X className="w-4 h-4 text-red-400 flex-shrink-0" />}

              {/* Label */}
              <span className={`text-sm font-semibold flex-1
                ${done   ? 'text-emerald-400' : ''}
                ${active ? 'text-blue-300'    : ''}
                ${failed ? 'text-red-450'     : ''}
                ${pending? 'text-slate-600'   : ''}
              `}>
                {step.label}
              </span>

              {/* Timer Badge */}
              {done && (
                <span className="text-[10px] text-emerald-400/80 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-md">
                  {state.duration.toFixed(1)}s
                </span>
              )}
              {active && (
                <span className="text-[10px] text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded-md animate-pulse">
                  {state.duration.toFixed(1)}s
                </span>
              )}
              {pending && <span className="text-[10px] text-slate-600 font-medium">—</span>}
              {failed && <span className="text-[10px] text-red-400 font-bold">failed</span>}
            </motion.div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="mt-5 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 rounded-full"
          initial={{ width: '2%' }}
          animate={{ width: `${Math.max(overallProgress, 4)}%` }}
          transition={{ duration: 0.3, ease:'easeOut' }}
        />
      </div>
      <p className="text-[10px] text-slate-600 mt-2 text-right font-medium">
        Step {Math.min(completedCount + 1, ANALYSIS_STEPS.length)} of {ANALYSIS_STEPS.length}
      </p>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// SEARCH BAR
// ─────────────────────────────────────────────────────────────
function WorkspaceSearch({ onSearch, initialQuery='', isLoading }) {
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState([]);
  const [showSug, setShowSug] = useState(false);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { setQuery(initialQuery); }, [initialQuery]);

  useEffect(() => {
    if (!query.trim() || query.length < 2) { setSuggestions([]); setShowSug(false); return; }
    const q = query.toLowerCase();
    const m = SUGGESTION_DB.filter(s => s.toLowerCase().includes(q)).slice(0, 6);
    setSuggestions(m); setShowSug(m.length > 0);
  }, [query]);

  useEffect(() => {
    const h = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowSug(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const go = (v) => {
    const q = (v || query).trim();
    if (!q || isLoading) return;
    setShowSug(false);
    onSearch(q);
  };

  return (
    <div ref={wrapRef} className="relative w-full max-w-2xl">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            ref={inputRef} value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key==='Enter' && go()}
            onFocus={() => suggestions.length > 0 && setShowSug(true)}
            placeholder="Enter company name or ticker — e.g. NVIDIA, Apple, Reliance"
            className="glass-input w-full pl-11 pr-10 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            autoComplete="off"
            aria-label="Stock Search Ticker or Name"
          />
          {query && !isLoading && (
            <button onClick={() => { setQuery(''); setSuggestions([]); setShowSug(false); inputRef.current?.focus(); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
              aria-label="Clear Search Input"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {isLoading && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400 animate-spin" />}
        </div>
        <button onClick={() => go()} disabled={!query.trim()||isLoading}
          className="px-6 py-3.5 font-bold text-sm text-white rounded-lg border border-blue-500/30
            bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500
            shadow-lg shadow-blue-500/25 disabled:opacity-40 disabled:cursor-not-allowed
            transition-all active:scale-[0.97] flex items-center gap-2 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          aria-label="Analyze stock ticker"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {isLoading ? 'Analyzing…' : 'Analyze'}
        </button>
      </div>

      <AnimatePresence>
        {showSug && (
          <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-6 }}
            className="absolute top-full left-0 right-0 mt-2 z-50 bg-[#0a0f1e]/95 border border-white/10 rounded-xl shadow-2xl backdrop-blur-xl overflow-hidden">
            {suggestions.map((s,i) => (
              <motion.button key={s} initial={{ opacity:0, x:-5 }} animate={{ opacity:1, x:0 }} transition={{ delay:i*0.03 }}
                onClick={() => { setQuery(s); go(s); }}
                className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300
                  hover:text-white hover:bg-blue-600/10 transition-colors border-b border-white/4 last:border-0">
                <Search className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                <span dangerouslySetInnerHTML={{
                  __html: s.replace(
                    new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi'),
                    '<mark class="bg-blue-500/30 text-blue-200 rounded px-0.5">$1</mark>'
                  )
                }} />
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ② STREAMING SECTIONS WRAPPER
// ─────────────────────────────────────────────────────────────
function StreamSection({ index, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut', delay: index * 0.18 }}
    >
      {children}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// COMPANY CARD
// ─────────────────────────────────────────────────────────────
function CompanyCard({ data, isFavorite, onToggleFavorite, favLoading }) {
  const { name, ticker, sector, industry, description, financial_summary: fs={}, ratios={}, preprocessed_metrics: prep={}, free_cash_flow } = data;

  const country = fs.country || data.country || '—';
  const employees = fs.employees || fs.fullTimeEmployees || data.employees || '—';
  const marketCap = fs.market_cap || fs.marketCap || data.market_cap || '—';
  const exchange = fs.exchange || data.exchange || '—';
  const ceo = fs.ceo || data.ceo || '—';
  const currency = fs.currency || data.currency || '—';
  const website = fs.website || data.website || '—';

  const currencySymbol = (ticker?.toUpperCase().endsWith('.NS') || currency === 'INR') ? '₹' : '$';

  const fmtKpi = (val, type, isZeroValid=false) => {
    if (val === undefined || val === null || val === '—' || val === '') return 'N/A';
    const num = Number(val);
    if (isNaN(num)) return 'N/A';
    if (num === 0 && !isZeroValid) return 'N/A';
    
    if (type === 'percent') return num.toFixed(2) + '%';
    if (type === 'currency') return currencySymbol + num.toLocaleString(undefined, { maximumFractionDigits: 2 });
    if (type === 'raw') return num.toFixed(2);
    return num.toLocaleString();
  };

  const meta = [
    { icon: Globe,      label: 'Country',   value: country },
    { icon: Users,      label: 'Employees', value: employees !== '—' && employees ? Number(employees).toLocaleString() : '—' },
    { icon: DollarSign, label: 'Mkt Cap',   value: marketCap !== '—' && marketCap ? fmtNum(marketCap, currencySymbol) : '—' },
    { icon: Activity,   label: 'Exchange',  value: exchange },
    { icon: Building2,  label: 'CEO',       value: ceo },
    { icon: Scale,      label: 'Currency',  value: currency },
    { icon: FileText,   label: 'Website',   value: website !== '—' && website ? (
        <a href={website.startsWith('http') ? website : `https://${website}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 hover:underline transition-colors">
          {website.replace(/^https?:\/\/(www\.)?/, '')}
        </a>
      ) : '—'
    },
  ].filter(r => r.value && r.value !== '—');

  const kpis = [
    { label: 'Revenue Growth', value: fmtKpi(prep.revenue_growth_pct || fs.revenue_growth, 'percent', true) },
    { label: 'Net Margin', value: fmtKpi(prep.net_margin_pct || (fs.profit_margin * 100), 'percent', true) },
    { label: 'Operating Margin', value: fmtKpi(prep.operating_margin_pct || (ratios.operating_margin * 100), 'percent', true) },
    { label: 'ROE', value: fmtKpi(ratios.roe * 100, 'percent', true) },
    { label: 'EPS', value: fmtKpi(ratios.eps, 'currency', true) },
    { label: 'PE Ratio', value: fmtKpi(ratios.pe_ratio, 'raw') },
    { label: 'PB Ratio', value: fmtKpi(ratios.pb_ratio, 'raw') },
    { label: 'PEG Ratio', value: fmtKpi(ratios.peg_ratio, 'raw') },
    { label: 'Debt to Equity', value: fmtKpi(ratios.debt_to_equity, 'percent') },
    { label: 'Current Ratio', value: fmtKpi(ratios.current_ratio, 'raw') },
    { label: 'Free Cash Flow', value: free_cash_flow ? fmtNum(free_cash_flow, currencySymbol) : 'N/A' },
  ];

  return (
    <Card className="border border-white/8 bg-[#0b0f1d]/60 backdrop-blur-md">
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row items-start gap-5 p-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600/20 to-purple-600/20
            border border-white/10 flex items-center justify-center text-xl font-black text-white flex-shrink-0 shadow-lg">
            {(ticker||name||'?').slice(0,2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0 w-full">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-xl font-black text-white">{name}</h2>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="text-xs font-black text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">{ticker}</span>
                  {sector && <span className="text-xs text-slate-400 bg-white/5 border border-white/8 px-2 py-0.5 rounded">{sector}</span>}
                  {industry && <span className="text-xs text-slate-500">{industry}</span>}
                </div>
              </div>
              <button onClick={onToggleFavorite} disabled={favLoading}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold
                  transition-all active:scale-[0.96] flex-shrink-0
                  ${isFavorite
                    ? 'bg-rose-500/15 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-rose-400 hover:border-rose-500/20'
                  }`}>
                {favLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
                  isFavorite ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
                {isFavorite ? 'Saved' : 'Save'}
              </button>
            </div>
            {description && <p className="text-xs text-slate-400 leading-relaxed mt-3">{description}</p>}
            {meta.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 mt-4 pt-4 border-t border-white/5">
                {meta.map((m,i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <m.icon className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-none">{m.label}</p>
                      <p className="text-slate-300 font-semibold mt-1 truncate">{m.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* KPI Cards Grid */}
            <div className="mt-5 pt-5 border-t border-white/5">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Key Financial Metrics</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
                {kpis.map((k, i) => (
                  <div key={i} className="bg-white/3 border border-white/5 rounded-xl p-3 flex flex-col justify-center hover:bg-white/5 transition-all">
                    <p className="text-[10px] text-slate-500 font-bold leading-none truncate uppercase tracking-wider">{k.label}</p>
                    <p className="text-xs font-black text-white mt-1.5 leading-none">{k.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// ③ BEAUTIFUL RECOMMENDATION CARD  (with glow + ring)
// ─────────────────────────────────────────────────────────────
function RecommendationCard({ payload, ticker, onExplainScore, onExplainConfidence, onChat, onExport, onPreview, onRetryPdf, analysisDuration }) {
  const { recommendation, ai_score, confidence, risk_level, investment_horizon, scores={}, top_reasons=[], major_risks=[], pdf_status='ready', report_id } = payload;
  const scoreColor = ai_score>=75 ? '#10b981' : ai_score>=50 ? '#f59e0b' : '#ef4444';
  const glowColor  = recommendation==='BUY' ? 'rgba(16,185,129,0.15)' : recommendation==='PASS' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)';

  const catScores = Object.entries(CATEGORY_WEIGHTS).map(([key, cfg]) => ({
    key, ...cfg, value: scores[key] ?? 0
  }));

  const categoryTooltips = {
    financial_health: "Evaluates liquidity, leverage ratios, return on equity (ROE), and gross/net margins.",
    growth: "Measures historical and projected revenue, operating income, and EPS growth trajectory.",
    valuation: "Compares current price multiples (P/E, P/S, EV) against historical averages and peer averages.",
    risk_safety: "Gauges structural safety from debt, operational risks, and overall market volatility.",
    news_sentiment: "Quantifies corporate news sentiment from media channels and corporate statements."
  };

  return (
    <div className="space-y-4">
      {/* ── MAIN VERDICT HERO ── */}
      <motion.div
        initial={{ opacity:0, scale:0.97 }} animate={{ opacity:1, scale:1 }}
        className="relative glass-card rounded-2xl border border-white/10 overflow-hidden"
        style={{ boxShadow: `0 0 60px ${glowColor}, 0 20px 60px rgba(0,0,0,0.5)` }}
      >
        {/* Animated glow blob */}
        <motion.div
          className="absolute -top-20 -right-20 w-64 h-64 rounded-full blur-[80px] pointer-events-none"
          style={{ background: glowColor }}
          animate={{ scale:[1,1.15,1], opacity:[0.6,0.9,0.6] }}
          transition={{ duration:3.5, repeat:Infinity, ease:'easeInOut' }}
        />

        <div className="relative p-6">
          {/* Top row: verdict + ring */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-6">
            {/* Score ring */}
            <div className="relative flex-shrink-0">
              <ScoreRing score={ai_score} size={110} strokeWidth={9} color={scoreColor} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-black text-white tabular-nums leading-none">{ai_score}</span>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">AI Score</span>
              </div>
            </div>

            {/* Verdict + tagline */}
            <div className="flex-1">
              <VerdictBadge verdict={recommendation} size="lg" />
              <p className="text-sm text-slate-350 mt-3.5 leading-relaxed max-w-xs">
                {recommendation === 'BUY'  && 'Strong fundamentals with compelling upside potential.'}
                {recommendation === 'HOLD' && 'Fair value at current levels. Monitor for re-entry.'}
                {recommendation === 'PASS' && 'Risk-reward not favorable at current price levels.'}
              </p>
            </div>
          </div>

          {/* ─── METRIC GRID ─── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label:'Recommendation', value: recommendation || '—', sub:null },
              { label:'AI Score',        value:`${ai_score} / 100`, sub:null },
              { label:'Confidence',      value:`${confidence}%`,    sub:'explain', action: onExplainConfidence },
              { label:'Risk Level',      value: risk_level||'—',    sub:null },
              { label:'Horizon',         value: investment_horizon||'—', sub:null },
              { label:'Generated Date',  value: fmtDate(new Date()), sub:null },
              { label:'Duration',        value: analysisDuration||'—', sub:null },
            ].map(m => (
              <div key={m.label} className="bg-white/4 border border-white/6 rounded-xl px-3 py-3 relative group">
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">{m.label}</p>
                <p className="text-sm font-black text-white mt-1 truncate">{m.value}</p>
                {m.sub === 'explain' && (
                  <button
                    onClick={m.action}
                    className="absolute top-2 right-2 text-[9px] font-bold text-blue-400 bg-blue-500/10
                      border border-blue-500/20 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Why?
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-white/5">
            <div className="flex flex-col">
              <p className="text-[10px] text-slate-500 font-semibold">Generated {fmtDate(new Date())}</p>
              {(pdf_status === 'generating' || pdf_status === 'pending') && (
                <p className="text-[10px] text-blue-400 font-semibold animate-pulse mt-0.5">Generating professional investment report...</p>
              )}
              {pdf_status === 'failed' && (
                <p className="text-[10px] text-rose-500 font-semibold mt-0.5">PDF generation failed. Click Retry PDF.</p>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <button onClick={onChat}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl
                  bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500
                  text-white border border-blue-500/30 shadow-lg shadow-blue-500/15 transition-all active:scale-[0.97]">
                <MessageSquare className="w-3.5 h-3.5" /> Ask AI
              </button>
              
              <button onClick={onPreview}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl
                  bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-all active:scale-[0.97]">
                <Eye className="w-3.5 h-3.5" /> Preview
              </button>
              
              {pdf_status === 'ready' ? (
                <button onClick={() => onExport(ticker)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl
                    bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 hover:scale-[1.02] transition-all duration-300 active:scale-[0.97]">
                  <Download className="w-3.5 h-3.5 text-emerald-450" /> Download PDF
                </button>
              ) : pdf_status === 'failed' ? (
                <button onClick={() => onRetryPdf(report_id)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl
                    bg-rose-950/20 hover:bg-rose-900/30 text-rose-400 border border-rose-500/30 transition-all duration-300 active:scale-[0.97]">
                  <RefreshCw className="w-3.5 h-3.5 text-rose-450 animate-spin" style={{ animationDuration: '3s' }} /> Retry PDF
                </button>
              ) : (
                <button disabled
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl
                    bg-white/4 text-slate-500 border border-white/5 cursor-not-allowed">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Preparing PDF...
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── DECISION BREAKDOWN ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-400" /> Decision Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {catScores.map(cat => {
            const badgeCls = cat.value >= 75
              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
              : cat.value >= 50
                ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                : 'text-red-400 bg-red-500/10 border-red-500/20';

            return (
              <div key={cat.key}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 relative group cursor-help">
                    <span className="text-xs font-semibold text-slate-200 border-b border-dashed border-slate-500 pb-0.5">{cat.label}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border tabular-nums ${badgeCls}`}>[{cat.value}]</span>
                    
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-50 bg-[#0b0f1d] border border-white/10 p-2.5 rounded-lg text-[10px] text-slate-300 w-52 shadow-2xl backdrop-blur-md leading-relaxed pointer-events-none">
                      {categoryTooltips[cat.key]}
                    </div>
                    
                    <button
                      onClick={() => onExplainScore(cat.label, cat.value)}
                      className="flex items-center gap-1 text-[9px] text-blue-400 hover:text-blue-300
                        bg-blue-500/10 hover:bg-blue-500/15 border border-blue-500/20 px-1.5 py-0.5 rounded
                        transition-all font-semibold"
                    >
                      <Sparkles className="w-2.5 h-2.5" /> Explain
                    </button>
                  </div>
                  <span className="text-xs font-black text-white tabular-nums">{cat.value} / 100</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <motion.div className="h-full rounded-full" style={{ background: cat.color }}
                    initial={{ width:0 }} animate={{ width:`${cat.value}%` }}
                    transition={{ duration:1.1, delay:0.1, ease:'easeOut' }} />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* ── WHY INVEST / WHY BE CAREFUL ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-emerald-500/15">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" /> Why Invest
            </CardTitle>
          </CardHeader>
          <CardContent>
            {top_reasons.length === 0
              ? <p className="text-xs text-slate-500 italic">No reasons available</p>
              : <ul className="space-y-2">
                  {top_reasons.map((r,i) => (
                    <motion.li key={i} initial={{opacity:0,x:-8}} animate={{opacity:1,x:0}} transition={{delay:i*0.07}}
                      className="flex items-start gap-2.5 text-sm text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      {r}
                    </motion.li>
                  ))}
                </ul>
            }
          </CardContent>
        </Card>
        <Card className="border-amber-500/15">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-400">
              <AlertTriangle className="w-4 h-4" /> Why Be Careful
            </CardTitle>
          </CardHeader>
          <CardContent>
            {major_risks.length === 0
              ? <p className="text-xs text-slate-500 italic">No risks identified</p>
              : <ul className="space-y-2">
                  {major_risks.map((r,i) => (
                    <motion.li key={i} initial={{opacity:0,x:-8}} animate={{opacity:1,x:0}} transition={{delay:i*0.07}}
                      className="flex items-start gap-2.5 text-sm text-slate-300">
                      <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      {r}
                    </motion.li>
                  ))}
                </ul>
            }
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// FINANCIAL CHARTS
// ─────────────────────────────────────────────────────────────
function generateDemo(metric, period) {
  const base = { revenue:150, profit:30, cashflow:45, debt:60, roe:18, eps:4.5 }[metric]||100;
  const labels = period==='quarterly'
    ? ['Q1\'22','Q2\'22','Q3\'22','Q4\'22','Q1\'23','Q2\'23','Q3\'23','Q4\'23','Q1\'24','Q2\'24']
    : ['2019','2020','2021','2022','2023','2024'];
  return labels.map((p,i) => ({ period:p, value: base*(1+i*0.1+(Math.random()-0.4)*0.06) }));
}

function FinancialCharts({ ticker }) {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState('revenue');
  const [period, setPeriod] = useState('yearly');

  useEffect(() => {
    if (!ticker) return;
    setLoading(true);
    api.get(`/companies/${ticker}/charts/`)
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [ticker]);

  const tabs = [
    { key:'revenue',  label:'Revenue',   color:'#3b82f6' },
    { key:'profit',   label:'Profit',    color:'#10b981' },
    { key:'cashflow', label:'Cash Flow', color:'#8b5cf6' },
    { key:'debt',     label:'Debt',      color:'#ef4444' },
    { key:'roe',      label:'ROE',       color:'#f59e0b' },
    { key:'eps',      label:'EPS',       color:'#06b6d4' },
  ];
  const color = tabs.find(t=>t.key===metric)?.color||'#3b82f6';
  const isPct = metric==='roe';

  const series = (() => {
    if (!data) return [];
    const src = period==='quarterly' ? data.quarterly : data.yearly;
    if (!Array.isArray(src)) return [];
    return src.map(item => ({ period: item.period||item.year||item.quarter, value: item[metric]??0 }));
  })();

  const hasValidData = series.length > 0 && series.some(item => item.value !== 0 && item.value !== null && item.value !== undefined);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-purple-400" /> Financial Charts
          </CardTitle>
          <div className="flex bg-white/5 rounded-lg p-1 border border-white/8 gap-1">
            {['yearly','quarterly'].map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`text-[11px] font-semibold px-3 py-1 rounded-md transition-all capitalize
                  ${period===p ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>
                {p}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap mt-2">
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setMetric(tab.key)}
              className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all
                ${metric===tab.key ? 'text-white border-white/20 shadow' : 'text-slate-400 border-transparent hover:text-white hover:bg-white/5'}`}
              style={metric===tab.key ? {background:`${tab.color}30`, borderColor:`${tab.color}50`} : {}}>
              {tab.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {loading
          ? <div className="h-56 flex items-center justify-center"><Loader2 className="w-6 h-6 text-blue-400 animate-spin" /></div>
          : !hasValidData
            ? <div className="h-56 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-xl bg-white/2 p-6">
                <BarChart2 className="w-8 h-8 text-slate-500 mb-2" />
                <p className="text-sm font-bold text-slate-400">Historical financial data unavailable.</p>
                <p className="text-xs text-slate-550 mt-1">We couldn't retrieve {period} {metric} metrics for {ticker || "this stock"}.</p>
              </div>
            : (() => {
                const currencySymbol = ticker?.toUpperCase().endsWith('.NS') ? '₹' : '$';
                return (
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={series} margin={{top:5,right:10,left:-10,bottom:0}}>
                        <defs>
                          <linearGradient id={`grad_${metric}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                            <stop offset="95%" stopColor={color} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false}/>
                        <XAxis dataKey="period" stroke="rgba(255,255,255,0.25)" fontSize={11} tickLine={false}/>
                        <YAxis stroke="rgba(255,255,255,0.25)" fontSize={11} tickLine={false} axisLine={false}
                          tickFormatter={v => isPct ? `${v.toFixed(0)}%` : fmtNum(v, currencySymbol)}/>
                        <Tooltip content={<DarkTooltip fmt={v => isPct ? `${Number(v).toFixed(1)}%` : fmtNum(v, currencySymbol)}/>}/>
                        <Area type="monotone" dataKey="value" name={tabs.find(t=>t.key===metric)?.label}
                          stroke={color} strokeWidth={2.5} fill={`url(#grad_${metric})`} dot={false}
                          activeDot={{r:5, fill:color}}/>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              );
            })()
        }
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// ④ INTERACTIVE SWOT CARDS
// ─────────────────────────────────────────────────────────────
function SwotCard({ swot={} }) {
  const cells = [
    { key:'strengths',     label:'Strengths',     emoji:'💪', color:'emerald', items: swot.strengths     ||[] },
    { key:'weaknesses',    label:'Weaknesses',    emoji:'⚠️', color:'red',     items: swot.weaknesses    ||[] },
    { key:'opportunities', label:'Opportunities', emoji:'🚀', color:'blue',    items: swot.opportunities ||[] },
    { key:'threats',       label:'Threats',       emoji:'⚡', color:'amber',   items: swot.threats       ||[] },
  ];
  const colorMap = {
    emerald:{ bg:'bg-emerald-500/8',  border:'border-emerald-500/20', title:'text-emerald-400', dot:'bg-emerald-400' },
    red:    { bg:'bg-red-500/8',      border:'border-red-500/20',     title:'text-red-400',     dot:'bg-red-400'     },
    blue:   { bg:'bg-blue-500/8',     border:'border-blue-500/20',    title:'text-blue-400',    dot:'bg-blue-400'    },
    amber:  { bg:'bg-amber-500/8',    border:'border-amber-500/20',   title:'text-amber-400',   dot:'bg-amber-400'   },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="w-4 h-4 text-pink-400" /> SWOT Analysis
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {cells.map((cell, ci) => {
            const c = colorMap[cell.color];
            return (
              <motion.div
                key={cell.key}
                initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
                transition={{ delay: ci * 0.1 }}
                className={`rounded-2xl border p-4 ${c.bg} ${c.border}`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl leading-none">{cell.emoji}</span>
                  <span className={`text-sm font-black uppercase tracking-wide ${c.title}`}>{cell.label}</span>
                </div>
                {cell.items.length === 0
                  ? <p className="text-xs text-slate-600 italic">Not available</p>
                  : <ul className="space-y-2">
                      {cell.items.map((item, i) => (
                        <motion.li key={i}
                          initial={{ opacity:0, x:-6 }} animate={{ opacity:1, x:0 }}
                          transition={{ delay: ci*0.1 + i*0.05 }}
                          className="flex items-start gap-2 text-xs text-slate-300"
                        >
                          <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
                          {item}
                        </motion.li>
                      ))}
                    </ul>
                }
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// NEWS CARD (positive / negative split)
// ─────────────────────────────────────────────────────────────
function NewsCard({ ticker }) {
  const [news, setNews]       = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ticker) return;
    setLoading(true);
    api.get(`/companies/${ticker}/news/`)
      .then(r => setNews(r.data?.news || r.data || []))
      .catch(() => setNews([]))
      .finally(() => setLoading(false));
  }, [ticker]);

  const positive = news.filter(n => (n.sentiment||'').toLowerCase()==='positive' || (n.score||0)>0);
  const negative = news.filter(n => (n.sentiment||'').toLowerCase()==='negative' || (n.score||0)<0);
  const neutral  = news.filter(n => !positive.includes(n) && !negative.includes(n));

  if (loading) return <CardSkeleton />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Newspaper className="w-4 h-4 text-sky-400" /> Latest News
        </CardTitle>
      </CardHeader>
      <CardContent>
        {news.length === 0
          ? <EmptyState icon={Newspaper} title="No recent news" description="No recent news could be retrieved from the configured financial data source." />
          : <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Positive */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-xs font-black text-emerald-400 uppercase tracking-wider">Positive News</span>
                </div>
                <div className="space-y-2">
                  {(positive.length>0 ? positive : neutral).slice(0,4).map((n,i)=>(
                    <a key={i} href={n.url||'#'} target="_blank" rel="noopener noreferrer"
                      className="block p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15 hover:border-emerald-500/35 transition-all group">
                      <p className="text-xs text-slate-300 font-medium leading-snug line-clamp-2 group-hover:text-white transition-colors">
                        <CheckCircle2 className="inline w-3 h-3 text-emerald-400 mr-1.5 mb-0.5" />
                        {n.title||n.headline||String(n)}
                      </p>
                      {(n.source||n.publisher) && <p className="text-[10px] text-slate-500 mt-1">{n.source||n.publisher}</p>}
                    </a>
                  ))}
                  {positive.length===0 && neutral.length===0 && <p className="text-xs text-slate-600 italic">No positive news</p>}
                </div>
              </div>
              {/* Negative */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-red-400" />
                  <span className="text-xs font-black text-red-400 uppercase tracking-wider">Risk News</span>
                </div>
                <div className="space-y-2">
                  {negative.slice(0,4).map((n,i)=>(
                    <a key={i} href={n.url||'#'} target="_blank" rel="noopener noreferrer"
                      className="block p-3 rounded-xl bg-red-500/5 border border-red-500/15 hover:border-red-500/35 transition-all group">
                      <p className="text-xs text-slate-300 font-medium leading-snug line-clamp-2 group-hover:text-white transition-colors">
                        <AlertTriangle className="inline w-3 h-3 text-amber-400 mr-1.5 mb-0.5" />
                        {n.title||n.headline||String(n)}
                      </p>
                      {(n.source||n.publisher) && <p className="text-[10px] text-slate-500 mt-1">{n.source||n.publisher}</p>}
                    </a>
                  ))}
                  {negative.length===0 && <p className="text-xs text-slate-600 italic">No risk news identified</p>}
                </div>
              </div>
            </div>
        }
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// RELATED COMPANIES
// ─────────────────────────────────────────────────────────────
const RelatedCompanies = React.memo(({ ticker, onAnalyze }) => {
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ticker) return;
    setLoading(true);
    api.get(`/companies/${ticker}/related/`)
      .then(r => setRelated(r.data?.related||r.data||[]))
      .catch(() => setRelated([]))
      .finally(() => setLoading(false));
  }, [ticker]);

  const fmtMarketCap = (num) => {
    if (!num || isNaN(num)) return 'N/A';
    const absNum = Math.abs(num);
    if (absNum >= 1e12) return (num / 1e12).toFixed(2) + 'T';
    if (absNum >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (absNum >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    return num.toLocaleString();
  };

  const handlePeerClick = (peerTicker) => {
    if (onAnalyze) {
      onAnalyze(peerTicker);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (loading) {
    return (
      <Card className="border border-white/5 bg-slate-900/40 backdrop-blur-md">
        <CardContent className="p-6 flex flex-col items-center justify-center min-h-[150px] gap-2">
          <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
          <p className="text-xs text-slate-400 font-medium">Finding peer comparisons...</p>
        </CardContent>
      </Card>
    );
  }

  if (!related.length) return null;

  return (
    <Card className="border border-white/5 bg-slate-900/40 backdrop-blur-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Globe className="w-4 h-4 text-violet-400" /> Related Companies
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-row overflow-x-auto lg:grid lg:grid-cols-2 xl:grid-cols-4 gap-4 scrollbar-thin scrollbar-thumb-white/10 pb-2">
          {related.slice(0, 8).map((peer, i) => {
            const pTicker = typeof peer === 'string' ? peer : peer.ticker;
            const name = typeof peer === 'object' ? peer.name : pTicker;
            const sector = typeof peer === 'object' ? peer.sector : 'N/A';
            const industry = typeof peer === 'object' ? peer.industry : 'N/A';
            const marketCap = typeof peer === 'object' ? peer.market_cap : 0;
            const similarity = typeof peer === 'object' ? peer.similarity : 80;
            const recommendation = typeof peer === 'object' ? peer.recommendation : null;
            const aiScore = typeof peer === 'object' ? peer.ai_score : null;

            // Gradient initials avatar
            const words = name ? name.split(' ') : [];
            const initials = words.length >= 2 
              ? (words[0][0] + words[1][0]).toUpperCase()
              : words.length === 1 
                ? words[0].slice(0, 2).toUpperCase()
                : pTicker.slice(0, 2).toUpperCase();

            // Similarity badge color
            let simCls = 'bg-slate-500/10 border-slate-500/20 text-slate-300';
            if (similarity >= 90) simCls = 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
            else if (similarity >= 75) simCls = 'bg-blue-500/10 border-blue-500/20 text-blue-400';
            else if (similarity >= 60) simCls = 'bg-amber-500/10 border-amber-500/20 text-amber-400';

            // Recommendation badge colors
            let recCls = 'bg-slate-500/10 border-slate-500/20 text-slate-400';
            if (recommendation === 'STRONG BUY') recCls = 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300 font-extrabold shadow-lg shadow-emerald-500/10';
            else if (recommendation === 'BUY') recCls = 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
            else if (recommendation === 'HOLD') recCls = 'bg-amber-500/10 border-amber-500/20 text-amber-400';
            else if (recommendation === 'PASS') recCls = 'bg-red-500/10 border-red-500/20 text-red-400';

            return (
              <motion.div
                key={pTicker}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => handlePeerClick(pTicker)}
                className="flex-shrink-0 w-[240px] lg:w-auto glass-card border border-white/5 hover:border-white/10 hover:bg-white/5 p-4 rounded-2xl flex flex-col gap-3 transition-all cursor-pointer relative group active:scale-[0.98]"
                role="button"
                aria-label={`View peer company analysis for ${name}`}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handlePeerClick(pTicker);
                  }
                }}
              >
                {/* Header Row */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600/30 to-purple-600/30 border border-violet-500/20 flex items-center justify-center font-bold text-white text-xs flex-shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-white truncate leading-snug group-hover:text-violet-300 transition-colors">{name}</h4>
                    <span className="text-[10px] text-slate-400 font-semibold">{pTicker}</span>
                  </div>
                </div>

                {/* Similarity score */}
                <div className="flex items-center justify-between text-[11px] border-b border-white/5 pb-2">
                  <span className="text-slate-400">Similarity</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${simCls}`}>
                    {similarity}%
                  </span>
                </div>

                {/* Body Meta Info */}
                <div className="flex flex-col gap-1 text-[10px] text-slate-400 flex-1">
                  <div className="flex justify-between">
                    <span>Sector</span>
                    <span className="text-slate-200 truncate max-w-[120px] text-right font-medium">{sector}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Industry</span>
                    <span className="text-slate-200 truncate max-w-[120px] text-right font-medium">{industry}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Market Cap</span>
                    <span className="text-slate-200 font-medium">{fmtMarketCap(marketCap)}</span>
                  </div>
                </div>

                {/* Score & Verdict Footer Row */}
                {recommendation && (
                  <div className="flex items-center justify-between pt-2 border-t border-white/5 gap-2">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded border leading-none uppercase ${recCls}`}>
                      {recommendation}
                    </span>
                    {aiScore !== null && (
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-slate-400">Score</span>
                        <span className="text-xs font-black text-white">{aiScore}</span>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
})

// ─────────────────────────────────────────────────────────────
// ⑤ AI CHAT PANEL with suggested questions
// ─────────────────────────────────────────────────────────────
function AIChatPanel({ ticker, conversationId, onClose }) {
  const [messages, setMessages] = useState([
    { role:'assistant', content:`Hello! I can answer detailed questions about **${ticker}** based on the full research report. What would you like to know?` }
  ]);
  const [input, setInput]   = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const { error: toastError } = useToast();

  const chatSuggestions = [
    `What are the main growth drivers for ${ticker}?`,
    `Explain the debt structure and interest coverage.`,
    `What is the sector risk outlook?`,
    `Are there any recent news controversies?`,
    `Is the current valuation premium justified?`
  ];

  useEffect(() => {
    const timer = setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 80);
    return () => clearTimeout(timer);
  }, [messages, sending]);

  const send = async (msg) => {
    const text = msg || input.trim();
    if (!text || sending) return;
    setInput('');
    setMessages(prev => [...prev, { role:'user', content:text }]);
    setSending(true);
    try {
      const res = await researchService.chat(ticker, text, conversationId);
      setMessages(prev => [...prev, { role:'assistant', content: res.reply }]);
    } catch {
      toastError('AI Chat failed — please retry.');
      setMessages(prev => [...prev, { role:'assistant', content:'Sorry, I could not process that request right now.' }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:20}}
      className="glass-card rounded-2xl border border-blue-500/20 flex flex-col overflow-hidden"
      style={{ height:'520px' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/6 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Brain className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div>
            <p className="text-xs font-bold text-white">Ask AI about {ticker}</p>
            <p className="text-[10px] text-slate-500">History: {messages.length} messages &bull; Turn {Math.floor(messages.length / 2)}</p>
          </div>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
        {messages.map((m,i) => (
          <div key={i} className={`flex ${m.role==='user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed
              ${m.role==='user'
                ? 'bg-blue-600/20 border border-blue-500/30 text-slate-200'
                : 'bg-white/5 border border-white/8 text-slate-300'}`}>
              {m.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-white/5 border border-white/8 rounded-2xl px-4 py-2.5 flex items-center gap-2.5">
              <span className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </span>
              <span className="text-xs text-slate-500 font-medium">InvestIQ is thinking...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggested Questions (Horizontal Scroll pills) */}
      <div className="px-4 py-2 flex gap-1.5 overflow-x-auto no-scrollbar flex-shrink-0 border-t border-white/5 bg-white/1">
        {chatSuggestions.filter(q => !messages.some(m => m.content === q)).slice(0, 3).map((q,i) => (
          <button key={i} onClick={() => send(q)} disabled={sending}
            className="text-slate-400 hover:text-white bg-white/5 border border-white/8 hover:bg-blue-600/10 hover:border-blue-500/30 px-2.5 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap transition-all">
            {q}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-white/6 flex gap-2 flex-shrink-0">
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key==='Enter' && !e.shiftKey && send()}
          placeholder="Ask about financials, risks, growth…"
          className="glass-input flex-1 py-2 px-3 text-xs" autoFocus/>
        <button onClick={() => send()} disabled={!input.trim()||sending}
          className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white
            disabled:opacity-40 transition-all active:scale-[0.97] flex-shrink-0">
          {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
        </button>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// SCORE EXPLAIN MODAL
// ─────────────────────────────────────────────────────────────
function ExplainScoreModal({ category, score, ticker, onClose }) {
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading]         = useState(true);
  const { error: toastError }         = useToast();

  useEffect(() => {
    researchService.explain(ticker, category, score)
      .then(r => setExplanation(r.reply||'Explanation unavailable.'))
      .catch(() => { toastError('Could not generate explanation'); setExplanation('Explanation unavailable.'); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose}/>
      <motion.div initial={{scale:0.95,y:10}} animate={{scale:1,y:0}}
        className="relative w-full max-w-lg bg-[#0a0f1d] border border-white/10 rounded-2xl shadow-2xl p-6 z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-400"/>
            <h3 className="font-bold text-white">Score Explanation</h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X className="w-4 h-4"/></button>
        </div>
        <div className="flex items-center gap-3 mb-4 p-3 bg-white/4 rounded-xl border border-white/8">
          <div className="text-center flex-shrink-0">
            <p className="text-2xl font-black text-white">{score}</p>
            <p className="text-[9px] text-slate-500 uppercase tracking-wider">/ 100</p>
          </div>
          <div>
            <p className="text-sm font-bold text-white">{category}</p>
            <p className="text-xs text-slate-400 mt-0.5">{ticker} · AI-Calculated</p>
          </div>
        </div>
        {loading
          ? <div className="flex items-center gap-3 py-4"><Loader2 className="w-5 h-5 text-blue-400 animate-spin"/><span className="text-sm text-slate-400">Generating explanation…</span></div>
          : <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap bg-white/3 rounded-xl p-4 border border-white/6 max-h-60 overflow-y-auto no-scrollbar">{explanation}</div>
        }
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// ⑥ CONFIDENCE BREAKDOWN MODAL  (deterministic formula)
// ─────────────────────────────────────────────────────────────
function ConfidenceModal({ confidence, scores, onClose }) {
  const contributions = calcConfidenceBreakdown(scores);
  const maxAbs = Math.max(...contributions.map(c => Math.abs(c.contribution)), 1);

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose}/>
      <motion.div initial={{scale:0.95,y:10}} animate={{scale:1,y:0}}
        className="relative w-full max-w-md bg-[#0a0f1d] border border-white/10 rounded-2xl shadow-2xl p-6 z-10">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400"/>
            <h3 className="font-bold text-white">Confidence Calculation</h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X className="w-4 h-4"/></button>
        </div>

        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          Each category contributes to confidence based on its weighted score deviation from the 50-point baseline.
        </p>

        <div className="space-y-3 mb-5">
          {contributions.map((cat, i) => {
            const isPos = cat.contribution >= 0;
            const barW  = Math.abs(cat.contribution) / maxAbs * 100;
            return (
              <motion.div key={cat.key}
                initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} transition={{delay:i*0.06}}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-300">{cat.label}</span>
                  <span className={`text-xs font-black tabular-nums ${isPos ? 'text-emerald-400' : 'text-red-400'}`}>
                    {isPos ? '+' : ''}{cat.contribution}
                  </span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden flex">
                  {isPos
                    ? <><div className="w-1/2" /><motion.div className="h-full rounded-r-full" style={{background: cat.color}}
                          initial={{width:0}} animate={{width:`${barW/2}%`}} transition={{duration:0.7,delay:i*0.06}}/></>
                    : <><motion.div className="h-full rounded-l-full ml-auto" style={{background:'#ef4444'}}
                          initial={{width:0}} animate={{width:`${barW/2}%`}} transition={{duration:0.7,delay:i*0.06}}/><div className="w-1/2" /></>
                  }
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Divider */}
        <div className="border-t border-white/8 pt-4 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-400">Final Confidence</span>
          <motion.span
            initial={{opacity:0,scale:0.8}} animate={{opacity:1,scale:1}} transition={{delay:0.4}}
            className="text-2xl font-black text-purple-400"
          >
            {confidence}%
          </motion.span>
        </div>
        <p className="text-[10px] text-slate-600 mt-2">
          Weighted formula: Financial (30%) · Growth (25%) · Valuation (20%) · Risk (15%) · News (10%)
        </p>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// PDF PREVIEW MODAL
// ─────────────────────────────────────────────────────────────
function PdfPreviewModal({ ticker, htmlUrl, reportHtml, pdfStatus, reportData, onClose, onDownload, onRetryPdf }) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    await onDownload(ticker);
    setDownloading(false);
  };

  // Prefer inline HTML for instant render; fall back to file URL when ready
  const hasInlineHtml = Boolean(reportHtml);
  const hasFileUrl    = pdfStatus === 'ready' && Boolean(htmlUrl);

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}/>
      <motion.div initial={{scale:0.95,y:10}} animate={{scale:1,y:0}}
        className="relative w-full max-w-5xl bg-[#0a0f1d] border border-white/10 rounded-2xl shadow-2xl flex flex-col z-10"
        style={{ height:'88vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/8 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <FileText className="w-4 h-4 text-emerald-400"/>
            <span className="text-sm font-bold text-white">{ticker} — Investment Report Preview</span>
            {pdfStatus === 'ready' ? (
              <span className="px-2.5 py-0.5 text-[9px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full animate-pulse">PDF Ready</span>
            ) : hasInlineHtml ? (
              <span className="px-2.5 py-0.5 text-[9px] font-black text-sky-400 bg-sky-500/10 border border-sky-500/20 rounded-full">Live Preview</span>
            ) : (
              <span className="px-2.5 py-0.5 text-[9px] font-black text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full">Generating…</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {pdfStatus === 'ready' && (
              <button onClick={handleDownload} disabled={downloading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg
                  bg-emerald-600 hover:bg-emerald-500 text-white transition-all active:scale-[0.97] disabled:opacity-50">
                {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Download className="w-3.5 h-3.5"/>}
                Download PDF
              </button>
            )}

            {pdfStatus === 'failed' && (
              <button onClick={() => onRetryPdf(reportData?.report_id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg
                  bg-rose-950/20 text-rose-400 hover:bg-rose-900/35 border border-rose-500/25 transition-all active:scale-[0.97]">
                <RefreshCw className="w-3.5 h-3.5 text-rose-400" />
                Retry PDF
              </button>
            )}
            
            {(pdfStatus === 'generating' || pdfStatus === 'pending') && (
              <button disabled
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg
                  bg-white/4 text-slate-500 border border-white/5 cursor-not-allowed">
                <Loader2 className="w-3.5 h-3.5 animate-spin"/>
                Preparing PDF...
              </button>
            )}

            <button onClick={() => { navigator.clipboard.writeText(window.location.href); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg
                bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-all">
              <Share2 className="w-3.5 h-3.5"/> Share
            </button>
            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors ml-1">
              <X className="w-4 h-4"/>
            </button>
          </div>
        </div>

        {/* Preview body */}
        <div className="flex-1 overflow-hidden rounded-b-2xl bg-white">
          {hasInlineHtml ? (
            // Instant inline HTML preview — available immediately after analysis completes
            <iframe
              srcDoc={reportHtml}
              className="w-full h-full border-0"
              title="Report Preview"
              sandbox="allow-same-origin allow-popups"
            />
          ) : hasFileUrl ? (
            // PDF file served from Django media storage
            <iframe
              src={htmlUrl}
              className="w-full h-full border-0"
              title="Report Preview"
              sandbox="allow-same-origin allow-popups"
            />
          ) : (
            // Skeleton loader while HTML is being compiled
            <div className="w-full h-full flex flex-col items-center justify-center gap-6 bg-[#0b0f1d]">
              <Loader2 className="w-10 h-10 text-emerald-400 animate-spin"/>
              <div className="text-center">
                <p className="text-sm font-bold text-white">Compiling Report…</p>
                <p className="text-xs text-slate-500 mt-1">The HTML report is being generated. This takes only a moment.</p>
              </div>
              <div className="w-64 space-y-2 opacity-30">
                {[100,80,90,60,75].map((w,i) => (
                  <div key={i} className="h-2.5 rounded-full bg-white/10 animate-pulse" style={{width:`${w}%`}}/>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────
export default function ResearchWorkspace() {
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();
  const { success, error: toastError, info } = useToast();

  const [query,         setQuery]         = useState(searchParams.get('q')||'');
  const [analysisState, setAnalysisState] = useState(null); // null|'loading'|'done'|'error'
  const [activeNode,    setActiveNode]    = useState('company_research');
  const [stepsState,    setStepsState]    = useState([]);
  const [result,        setResult]        = useState(null);
  const [isFavorite,    setIsFavorite]    = useState(false);
  const [favLoading,    setFavLoading]    = useState(false);
  const [showChat,      setShowChat]      = useState(false);
  const [explainScore,  setExplainScore]  = useState(null);  // {category,score}
  const [showConfidence,setShowConfidence]= useState(false);
  const [showPdfPreview,setShowPdfPreview]= useState(false);
  const [analysisDuration, setAnalysisDuration] = useState('8.4s');

  const pollRef    = useRef(null);
  const nodeTimRef = useRef(null);

  const updateActiveStep = useCallback((nodeName) => {
    const targetIdx = getStepIndex(nodeName);
    setStepsState(prev => {
      if (!prev.length) return prev;
      return prev.map((step, idx) => {
        if (idx < targetIdx) {
          if (step.status !== 'done') {
            return {
              ...step,
              status: 'done',
              duration: step.startedAt ? (Date.now() - step.startedAt) / 1000 : 1.5
            };
          }
        } else if (idx === targetIdx) {
          if (step.status === 'pending') {
            return {
              ...step,
              status: 'active',
              startedAt: Date.now()
            };
          }
        }
        return step;
      });
    });
  }, []);

  // Poll AIConversation.status from backend while analyzing
  const startStatusPoll = useCallback(() => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.get('/chat/conversations/');
        const convs = res.data?.results || res.data || [];
        const latest = convs[0];
        if (latest?.status && latest.status !== 'completed') {
          setActiveNode(latest.status);
          updateActiveStep(latest.status);
        }
      } catch { /* ignore */ }
    }, 2500);
  }, [updateActiveStep]);

  const stopPoll = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (nodeTimRef.current) { clearInterval(nodeTimRef.current); nodeTimRef.current = null; }
  }, []);

  useEffect(() => () => stopPoll(), [stopPoll]);

  // Live timer tick logic for active steps (100ms interval)
  useEffect(() => {
    if (analysisState !== 'loading') return;
    const interval = setInterval(() => {
      setStepsState(prev => {
        if (!prev.length) return prev;
        return prev.map(step => {
          if (step.status === 'active' && step.startedAt) {
            return { ...step, duration: (Date.now() - step.startedAt) / 1000 };
          }
          return step;
        });
      });
    }, 100);
    return () => clearInterval(interval);
  }, [analysisState]);

  // Auto-run from URL param
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) handleAnalyze(q);
  }, []); // eslint-disable-line

  const handleAnalyze = useCallback(async (q) => {
    if (!q?.trim()) return;
    const t0 = performance.now();
    setQuery(q);
    setAnalysisState('loading');
    setResult(null);
    setShowChat(false);
    setActiveNode('company_research');
    
    // Initialize steps state
    const initialSteps = ANALYSIS_STEPS.map((s, i) => ({
      status: i === 0 ? 'active' : 'pending',
      startedAt: i === 0 ? Date.now() : null,
      duration: 0,
    }));
    setStepsState(initialSteps);
    
    stopPoll();

    // Fallback timer in case real status poll doesn't fire fast enough
    let idx = 0;
    nodeTimRef.current = setInterval(() => {
      idx = Math.min(idx + 1, 5); // Limit to index 5 (report generator step)
      const nextNode = ['company_research', 'financial_analysis', 'news_analysis', 'scores_calculation', 'recommendation', 'report_generator'][idx];
      if (nextNode) {
        setActiveNode(nextNode);
        updateActiveStep(nextNode);
      }
    }, 5000);

    // Start real polling
    startStatusPoll();

    try {
      const data = await researchService.analyze(q);
      stopPoll();
      
      const t_analysis = performance.now();
      const primaryDuration = ((t_analysis - t0) / 1000).toFixed(1) + 's';
      setAnalysisDuration(primaryDuration);
      
      // Stop the regular progress and mark up to Preparing Report as complete
      setStepsState(prev => {
        if (!prev.length) return prev;
        let updated = [...prev];
        for (let i = 0; i <= 5; i++) {
          updated[i].status = 'done';
          if (updated[i].startedAt) {
            updated[i].duration = (Date.now() - updated[i].startedAt) / 1000;
          } else {
            updated[i].duration = 2.0; // fallback duration for skipped/fast steps
          }
        }
        // Start PDF generation step
        updated[6].status = 'active';
        updated[6].startedAt = Date.now();
        return updated;
      });
      setActiveNode('pdf_ready');

      const reportId = data.report_id;
      if (reportId && data.pdf_status !== 'ready') {
        let attempts = 0;
        const pdfPollInterval = setInterval(async () => {
          attempts++;
          try {
            const statusData = await researchService.checkReportStatus(reportId);
            if (statusData.status === 'ready') {
              clearInterval(pdfPollInterval);
              
              setStepsState(prev => {
                if (!prev.length) return prev;
                let updated = [...prev];
                updated[6].status = 'done';
                if (updated[6].startedAt) {
                  updated[6].duration = (Date.now() - updated[6].startedAt) / 1000;
                }
                return updated;
              });
              
              setResult({ ...data, pdf_status: 'ready', html_url: statusData.download_url || statusData.html_url });
              setAnalysisState('done');
              success('Investment report generated successfully.');
            } else if (statusData.status === 'failed') {
              clearInterval(pdfPollInterval);
              setStepsState(prev => {
                if (!prev.length) return prev;
                let updated = [...prev];
                updated[6].status = 'failed';
                return updated;
              });
              setResult({ ...data, pdf_status: 'failed' });
              setAnalysisState('done');
              toastError('PDF report generation failed. You can retry it from the dashboard.');
            }
          } catch (e) {
            if (attempts > 30) {
              clearInterval(pdfPollInterval);
              toastError('PDF polling timed out.');
            }
          }
        }, 2000);
      } else {
        setStepsState(prev => {
          if (!prev.length) return prev;
          let updated = [...prev];
          updated[6].status = 'done';
          updated[6].duration = 0.5;
          return updated;
        });
        setResult(data);
        setAnalysisState('done');
        success('Investment report generated successfully.');
      }

      // Check favorites
      try {
        const favs = await researchService.getFavorites();
        setIsFavorite((favs||[]).some(f => f.company_details?.ticker === data.ticker));
      } catch { /* ignore */ }
    } catch (err) {
      stopPoll();
      setAnalysisState('error');
      toastError(err?.response?.data?.detail || 'Analysis failed. Please try again.');
    }
  }, [startStatusPoll, stopPoll, success, toastError, updateActiveStep]);

  const handleRetryPdf = useCallback(async (reportId) => {
    if (!reportId) return;
    try {
      info('Retrying PDF generation…');
      // Set status back to pending to trigger loader
      setResult(prev => prev ? { ...prev, pdf_status: 'pending' } : prev);
      
      await researchService.retryReportStatus(reportId);
      
      let attempts = 0;
      const pdfPollInterval = setInterval(async () => {
        attempts++;
        try {
          const statusData = await researchService.checkReportStatus(reportId);
          if (statusData.status === 'ready') {
            clearInterval(pdfPollInterval);
            setResult(prev => prev ? { ...prev, pdf_status: 'ready', html_url: statusData.html_url } : prev);
            success('Investment report generated successfully.');
          } else if (statusData.status === 'failed') {
            clearInterval(pdfPollInterval);
            setResult(prev => prev ? { ...prev, pdf_status: 'failed' } : prev);
            toastError('PDF report generation failed again.');
          }
        } catch (e) {
          if (attempts > 30) {
            clearInterval(pdfPollInterval);
            toastError('PDF polling timed out.');
          }
        }
      }, 2000);
    } catch {
      toastError('Could not retry PDF generation.');
    }
  }, [info, success, toastError]);

  const handleToggleFavorite = useCallback(async () => {
    if (!result?.ticker) return;
    setFavLoading(true);
    try {
      const res = await researchService.toggleFavorite(result.ticker);
      setIsFavorite(res.is_favorite);
      success(res.is_favorite ? 'Added to favorites!' : 'Removed from favorites');
    } catch { toastError('Could not update favorites'); }
    finally { setFavLoading(false); }
  }, [result, success, toastError]);

  const handleExport = useCallback(async (ticker) => {
    try {
      info('Compiling PDF report…');

      // Use inline HTML if already in memory (avoids backend round-trip)
      let htmlText = result?.report_html || null;
      if (!htmlText) {
        const blob = await researchService.exportPdf(ticker);
        htmlText = await blob.text();
      }

      const runExport = () => {
        const element = document.createElement('div');
        element.style.width = '210mm';
        element.style.margin = '0';
        element.style.padding = '0';
        element.style.background = 'white';
        element.style.position = 'relative';
        element.innerHTML = htmlText;

        const opt = {
          margin:       0,
          filename:     `${ticker}_InvestIQ_Report.pdf`,
          image:        { type: 'jpeg', quality: 0.98 },
          html2canvas:  { scale: 2, useCORS: true, logging: false },
          jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak:    { mode: ['css', 'legacy'] }
        };

        window.html2pdf().set(opt).from(element).save()
          .then(() => success('PDF downloaded successfully!'))
          .catch(() => toastError('PDF compilation failed.'));
      };

      if (window.html2pdf) {
        runExport();
      } else {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        script.onload = runExport;
        script.onerror = () => toastError('Failed to load PDF library.');
        document.body.appendChild(script);
      }
    } catch {
      toastError('Export failed.');
    }
  }, [info, success, toastError, result]);

  // Derived data
  const payload = result ? {
    recommendation:     result.verdict,
    ai_score:           result.overall_score ?? 0,
    confidence:         result.confidence ?? 0,
    risk_level:         result.risk_level,
    investment_horizon: result.horizon,
    scores:             result.scores || {},
    top_reasons:        result.top_reasons || [],
    major_risks:        result.major_risks || [],
    pdf_status:         result.pdf_status || 'ready',
    report_id:          result.report_id,
  } : null;

  const companyData = result ? {
    name: result.name, ticker: result.ticker,
    sector: result.sector, industry: result.industry,
    description: result.description,
    financial_summary: result.financial_summary || {},
    ratios: result.ratios || {},
    preprocessed_metrics: result.preprocessed_metrics || {},
    free_cash_flow: result.historical_yearly?.[0]?.free_cash_flow ?? result.financial_summary?.free_cash_flow ?? null,
  } : null;

  const swotData = result?.report_markdown ? extractSwot(result.report_markdown) : {};

  return (
    <div className="min-h-full pb-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white">
          Company <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">Analysis</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">AI-powered investment research across 10 analytical dimensions.</p>
      </div>

      {/* Search */}
      <WorkspaceSearch onSearch={handleAnalyze} initialQuery={query} isLoading={analysisState==='loading'}/>

      {/* ① Live progress */}
      <AnimatePresence>
        {analysisState==='loading' && (
          <LiveProgress stepsState={stepsState} companyName={query}/>
        )}
      </AnimatePresence>

      {/* Error */}
      <AnimatePresence>
        {analysisState==='error' && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="glass-card rounded-2xl p-6 border border-red-500/20 flex items-center gap-4">
            <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0"/>
            <div className="flex-1">
              <p className="text-sm font-bold text-white">Analysis Failed</p>
              <p className="text-xs text-slate-400 mt-0.5">Check the company name and try again.</p>
            </div>
            <button onClick={() => setAnalysisState(null)} className="text-slate-500 hover:text-white"><X className="w-4 h-4"/></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Idle/empty */}
      {!analysisState && !result && (
        <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}
          className="glass-card rounded-2xl p-10 border border-white/5 text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-4">
            <Brain className="w-8 h-8 text-blue-400"/>
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Start Your Analysis</h2>
          <p className="text-sm text-slate-400 max-w-sm mx-auto mb-6">
            Enter any company name or ticker above to generate a complete AI investment report.
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {['NVIDIA','Apple','Reliance Industries','Tesla','Microsoft'].map(s => (
              <button key={s} onClick={() => handleAnalyze(s)}
                className="px-4 py-2 text-xs font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20
                  hover:bg-blue-500/20 rounded-xl transition-all active:scale-[0.97]">
                {s}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* ② Streaming Results */}
      {analysisState==='done' && result && (
        <div className="space-y-6">
          {/* S0 — Company */}
          <StreamSection index={0}>
            {companyData && (
              <CompanyCard data={companyData} isFavorite={isFavorite}
                onToggleFavorite={handleToggleFavorite} favLoading={favLoading}/>
            )}
          </StreamSection>

          {/* Main layout */}
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
            {/* LEFT */}
            <div className="space-y-6">
              {/* S1 — Recommendation */}
              <StreamSection index={1}>
                {payload && (
                  <RecommendationCard
                    payload={payload}
                    ticker={result.ticker}
                    onExplainScore={(cat, score) => setExplainScore({ category: cat, score })}
                    onExplainConfidence={() => setShowConfidence(true)}
                    onChat={() => setShowChat(s => !s)}
                    onExport={handleExport}
                    onPreview={() => setShowPdfPreview(true)}
                    onRetryPdf={handleRetryPdf}
                    analysisDuration={analysisDuration}
                  />
                )}
              </StreamSection>

              {/* S2 — Charts */}
              <StreamSection index={2}>
                <FinancialCharts ticker={result.ticker}/>
              </StreamSection>

              {/* S3 — SWOT */}
              <StreamSection index={3}>
                <SwotCard swot={swotData}/>
              </StreamSection>

              {/* S4 — News */}
              <StreamSection index={4}>
                <NewsCard ticker={result.ticker}/>
              </StreamSection>

              {/* S5 — Related */}
              <StreamSection index={5}>
                <RelatedCompanies ticker={result.ticker} onAnalyze={handleAnalyze}/>
              </StreamSection>
            </div>

            {/* RIGHT — sticky chat */}
            <div className="xl:sticky xl:top-6 xl:self-start">
              <StreamSection index={1}>
                <AnimatePresence mode="wait">
                  {showChat ? (
                    <AIChatPanel key="chat" ticker={result.ticker}
                      conversationId={result.conversation_id}
                      onClose={() => setShowChat(false)}/>
                  ) : (
                    <motion.div key="cta" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
                      className="glass-card rounded-2xl p-6 border border-blue-500/20 text-center">
                      <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-3">
                        <MessageSquare className="w-6 h-6 text-blue-400"/>
                      </div>
                      <h3 className="text-sm font-bold text-white mb-1">Ask AI About {result.ticker}</h3>
                      <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                        Ask follow-up questions about financials, risks, or investment thesis.
                      </p>
                      <button onClick={() => setShowChat(true)}
                        className="w-full py-2.5 text-sm font-bold text-white rounded-xl border border-blue-500/30
                          bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500
                          shadow-lg shadow-blue-500/20 transition-all active:scale-[0.97]">
                        Open AI Chat
                      </button>

                      {/* Suggested questions */}
                      <div className="mt-4 space-y-2">
                        <p className="text-[10px] text-slate-600 font-semibold uppercase tracking-wider text-left">Suggested Questions</p>
                        {CHAT_SUGGESTIONS.map((q,i) => (
                          <button key={i}
                            onClick={() => { setShowChat(true); }}
                            className="w-full text-left text-xs text-slate-400 hover:text-blue-400 px-3 py-2
                              rounded-lg bg-white/3 hover:bg-blue-500/10 border border-white/5 hover:border-blue-500/20 transition-all">
                            "{q}"
                          </button>
                        ))}
                      </div>

                      {/* Toolbar */}
                      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/6 pt-4">
                        {[
                          { icon:Scale,    label:'Compare', action:() => navigate('/compare') },
                          { icon:Eye,      label:'Preview', action:() => setShowPdfPreview(true) },
                          { icon:Copy,     label:'Copy',    action:() => { navigator.clipboard.writeText(result.ticker); success('Copied!'); } },
                        ].map(a => (
                          <button key={a.label} onClick={a.action}
                            className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-white/3 hover:bg-white/8
                              border border-white/6 text-slate-400 hover:text-white transition-all text-xs font-medium">
                            <a.icon className="w-4 h-4"/> {a.label}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </StreamSection>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {explainScore && (
          <ExplainScoreModal
            category={explainScore.category}
            score={explainScore.score}
            ticker={result?.ticker}
            onClose={() => setExplainScore(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showConfidence && payload && (
          <ConfidenceModal
            confidence={payload.confidence}
            scores={payload.scores}
            onClose={() => setShowConfidence(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPdfPreview && result && (() => {
          const getFullMediaUrl = (url) => {
            if (!url) return '';
            if (url.startsWith('http')) return url;
            let base = api.defaults.baseURL.replace(/\/api$/, '');
            // If parent is localhost, align backend url to localhost for connection security
            if (window.location.hostname === 'localhost') {
              base = base.replace('127.0.0.1', 'localhost');
            }
            return `${base}${url}`;
          };
          return (
            <PdfPreviewModal
              ticker={result.ticker}
              htmlUrl={getFullMediaUrl(result.html_url)}
              reportHtml={result.report_html || null}
              pdfStatus={result.pdf_status}
              reportData={result}
              onClose={() => setShowPdfPreview(false)}
              onDownload={handleExport}
              onRetryPdf={handleRetryPdf}
            />
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
