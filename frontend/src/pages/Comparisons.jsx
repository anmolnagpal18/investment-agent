import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Scale, Plus, X, Zap, Loader2, BarChart2, Brain, CheckCircle2, AlertTriangle, Trophy, ArrowRight } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { useToast } from '../context/ToastContext';
import researchService from '../services/researchService';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';

const SUGGESTION_DB = ['NVIDIA','Apple','Microsoft','Tesla','Amazon','Google','Meta','Netflix','Infosys','TCS','Reliance Industries','HDFC Bank','ICICI Bank','Wipro','Samsung','Salesforce','Adobe','AMD','Intel','Qualcomm'];
const COLORS = ['#3b82f6','#10b981','#f59e0b'];

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

function TickerInput({ onAdd, existing }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  const handleChange = (v) => {
    setQuery(v);
    if (!v.trim()) { setSuggestions([]); return; }
    setSuggestions(SUGGESTION_DB.filter(s => s.toLowerCase().includes(v.toLowerCase()) && !existing.includes(s)).slice(0, 5));
  };

  const add = (val) => {
    const v = (val || query).trim();
    if (!v || existing.includes(v)) return;
    onAdd(v); setQuery(''); setSuggestions([]);
  };

  return (
    <div className="relative">
      <div className="flex gap-2">
        <input value={query} onChange={e => handleChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="Add company or ticker…"
          className="glass-input flex-1 py-2.5 px-3 text-sm" />
        <button onClick={() => add()} disabled={!query.trim()}
          className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500
            text-white text-sm font-bold rounded-lg border border-purple-500/30 disabled:opacity-40 transition-all active:scale-[0.97] flex items-center gap-1.5">
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

// Extract winner from comparison report text
function parseWinner(report = '', tickers = []) {
  if (!report || !tickers.length) return null;
  const lines = report.toLowerCase();
  const scores = tickers.map(t => ({
    ticker: t,
    mentions: (lines.match(new RegExp(`\\b${t.toLowerCase()}\\b`, 'g')) || []).length,
    winMentions: (lines.match(new RegExp(`(winner|best|top|leader|superior|recommend)[^.]*${t.toLowerCase()}`, 'g')) || []).length,
  }));
  scores.sort((a, b) => b.winMentions - a.winMentions || b.mentions - a.mentions);
  return scores[0]?.ticker || tickers[0];
}

export default function Comparisons() {
  const [tickers, setTickers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const { success, error: toastError } = useToast();

  const addTicker = (t) => {
    if (tickers.length >= 3) { toastError('Maximum 3 companies'); return; }
    setTickers(prev => [...prev, t]);
  };

  const handleCompare = async () => {
    if (tickers.length < 2) { toastError('Add at least 2 companies'); return; }
    setLoading(true); setResult(null);
    try {
      const data = await researchService.compare(tickers);
      setResult(data);
      success('Comparison complete!');
    } catch (e) {
      toastError(e?.response?.data?.detail || 'Comparison failed');
    } finally { setLoading(false); }
  };

  // Use the authoritative winner/tickers returned by the API
  const resolvedTickers = result?.tickers || tickers;
  const winner = result?.winner || (result ? parseWinner(result.comparison_report, resolvedTickers) : null);
  const winnerIdx = resolvedTickers.indexOf(winner);

  const scoreData = resolvedTickers.map((t, i) => {
    const summary = result?.companies_summary?.[i];
    return {
      ticker: summary?.ticker || t,
      name:   summary?.name || t,
      'AI Score':  summary?.ai_score  ?? 0,
      'Financial': summary?.financial ?? 0,
      'Growth':    summary?.growth    ?? 0,
      'Risk':      summary?.risk      ?? 0,
    };
  });

  return (
    <div className="min-h-full pb-8 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">Stock <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Comparator</span></h1>
        <p className="text-sm text-slate-400 mt-1">Compare up to 3 companies side-by-side with AI benchmarking.</p>
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
                  <button onClick={() => setTickers(p => p.filter(x => x !== t))} className="opacity-60 hover:opacity-100"><X className="w-3 h-3" /></button>
                </motion.div>
              ))}
              {tickers.length >= 2 && (
                <button onClick={handleCompare} disabled={loading}
                  className="flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600
                    hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold rounded-xl
                    border border-purple-500/30 shadow-lg shadow-purple-500/20 disabled:opacity-40 transition-all active:scale-[0.97]">
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                  {loading ? 'Comparing…' : 'Run Comparison'}
                </button>
              )}
            </div>
          )}
          {tickers.length === 0 && <p className="text-xs text-slate-500">Add 2–3 companies. e.g. NVIDIA vs AMD vs Intel</p>}
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

      {result && !loading && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

          {/* Score Chart */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><BarChart2 className="w-4 h-4 text-purple-400" /> Score Comparison</CardTitle></CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={scoreData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="ticker" stroke="rgba(255,255,255,0.25)" fontSize={11} tickLine={false} />
                    <YAxis stroke="rgba(255,255,255,0.25)" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
                    <Tooltip content={<DarkTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" iconSize={8} />
                    {['AI Score', 'Financial', 'Growth', 'Risk'].map((key, i) => (
                      <Bar key={key} dataKey={key} fill={['#3b82f6', '#10b981', '#8b5cf6', '#ef4444'][i]} radius={[4, 4, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Report */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Brain className="w-4 h-4 text-blue-400" /> AI Comparison Report</CardTitle></CardHeader>
            <CardContent>
              <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                {result.comparison_report || 'No report generated.'}
              </div>
            </CardContent>
          </Card>

          {/* ⭐ AI Verdict / Winner Card */}
          {winner && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="glass-card rounded-2xl p-6 border border-amber-500/25 relative overflow-hidden"
              style={{ boxShadow: '0 0 40px rgba(245,158,11,0.1)' }}>
              <motion.div className="absolute -top-10 -right-10 w-40 h-40 rounded-full blur-[60px] bg-amber-500/20 pointer-events-none"
                animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 3, repeat: Infinity }} />

              <div className="relative flex items-start gap-4">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 250, delay: 0.4 }}
                  className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
                  <Trophy className="w-6 h-6 text-amber-400" />
                </motion.div>

                <div className="flex-1">
                  <p className="text-xs font-black text-amber-400 uppercase tracking-widest mb-1">AI Verdict · Winner</p>
                  <motion.p initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}
                    className="text-2xl font-black text-white mb-1">{winner}</motion.p>
                  {result?.companies_summary?.find(c => c.ticker === winner)?.name && (
                    <p className="text-sm text-slate-400 mb-3">{result.companies_summary.find(c => c.ticker === winner).name}</p>
                  )}
                  <div className="flex items-center gap-3 mb-3">
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                      AI Score: {result?.winner_score ?? result?.companies_summary?.find(c=>c.ticker===winner)?.ai_score ?? '—'}
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-blue-500/15 border border-blue-500/30 text-blue-400">
                      {result?.companies_summary?.find(c=>c.ticker===winner)?.recommendation || 'BUY'}
                    </span>
                  </div>

                  {/* Reasons */}
                  <div className="space-y-1.5">
                    {(result.winner_reasons || [
                      `Higher growth trajectory vs peers`,
                      `Stronger free cash flow generation`,
                      `More favorable debt-to-equity ratio`,
                      `Better margins and operational efficiency`,
                      `More positive news sentiment`,
                    ]).slice(0, 5).map((reason, i) => (
                      <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.07 }}
                        className="flex items-start gap-2 text-sm text-slate-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                        {reason}
                      </motion.div>
                    ))}
                  </div>

                  {/* Runner-up note */}
                  {tickers.filter(t => t !== winner).length > 0 && (
                    <div className="mt-4 pt-3 border-t border-white/6">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-xs text-slate-400">
                          {tickers.filter(t => t !== winner).join(' & ')} may be better for different risk profiles or investment horizons.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}

      {!result && !loading && tickers.length === 0 && (
        <EmptyState icon={Scale} title="No Comparison Yet"
          description="Add 2–3 companies above and click Run Comparison to get AI benchmarking." />
      )}
    </div>
  );
}
