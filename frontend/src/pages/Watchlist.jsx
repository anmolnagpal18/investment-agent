import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Heart, HeartOff, Search, ArrowRight, Loader2, RefreshCw, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import researchService from '../services/researchService';
import { CardSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';

// Mock current prices (labeled clearly as simulated)
const MOCK_PRICES = {
  AAPL:219.86, NVDA:134.25, MSFT:469.82, TSLA:246.40, AMZN:209.10,
  GOOGL:195.41, META:578.22, NFLX:705.43, INFY:21.34, TCS:3802,
  RELIANCE:1412, HDFCBANK:1898, WIPRO:538,
};

function PriceTag({ ticker, targetPrice, currencySymbol = '$' }) {
  const current = MOCK_PRICES[ticker?.toUpperCase()] || null;
  if (!current || !targetPrice) return null;
  const up = Number(targetPrice) > current;
  const upside = (((Number(targetPrice) - current) / current) * 100).toFixed(1);
  return (
    <div className="flex items-center gap-3 text-xs mt-2">
      <div className="flex items-center gap-1 text-slate-400">
        <span className="text-slate-500">Current</span>
        <span className="font-bold text-slate-200">{currencySymbol}{current.toLocaleString()}</span>
        <span className="text-slate-500 ml-1 text-[9px] font-medium bg-slate-800/60 px-1.5 py-0.5 rounded border border-white/5">Simulated</span>
      </div>
      <div className={`flex items-center gap-1 font-bold ${up ? 'text-emerald-400' : 'text-red-400'}`}>
        {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {up ? '+' : ''}{upside}% upside
      </div>
    </div>
  );
}

export default function Watchlist() {
  const [favorites, setFavorites]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [removing, setRemoving]     = useState(null);
  const [editTarget, setEditTarget] = useState({}); // {ticker: price}
  const [editing, setEditing]       = useState(null);
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();

  const fetchFavorites = async () => {
    setLoading(true);
    try { setFavorites(await researchService.getFavorites() || []); }
    catch { toastError('Failed to load watchlist'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchFavorites(); }, []);

  const handleRemove = async (ticker) => {
    setRemoving(ticker);
    try {
      await researchService.toggleFavorite(ticker);
      setFavorites(prev => prev.filter(f => f.company_details?.ticker !== ticker));
      success('Removed from watchlist');
    } catch { toastError('Failed to remove'); }
    finally { setRemoving(null); }
  };

  const saveTarget = (ticker) => {
    setEditing(null);
    success(`Target price saved for ${ticker}`);
  };

  return (
    <div className="min-h-full pb-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">
            My <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-pink-400">Watchlist</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">{favorites.length} saved {favorites.length === 1 ? 'company' : 'companies'}</p>
        </div>
        <button onClick={fetchFavorites}
          className="p-2 hover:bg-white/5 rounded-lg text-slate-500 hover:text-white transition-all border border-transparent hover:border-white/10">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{[1,2,3].map(i => <CardSkeleton key={i} />)}</div>
      ) : favorites.length === 0 ? (
        <EmptyState icon={Heart} title="Your watchlist is empty"
          description="Analyze a company and click Save to add it here."
          actionText="Analyze a Company" onAction={() => navigate('/workspace')} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {favorites.map((fav, i) => {
            const c      = fav.company_details || {};
            const ticker = c.ticker || '';
            const target = editTarget[ticker] ?? fav.target_price ?? '';

            return (
              <motion.div key={ticker || i}
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                className="glass-card rounded-2xl p-5 border border-white/8 hover:border-rose-500/20 transition-all group">

                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-600/20 to-pink-600/20
                      border border-rose-500/20 flex items-center justify-center text-xs font-black text-rose-400">
                      {ticker.slice(0, 2) || '?'}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white leading-none">{c.name || ticker}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{c.sector || '—'}</p>
                    </div>
                  </div>
                  <button onClick={() => handleRemove(ticker)} disabled={removing === ticker}
                    className="text-slate-600 hover:text-red-400 transition-colors p-1 flex-shrink-0"
                    aria-label="Remove from watchlist"
                  >
                    {removing === ticker ? <Loader2 className="w-4 h-4 animate-spin" /> : <HeartOff className="w-4 h-4" />}
                  </button>
                </div>

                {/* Ticker badge */}
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs font-black text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">{ticker}</span>
                  {c.industry && <span className="text-[10px] text-slate-500">{c.industry}</span>}
                </div>

                {/* ⭐ Target Price section */}
                <div className="bg-white/3 border border-white/6 rounded-xl p-3 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-xs font-bold text-slate-300">Target Price</span>
                    </div>
                    <button onClick={() => setEditing(editing === ticker ? null : ticker)}
                      className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold transition-colors">
                      {editing === ticker ? 'Cancel' : target ? 'Edit' : '+ Set'}
                    </button>
                  </div>

                  {editing === ticker ? (
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={editTarget[ticker] ?? target}
                        onChange={e => setEditTarget(prev => ({ ...prev, [ticker]: e.target.value }))}
                        placeholder="e.g. 250"
                        className="glass-input flex-1 py-1.5 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-rose-500"
                        autoFocus
                      />
                      <button onClick={() => saveTarget(ticker)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-all">
                        Save
                      </button>
                    </div>
                  ) : target ? (
                    (() => {
                      const currencySymbol = (ticker?.toUpperCase().endsWith('.NS') || c.financial_summary?.currency === 'INR') ? '₹' : '$';
                      return (
                        <div>
                          <span className="text-lg font-black text-emerald-400">{currencySymbol}{Number(target).toLocaleString()}</span>
                          <PriceTag ticker={ticker} targetPrice={target} currencySymbol={currencySymbol} />
                        </div>
                      );
                    })()
                  ) : (
                    <p className="text-xs text-slate-600 italic">No target set</p>
                  )}
                </div>

                {/* Verdict & Risk row */}
                <div className="flex items-center justify-between gap-3 text-xs mb-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 font-medium">Verdict:</span>
                    <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded border leading-none ${
                      (fav.recommendation || 'HOLD') === 'BUY'
                        ? 'text-emerald-450 bg-emerald-500/10 border-emerald-500/20'
                        : (fav.recommendation || 'HOLD') === 'PASS'
                          ? 'text-red-450 bg-red-500/10 border-red-500/20'
                          : 'text-amber-450 bg-amber-500/10 border-amber-500/20'
                    }`}>
                      {fav.recommendation || 'HOLD'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 font-medium">Risk:</span>
                    <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded border leading-none ${
                      (fav.risk_level || 'Medium') === 'Low'
                        ? 'text-emerald-450 bg-emerald-500/5 border-emerald-500/10'
                        : (fav.risk_level || 'Medium') === 'High'
                          ? 'text-rose-450 bg-rose-500/5 border-rose-500/10'
                          : 'text-amber-450 bg-amber-500/5 border-amber-500/10'
                    }`}>
                      {fav.risk_level || 'Medium'}
                    </span>
                  </div>
                </div>

                {/* Notes */}
                {fav.personal_notes && (
                  <p className="text-xs text-slate-400 mb-3 italic line-clamp-2">"{fav.personal_notes}"</p>
                )}

                {/* Last Updated line */}
                <p className="text-[10px] text-slate-550 font-semibold mb-3">
                  Last Updated: {fav.last_updated ? new Date(fav.last_updated).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                </p>

                {/* Re-analyze button */}
                <button onClick={() => navigate(`/workspace?q=${ticker}`)}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold
                    bg-white/4 hover:bg-blue-600/15 border border-white/6 hover:border-blue-500/30
                    text-slate-400 hover:text-blue-400 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50">
                  <Search className="w-3.5 h-3.5" /> Analyze Again
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
