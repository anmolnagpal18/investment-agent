import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, TrendingUp, TrendingDown, Zap, BarChart2, Scale,
  MessageSquare, FileText, Star, Clock, ArrowRight, ArrowUpRight,
  Activity, Globe, Newspaper, RefreshCw, Heart, GitCompare,
  ChevronRight, Sparkles, Shield, Brain, AlertCircle, ExternalLink,
  BookOpen, Target, X
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useDashboard } from '../hooks/useDashboard';
import { useAnimatedCounter } from '../hooks/useAnimatedCounter';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Skeleton, CardSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import api from '../services/api';

import researchService from '../services/researchService';

const HOW_IT_WORKS = [
  { step: 1, label: 'Company Research',   icon: Globe,   color: 'blue'    },
  { step: 2, label: 'Financial Analysis', icon: BarChart2, color: 'indigo' },
  { step: 3, label: 'News Analysis',      icon: Newspaper, color: 'violet' },
  { step: 4, label: 'Risk Assessment',    icon: Shield,   color: 'purple'  },
  { step: 5, label: 'SWOT Analysis',      icon: Target,   color: 'pink'    },
  { step: 6, label: 'AI Recommendation',  icon: Brain,    color: 'rose'    },
];

const SUGGESTION_DB = [
  'Apple Inc', 'Apple Hospitality REIT', 'Amazon', 'Alphabet', 'AMD',
  'Tesla', 'TCS', 'Tata Motors', 'Twitter', 'Target',
  'Microsoft', 'Meta', 'Maruti Suzuki', 'Mahindra & Mahindra',
  'NVIDIA', 'Netflix', 'NTPC',
  'Infosys', 'ICICI Bank', 'ITC',
  'Samsung', 'Salesforce', 'Sony',
  'Reliance Industries', 'Reliance Steel', 'RIL',
  'Goldman Sachs', 'Google', 'Grab',
  'Berkshire Hathaway', 'Bajaj Finance', 'BPCL',
  'HDFC Bank', 'Hindustan Unilever',
  'Wipro', 'Walmart', 'Walt Disney',
];

// ─────────────────────────────────────────────
// VERDICT BADGE
// ─────────────────────────────────────────────
function VerdictBadge({ verdict }) {
  if (!verdict) return null;
  const map = {
    BUY:  { bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', label: 'BUY'  },
    HOLD: { bg: 'bg-amber-500/15 text-amber-400 border-amber-500/30',       label: 'HOLD' },
    PASS: { bg: 'bg-red-500/15 text-red-400 border-red-500/30',             label: 'PASS' },
  };
  const s = map[verdict?.toUpperCase()] || map.HOLD;
  return (
    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${s.bg}`}>
      {s.label}
    </span>
  );
}

// ─────────────────────────────────────────────
// AI ENGINE STATUS PILL
// ─────────────────────────────────────────────
const NODE_LABELS = {
  company_research:    'Company Research',
  financial_analysis:  'Financial Analysis',
  news_analysis:       'News Analysis',
  risk_analysis:       'Risk Assessment',
  swot_analysis:       'SWOT Analysis',
  scores_calculation:  'Scoring',
  recommendation:      'AI Recommendation',
  report_generator:    'Generating Report',
  completed:           'Completed',
  idle:                'Idle',
};

function AIEngineStatus({ status, lastRunAt }) {
  const isResearching = status && status !== 'idle' && status !== 'completed';
  const nodeLabel = NODE_LABELS[status] || status;

  const lastRunText = lastRunAt
    ? (() => {
        const diff = Math.round((Date.now() - new Date(lastRunAt)) / 60000);
        if (diff < 1) return 'just now';
        if (diff < 60) return `${diff}m ago`;
        return `${Math.round(diff / 60)}h ago`;
      })()
    : null;

  return (
    <motion.div
      className={`flex flex-col items-end px-3 py-2 rounded-xl border text-xs font-semibold backdrop-blur-sm
        ${isResearching
          ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
        }`}
      animate={isResearching ? { opacity: [1, 0.75, 1] } : {}}
      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
    >
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
          isResearching ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
        }`} />
        <span className="font-bold">AI Engine</span>
        <span className="opacity-50">·</span>
        <span>{isResearching ? nodeLabel : 'Ready'}</span>
      </div>
      {!isResearching && lastRunText && (
        <span className="text-[10px] text-slate-500 font-medium mt-0.5">
          Last run {lastRunText}
        </span>
      )}
      {isResearching && (
        <span className="text-[10px] text-amber-400/70 font-medium mt-0.5 animate-pulse">
          {nodeLabel}…
        </span>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────
// ANIMATED STAT CARD
// ─────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, delta, color, delay = 0 }) {
  const animValue = useAnimatedCounter(value, 1400, delay);
  const colorMap = {
    blue:   { bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   icon: 'text-blue-400',   glow: 'shadow-blue-500/10'   },
    purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/20', icon: 'text-purple-400', glow: 'shadow-purple-500/10' },
    emerald:{ bg: 'bg-emerald-500/10',border: 'border-emerald-500/20',icon: 'text-emerald-400',glow: 'shadow-emerald-500/10'},
    rose:   { bg: 'bg-rose-500/10',   border: 'border-rose-500/20',   icon: 'text-rose-400',   glow: 'shadow-rose-500/10'   },
    amber:  { bg: 'bg-amber-500/10',  border: 'border-amber-500/20',  icon: 'text-amber-400',  glow: 'shadow-amber-500/10'  },
  };
  const c = colorMap[color] || colorMap.blue;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay / 1000, duration: 0.5 }}
      className={`glass-card rounded-xl p-5 border ${c.border} shadow-xl ${c.glow} flex items-center gap-4`}
    >
      <div className={`w-11 h-11 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-5 h-5 ${c.icon}`} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-black text-white tabular-nums">{animValue}</p>
        <p className="text-xs text-slate-400 font-medium mt-0.5">{label}</p>
        {delta !== undefined && delta > 0 && (
          <p className="text-[10px] text-emerald-400 font-semibold mt-1 flex items-center gap-0.5">
            ↑ +{delta} this week
          </p>
        )}
        {delta !== undefined && delta === 0 && (
          <p className="text-[10px] text-slate-600 font-medium mt-1">no change this week</p>
        )}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
// SEARCH WITH SUGGESTIONS
// ─────────────────────────────────────────────
function HeroSearch({ onAnalyze }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const wrapRef = useRef(null);

  // Filter from local DB + debounce
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const q = query.toLowerCase();
    const matches = SUGGESTION_DB.filter(s => s.toLowerCase().includes(q)).slice(0, 7);
    setSuggestions(matches);
    setShowSuggestions(matches.length > 0);
  }, [query]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleAnalyze = () => {
    if (!query.trim()) return;
    setShowSuggestions(false);
    onAnalyze(query.trim());
  };

  const handleSelect = (suggestion) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    setTimeout(() => onAnalyze(suggestion), 100);
  };

  return (
    <div ref={wrapRef} className="relative w-full max-w-xl">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            placeholder="Search company or ticker… e.g. Apple, NVDA"
            className="glass-input w-full pl-10 pr-4 py-3 text-sm"
            autoComplete="off"
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setSuggestions([]); setShowSuggestions(false); inputRef.current?.focus(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button
          onClick={handleAnalyze}
          disabled={!query.trim() || loading}
          className="px-5 py-3 text-sm font-bold text-white rounded-lg border border-blue-500/30
            bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400
            shadow-lg shadow-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed
            transition-all duration-200 active:scale-[0.97] flex items-center gap-2 whitespace-nowrap"
        >
          <Zap className="w-4 h-4" />
          Analyze
        </button>
      </div>

      {/* Suggestions Dropdown */}
      <AnimatePresence>
        {showSuggestions && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-2 z-50 bg-[#0a0f1e]/95 border border-white/10
              rounded-xl shadow-2xl backdrop-blur-xl overflow-hidden"
          >
            {suggestions.map((s, i) => (
              <motion.button
                key={s}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => handleSelect(s)}
                className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300
                  hover:text-white hover:bg-blue-600/10 transition-colors border-b border-white/4 last:border-0"
              >
                <Search className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                <span dangerouslySetInnerHTML={{
                  __html: s.replace(
                    new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
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

function MarketSummaryCard({ data, loading, error, onRefresh }) {
  const lastUpdated = data && data.length > 0 ? data[0].last_updated : '';
  const isOpen = data && data.length > 0 ? data.some(idx => idx.is_open) : false;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-400" /> Market Summary
          </CardTitle>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-1 hover:bg-white/5 rounded text-slate-500 hover:text-white transition-colors"
              title="Refresh Market Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
              isOpen 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}>
              {isOpen ? 'Market Open' : 'Market Closed'}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="py-8 text-center text-xs text-red-400 flex flex-col items-center justify-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span>{error}</span>
          </div>
        ) : loading && (!data || data.length === 0) ? (
          <div className="flex flex-col gap-3 py-2">
            {[1, 2, 3, 4, 5].map((idx) => (
              <div key={idx} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-4 bg-slate-850 rounded animate-pulse" />
                  <div className="w-20 h-4 bg-slate-850 rounded animate-pulse" />
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="w-16 h-4 bg-slate-855 rounded animate-pulse" />
                  <div className="w-12 h-3 bg-slate-855 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {data.map((idx, i) => (
              <motion.div
                key={idx.name}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base leading-none">{idx.flag}</span>
                  <span className="text-sm font-semibold text-slate-200">{idx.name}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-white tabular-nums">{idx.value}</p>
                  <p className={`text-xs font-semibold tabular-nums flex items-center justify-end gap-0.5 ${idx.up ? 'text-emerald-400' : 'text-red-400'}`}>
                    {idx.up ? <TrendingUp className="w-3.5 h-3.5 mr-0.5" /> : <TrendingDown className="w-3.5 h-3.5 mr-0.5" />}
                    {idx.change} ({idx.pct_change})
                  </p>
                </div>
              </motion.div>
            ))}
            {lastUpdated && (
              <div className="text-[9px] text-slate-650 text-right mt-2 font-mono">
                Last updated: {lastUpdated}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TrendingStocksCard({ data, loading, error, onRefresh, onAnalyze }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-purple-400" /> Trending Stocks
          </CardTitle>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-1 hover:bg-white/5 rounded text-slate-500 hover:text-white transition-colors"
            title="Refresh Trending Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="py-8 text-center text-xs text-red-400 flex flex-col items-center justify-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span>{error}</span>
          </div>
        ) : loading && (!data || data.length === 0) ? (
          <div className="flex flex-col gap-2.5">
            {[1, 2, 3, 4, 5].map((idx) => (
              <div key={idx} className="flex items-center justify-between py-2.5 px-3 rounded-lg border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-850 animate-pulse" />
                  <div className="flex flex-col gap-1.5">
                    <div className="w-20 h-4 bg-slate-855 rounded animate-pulse" />
                    <div className="w-12 h-2.5 bg-slate-855 rounded animate-pulse" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-12 h-4 bg-slate-850 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {data.map((s, i) => (
              <motion.button
                key={s.ticker}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                onClick={() => onAnalyze(s.ticker)}
                className="w-full flex items-center justify-between py-2.5 px-3 rounded-lg
                  hover:bg-white/5 border border-transparent hover:border-white/8
                  transition-all group text-left"
              >
                <div className="flex items-center gap-3">
                  {s.logo_url ? (
                    <img
                      src={s.logo_url}
                      alt={s.name}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                      className="w-8 h-8 rounded-lg border border-white/10 object-contain p-0.5 bg-white flex-shrink-0"
                    />
                  ) : null}
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600/20 to-blue-600/20
                    border border-white/10 flex items-center justify-center text-[10px] font-black text-white flex-shrink-0"
                    style={{ display: s.logo_url ? 'none' : 'flex' }}
                  >
                    {s.ticker.slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold text-white truncate">{s.name}</p>
                      <span className="text-[9px] bg-slate-800 px-1 py-0.2 rounded text-slate-400 font-bold">{s.ticker}</span>
                    </div>
                    <p className="text-[10px] text-slate-500">{s.sector}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs font-bold text-white tabular-nums">{s.price}</p>
                    <p className={`text-[10px] font-bold tabular-nums ${s.up ? 'text-emerald-400' : 'text-red-400'}`}>
                      {s.pct_change}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${
                      s.recommendation === 'BUY' || s.recommendation === 'Strong BUY'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : s.recommendation === 'HOLD'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}>
                      {s.recommendation}
                    </span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-650 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// QUICK ACTIONS CARD
// ─────────────────────────────────────────────
function QuickActionsCard({ navigate }) {
  const actions = [
    {
      label: 'Analyze Company',
      desc: 'Full AI research report',
      icon: Brain,
      gradient: 'from-blue-600 to-blue-500',
      shadow: 'shadow-blue-500/20',
      border: 'border-blue-500/30',
      path: '/workspace',
    },
    {
      label: 'Compare Companies',
      desc: 'Side-by-side benchmarking',
      icon: Scale,
      gradient: 'from-purple-600 to-violet-500',
      shadow: 'shadow-purple-500/20',
      border: 'border-purple-500/30',
      path: '/compare',
    },
    {
      label: 'AI Chat',
      desc: 'Ask follow-up questions',
      icon: MessageSquare,
      gradient: 'from-emerald-600 to-teal-500',
      shadow: 'shadow-emerald-500/20',
      border: 'border-emerald-500/30',
      path: '/workspace',
    },
    {
      label: 'Reports',
      desc: 'View saved analyses',
      icon: FileText,
      gradient: 'from-amber-600 to-orange-500',
      shadow: 'shadow-amber-500/20',
      border: 'border-amber-500/30',
      path: '/reports',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" /> Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {actions.map((a, i) => (
            <motion.button
              key={a.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.08 }}
              onClick={() => navigate(a.path)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl
                bg-gradient-to-br ${a.gradient} border ${a.border}
                shadow-lg ${a.shadow} hover:scale-[1.03] active:scale-[0.97]
                transition-all duration-200 group text-left`}
            >
              <a.icon className="w-5 h-5 text-white" />
              <div className="text-center">
                <p className="text-xs font-bold text-white">{a.label}</p>
                <p className="text-[10px] text-white/60 mt-0.5">{a.desc}</p>
              </div>
            </motion.button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// RECENT SEARCHES CARD
// ─────────────────────────────────────────────
function RecentSearchesCard({ history, loading, onAnalyze }) {
  if (loading) return <CardSkeleton />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-400" /> Recent Searches
        </CardTitle>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No searches yet"
            description="Analyze a company to see it here."
          />
        ) : (
          <div className="flex flex-col gap-1.5">
            {history.slice(0, 6).map((item, i) => (
              <motion.button
                key={item.id || i}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => onAnalyze(item.company_ticker || item.company_name)}
                className="w-full flex items-center justify-between py-2 px-3 rounded-lg
                  hover:bg-white/5 border border-transparent hover:border-white/8
                  transition-all group text-left"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-md bg-blue-600/10 border border-blue-500/20
                    flex items-center justify-center text-[9px] font-black text-blue-400 flex-shrink-0">
                    {(item.company_ticker || item.company_name || '?').slice(0, 3)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-200 truncate">
                      {item.company_name || item.company_ticker}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {item.search_date ? new Date(item.search_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  {item.recommendation && <VerdictBadge verdict={item.recommendation} />}
                  {item.confidence && (
                    <span className="text-[10px] text-slate-500 font-medium">{item.confidence}%</span>
                  )}
                  <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all" />
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// FAVORITES CARD
// ─────────────────────────────────────────────
function FavoritesCard({ favorites, loading, onAnalyze }) {
  if (loading) return <CardSkeleton />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="w-4 h-4 text-rose-400" /> Favorite Companies
        </CardTitle>
      </CardHeader>
      <CardContent>
        {favorites.length === 0 ? (
          <EmptyState
            icon={Heart}
            title="No favorites yet"
            description="Analyze a company and ❤️ it to add it here."
          />
        ) : (
          <div className="flex flex-col gap-1.5">
            {favorites.slice(0, 5).map((fav, i) => {
              const company = fav.company_details || {};
              return (
                <motion.button
                  key={fav.company || i}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  onClick={() => onAnalyze(company.ticker || company.name)}
                  className="w-full flex items-center justify-between py-2 px-3 rounded-lg
                    hover:bg-white/5 border border-transparent hover:border-rose-500/10
                    transition-all group text-left"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-md bg-rose-600/10 border border-rose-500/20
                      flex items-center justify-center text-[9px] font-black text-rose-400 flex-shrink-0">
                      {(company.ticker || '?').slice(0, 3)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-200 truncate">{company.name || company.ticker}</p>
                      <p className="text-[10px] text-slate-500 truncate">{company.sector || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                    <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all" />
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// LATEST AI REPORTS CARD
// ─────────────────────────────────────────────
function LatestReportsCard({ reports, loading, navigate }) {
  if (loading) return <CardSkeleton />;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-400" /> Latest AI Reports
          </CardTitle>
          <button
            onClick={() => navigate('/reports')}
            className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 transition-colors"
          >
            View all <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {reports.length === 0 ? (
          <EmptyState icon={FileText} title="No reports yet" description="Run an AI analysis to generate your first report." />
        ) : (
          <div className="flex flex-col gap-2">
            {reports.slice(0, 4).map((rep, i) => (
              <motion.div
                key={rep.id || i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-white/3
                  border border-white/5 hover:border-emerald-500/20 hover:bg-white/5 transition-all group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600/10 border border-emerald-500/20
                    flex items-center justify-center text-[10px] font-black text-emerald-400 flex-shrink-0">
                    {(rep.company_ticker || '?').slice(0, 3)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-200 truncate">{rep.company_name || rep.company_ticker}</p>
                    <p className="text-[10px] text-slate-500">
                      {rep.created_at ? new Date(rep.created_at).toLocaleDateString() : '—'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {rep.key_highlights?.verdict && <VerdictBadge verdict={rep.key_highlights.verdict} />}
                  <button
                    onClick={() => navigate('/reports')}
                    className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    Open <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// RECENTLY COMPARED CARD
// ─────────────────────────────────────────────
function RecentlyComparedCard({ comparisons, loading, navigate }) {
  if (loading) return <CardSkeleton />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-purple-400" /> Recently Compared
        </CardTitle>
      </CardHeader>
      <CardContent>
        {comparisons.length === 0 ? (
          <EmptyState
            icon={Scale}
            title="No comparisons yet"
            description="Use the comparator to benchmark two or more companies."
            actionText="Compare Now"
            onAction={() => navigate('/compare')}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {comparisons.slice(0, 4).map((cmp, i) => {
              const companies = cmp.company_details || [];
              return (
                <motion.button
                  key={cmp.id || i}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07 }}
                  onClick={() => navigate('/compare')}
                  className="w-full flex items-center justify-between py-2.5 px-3 rounded-lg
                    hover:bg-white/5 border border-transparent hover:border-purple-500/20
                    transition-all group text-left"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    {companies.slice(0, 3).map((c, ci) => (
                      <React.Fragment key={c.ticker || ci}>
                        <span className="text-xs font-bold text-white bg-purple-600/15 border border-purple-500/20 px-2 py-0.5 rounded">
                          {c.ticker || c.name}
                        </span>
                        {ci < companies.length - 1 && ci < 2 && (
                          <span className="text-[10px] text-slate-500 font-bold">VS</span>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                  <span className="text-[10px] text-purple-400 font-semibold flex items-center gap-1
                    opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap ml-2">
                    Open again <ArrowRight className="w-3 h-3" />
                  </span>
                </motion.button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// LATEST NEWS CARD
// ─────────────────────────────────────────────
function LatestNewsCard({ data, loading, error, onRefresh }) {
  const getRelativeTime = (dateStr) => {
    try {
      const pubDate = new Date(dateStr);
      const now = new Date();
      const diffMs = now - pubDate;
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours < 1) {
        const diffMins = Math.floor(diffMs / (1000 * 60));
        return `${diffMins}m ago`;
      }
      if (diffHours < 24) {
        return `${diffHours}h ago`;
      }
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Newspaper className="w-4 h-4 text-sky-400" /> Latest Financial News
          </CardTitle>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-1 hover:bg-white/5 rounded text-slate-500 hover:text-white transition-colors"
            title="Refresh News Feed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="py-8 text-center text-xs text-red-400 flex flex-col items-center justify-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span>{error}</span>
          </div>
        ) : loading && (!data || data.length === 0) ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4].map((idx) => (
              <div key={idx} className="flex gap-4 py-3 border-b border-white/5 last:border-0">
                <div className="w-16 h-12 bg-slate-850 rounded animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-855 rounded w-full animate-pulse" />
                  <div className="h-3 bg-slate-855 rounded w-1/3 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-0">
            {data.map((n, i) => (
              <motion.a
                key={i}
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="flex items-start gap-4 py-3.5 border-b border-white/5 last:border-0
                  hover:bg-white/3 rounded-lg px-3 -mx-3 transition-all group"
              >
                {n.thumbnail ? (
                  <img
                    src={n.thumbnail}
                    alt=""
                    onError={(e) => { e.target.style.display = 'none'; }}
                    className="w-16 h-12 rounded object-cover border border-white/5 bg-slate-900 flex-shrink-0"
                  />
                ) : (
                  <div className="w-16 h-12 rounded bg-slate-900/50 border border-white/5 flex items-center justify-center text-slate-650 flex-shrink-0">
                    <Newspaper className="w-4 h-4" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[8px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1 py-0.2 rounded font-bold uppercase tracking-wider">
                      {n.category}
                    </span>
                  </div>
                  <p className="text-sm text-slate-200 font-semibold leading-snug group-hover:text-white transition-colors line-clamp-2">
                    {n.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] text-sky-400 font-bold">{n.publisher}</span>
                    <span className="text-[10px] text-slate-650">·</span>
                    <span className="text-[10px] text-slate-500">{getRelativeTime(n.published_at)}</span>
                  </div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-slate-600 group-hover:text-sky-400 flex-shrink-0 mt-0.5 transition-colors" />
              </motion.a>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// HOW IT WORKS STRIP
// ─────────────────────────────────────────────
function HowItWorksStrip() {
  const colorClassMap = {
    blue:   { dot: 'bg-blue-500',   text: 'text-blue-400',   border: 'border-blue-500/20',   icon: 'text-blue-400',   bg: 'bg-blue-500/10'   },
    indigo: { dot: 'bg-indigo-500', text: 'text-indigo-400', border: 'border-indigo-500/20', icon: 'text-indigo-400', bg: 'bg-indigo-500/10' },
    violet: { dot: 'bg-violet-500', text: 'text-violet-400', border: 'border-violet-500/20', icon: 'text-violet-400', bg: 'bg-violet-500/10' },
    purple: { dot: 'bg-purple-500', text: 'text-purple-400', border: 'border-purple-500/20', icon: 'text-purple-400', bg: 'bg-purple-500/10' },
    pink:   { dot: 'bg-pink-500',   text: 'text-pink-400',   border: 'border-pink-500/20',   icon: 'text-pink-400',   bg: 'bg-pink-500/10'   },
    rose:   { dot: 'bg-rose-500',   text: 'text-rose-400',   border: 'border-rose-500/20',   icon: 'text-rose-400',   bg: 'bg-rose-500/10'   },
  };

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" /> How InvestIQ Makes Decisions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
          {HOW_IT_WORKS.map((step, i) => {
            const c = colorClassMap[step.color];
            return (
              <React.Fragment key={step.step}>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border ${c.border} ${c.bg} flex-shrink-0`}
                >
                  <step.icon className={`w-4 h-4 ${c.icon}`} />
                  <div>
                    <p className={`text-[10px] font-black uppercase tracking-wider ${c.text}`}>Step {step.step}</p>
                    <p className="text-xs font-semibold text-white leading-none mt-0.5">{step.label}</p>
                  </div>
                  <span className="ml-1 text-emerald-400 text-sm">✅</span>
                </motion.div>
                {i < HOW_IT_WORKS.length - 1 && (
                  <ArrowRight className="w-3.5 h-3.5 text-slate-600 flex-shrink-0 hidden sm:block" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// MAIN DASHBOARD PAGE
// ─────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuth();
  const { success, info } = useToast();
  const navigate = useNavigate();

  const {
    history, favorites, comparisons, reports,
    agentStatus, lastRunAt, loading, error, stats, refetch
  } = useDashboard();

  const [marketData, setMarketData] = useState([]);
  const [marketLoading, setMarketLoading] = useState(true);
  const [marketError, setMarketError] = useState('');
  
  const [trendingData, setTrendingData] = useState([]);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [trendingError, setTrendingError] = useState('');
  
  const [newsData, setNewsData] = useState([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsError, setNewsError] = useState('');

  const fetchMarketData = useCallback(async () => {
    setMarketLoading(true);
    setMarketError('');
    try {
      const data = await researchService.getMarketSummary();
      setMarketData(data);
    } catch (err) {
      setMarketError(err?.response?.data?.detail || 'Unable to fetch latest market data');
    } finally {
      setMarketLoading(false);
    }
  }, []);

  const fetchTrendingData = useCallback(async () => {
    setTrendingLoading(true);
    setTrendingError('');
    try {
      const data = await researchService.getTrending();
      setTrendingData(data);
    } catch (err) {
      setTrendingError('Unable to fetch trending stocks data');
    } finally {
      setTrendingLoading(false);
    }
  }, []);

  const fetchNewsData = useCallback(async () => {
    setNewsLoading(true);
    setNewsError('');
    try {
      const data = await researchService.getDashboardNews();
      setNewsData(data);
    } catch (err) {
      setNewsError('Unable to fetch latest financial news');
    } finally {
      setNewsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMarketData();
    fetchTrendingData();
    fetchNewsData();

    const interval = setInterval(() => {
      fetchMarketData();
      fetchTrendingData();
      fetchNewsData();
    }, 60000);

    return () => clearInterval(interval);
  }, [fetchMarketData, fetchTrendingData, fetchNewsData]);

  const username = user?.username || 'User';
  const firstName = username.charAt(0).toUpperCase() + username.slice(1);

  // Navigate to workspace with pre-filled query
  const handleAnalyze = useCallback((query) => {
    navigate(`/workspace?q=${encodeURIComponent(query)}`);
  }, [navigate]);

  // Greet
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' :
    hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="min-h-full space-y-8 pb-8">

      {/* ── HERO SECTION ─────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-20 left-1/4 w-80 h-80 bg-blue-600/8 blur-[120px] rounded-full" />
          <div className="absolute top-10 right-1/4 w-60 h-60 bg-purple-600/6 blur-[100px] rounded-full" />
        </div>

        <div className="relative">
          {/* Greeting + Status row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <motion.p
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-slate-400 font-medium mb-1"
              >
                {greeting}, <span className="text-white font-semibold">{firstName}</span> 👋
              </motion.p>
              <motion.h1
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight"
              >
                AI Investment
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">
                  {' '}Research Platform
                </span>
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.12 }}
                className="text-sm text-slate-400 mt-2 max-w-lg leading-relaxed"
              >
                Analyze stocks using AI-powered research, financial analysis, news intelligence,
                and explainable investment reasoning.
              </motion.p>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              <AIEngineStatus status={agentStatus} lastRunAt={lastRunAt} />
              <button
                onClick={refetch}
                className="p-2 hover:bg-white/5 rounded-lg text-slate-500 hover:text-white transition-all border border-transparent hover:border-white/10"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Hero Search */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="flex flex-col sm:flex-row items-start sm:items-center gap-4"
          >
            <HeroSearch onAnalyze={handleAnalyze} />
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/compare')}
                className="flex items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-300
                  bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-lg
                  transition-all active:scale-[0.97]"
              >
                <Scale className="w-4 h-4 text-purple-400" /> Compare
              </button>
              <button
                onClick={() => navigate('/reports')}
                className="flex items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-300
                  bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-lg
                  transition-all active:scale-[0.97]"
              >
                <BookOpen className="w-4 h-4 text-emerald-400" /> Reports
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── ERROR BANNER ─────────────────────────── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-sm text-amber-300"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error} — showing default data where available.
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── STATS ROW ────────────────────────────── */}
      <section>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={FileText}    label="Reports Generated"  value={stats.reportsGenerated}  delta={stats.reportsThisWeek}  color="blue"    delay={0}   />
          <StatCard icon={Heart}       label="Favorite Companies" value={stats.favoriteCompanies} delta={stats.favsThisWeek}     color="rose"    delay={100} />
          <StatCard icon={GitCompare}  label="Recent Comparisons" value={stats.recentComparisons} delta={stats.compsThisWeek}    color="purple"  delay={200} />
          <StatCard icon={Activity}    label="AI Conversations"   value={stats.aiConversations}   delta={stats.chatsThisWeek}    color="emerald" delay={300} />
        </div>
      </section>

      {/* ── MAIN GRID ────────────────────────────── */}
      <section>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

          {/* Row 1 */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <MarketSummaryCard data={marketData} loading={marketLoading} error={marketError} onRefresh={fetchMarketData} />
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <TrendingStocksCard data={trendingData} loading={trendingLoading} error={trendingError} onRefresh={fetchTrendingData} onAnalyze={handleAnalyze} />
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <QuickActionsCard navigate={navigate} />
          </motion.div>

          {/* Row 2 */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <RecentSearchesCard history={history} loading={loading} onAnalyze={handleAnalyze} />
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <FavoritesCard favorites={favorites} loading={loading} onAnalyze={handleAnalyze} />
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <RecentlyComparedCard comparisons={comparisons} loading={loading} navigate={navigate} />
          </motion.div>

          {/* Row 3 — 2/3 + 1/3 split */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="md:col-span-2 xl:col-span-2"
          >
            <LatestNewsCard data={newsData} loading={newsLoading} error={newsError} onRefresh={fetchNewsData} />
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
            <LatestReportsCard reports={reports} loading={loading} navigate={navigate} />
          </motion.div>

          {/* Full-width How It Works */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
            className="md:col-span-2 xl:col-span-3"
          >
            <HowItWorksStrip />
          </motion.div>

        </div>
      </section>

    </div>
  );
}
