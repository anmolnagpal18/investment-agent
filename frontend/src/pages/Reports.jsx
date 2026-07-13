import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { FileText, Download, Search, Clock, RefreshCw, CheckCircle2, AlertTriangle, Minus, Loader2, Filter } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import researchService from '../services/researchService';
import api from '../services/api';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';

function VerdictBadge({ verdict }) {
  if (!verdict) return null;
  const map = {
    BUY:  { cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', icon: CheckCircle2 },
    HOLD: { cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30',       icon: Minus        },
    PASS: { cls: 'bg-red-500/15 text-red-400 border-red-500/30',             icon: AlertTriangle},
  };
  const s = map[(verdict||'').toUpperCase()] || map.HOLD;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${s.cls}`}>
      <s.icon className="w-2.5 h-2.5" /> {verdict.toUpperCase()}
    </span>
  );
}

const FILTERS = ['All', 'BUY', 'HOLD', 'PASS'];

export default function Reports() {
  const [history, setHistory]   = useState([]);
  const [reports, setReports]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [exporting, setExporting] = useState(null);
  const [filter, setFilter]     = useState('All');
  
  // Search, Sort, Pagination States
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'oldest' | 'ticker'
  const [reportPage, setReportPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  const navigate = useNavigate();
  const { success, error: toastError } = useToast();

  const getInitialsBg = (ticker) => {
    if (!ticker) return "from-slate-600/20 to-slate-800/20 border-slate-500/20 text-slate-400";
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const char = ticker.slice(0, 1).toUpperCase();
    const idx = alphabet.indexOf(char) !== -1 ? alphabet.indexOf(char) % 5 : 0;
    const gradients = [
      "from-blue-600/20 to-indigo-600/20 border-blue-500/20 text-blue-400",
      "from-emerald-600/20 to-teal-600/20 border-emerald-500/20 text-emerald-400",
      "from-purple-600/20 to-pink-600/20 border-purple-500/20 text-purple-400",
      "from-amber-600/20 to-orange-600/20 border-amber-500/20 text-amber-400",
      "from-sky-600/20 to-cyan-600/20 border-sky-500/20 text-sky-400"
    ];
    return gradients[idx];
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [histRes, repRes] = await Promise.allSettled([
        researchService.getHistory(),
        api.get('/research/reports/'),
      ]);
      if (histRes.status === 'fulfilled') setHistory(histRes.value || []);
      if (repRes.status  === 'fulfilled') setReports(repRes.value?.data || []);
    } catch { toastError('Failed to load reports'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleExport = async (ticker) => {
    setExporting(ticker);
    try {
      const blob = await researchService.exportPdf(ticker);
      const htmlText = await blob.text();
      
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
          .catch(() => toastError('PDF compilation failed.'))
          .finally(() => setExporting(null));
      };

      if (window.html2pdf) {
        runExport();
      } else {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        script.onload = runExport;
        script.onerror = () => { toastError('Failed to load PDF library.'); setExporting(null); };
        document.body.appendChild(script);
      }
    } catch {
      toastError('Export failed');
      setExporting(null);
    }
  };

  // Search filter matching
  const searchMatch = (item) => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    const ticker = (item.company_ticker || '').toLowerCase();
    const name = (item.company_name || '').toLowerCase();
    return ticker.includes(q) || name.includes(q);
  };

  // Sorting matcher
  const sortItems = (items, dateKey) => {
    return [...items].sort((a, b) => {
      if (sortBy === 'ticker') {
        const tA = (a.company_ticker || '').toLowerCase();
        const tB = (b.company_ticker || '').toLowerCase();
        return tA.localeCompare(tB);
      }
      const dA = new Date(a[dateKey] || 0).getTime();
      const dB = new Date(b[dateKey] || 0).getTime();
      return sortBy === 'newest' ? dB - dA : dA - dB;
    });
  };

  // Process filters and sorting
  const processedReports = sortItems(
    reports.filter(r => {
      const matchFilter = filter === 'All' || (r.key_highlights?.verdict || '').toUpperCase() === filter;
      return matchFilter && searchMatch(r);
    }),
    'created_at'
  );

  const processedHistory = sortItems(
    history.filter(h => {
      const matchFilter = filter === 'All' || (h.recommendation || '').toUpperCase() === filter;
      return matchFilter && searchMatch(h);
    }),
    'search_date'
  );

  // Pagination calculations
  const paginatedReports = processedReports.slice(
    (reportPage - 1) * ITEMS_PER_PAGE,
    reportPage * ITEMS_PER_PAGE
  );

  const paginatedHistory = processedHistory.slice(
    (historyPage - 1) * ITEMS_PER_PAGE,
    historyPage * ITEMS_PER_PAGE
  );

  const totalReportPages = Math.ceil(processedReports.length / ITEMS_PER_PAGE) || 1;
  const totalHistoryPages = Math.ceil(processedHistory.length / ITEMS_PER_PAGE) || 1;

  // Counts per verdict
  const counts = { ALL: reports.length };
  ['BUY','HOLD','PASS'].forEach(v => {
    counts[v] = reports.filter(r => (r.key_highlights?.verdict||'').toUpperCase() === v).length;
  });

  return (
    <div className="min-h-full pb-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-white">
            Research <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">Logs</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">AI-generated investment reports and search history.</p>
        </div>
        <button onClick={fetchData} className="p-2 hover:bg-white/5 rounded-lg text-slate-500 hover:text-white transition-all border border-transparent hover:border-white/10" aria-label="Refresh database logs">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* ⭐ SEARCH, SORT, & FILTER CONTROLS BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/3 border border-white/6 rounded-2xl p-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setReportPage(1); setHistoryPage(1); }}
            placeholder="Search report logs by name or ticker..."
            className="glass-input w-full pl-10 pr-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            aria-label="Search reports by ticker or company name"
          />
        </div>

        {/* Sort Select */}
        <div className="flex items-center gap-3 self-end md:self-auto">
          <label className="text-xs text-slate-400 font-semibold" htmlFor="sort-dropdown">Sort By:</label>
          <select
            id="sort-dropdown"
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="bg-[#0b0f19] border border-white/10 text-xs text-slate-350 px-3 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="ticker">Ticker A-Z</option>
          </select>
        </div>
      </div>

      {/* ⭐ Filter Bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 mr-1">
          <Filter className="w-3.5 h-3.5" /> Filter Verdict:
        </div>
        {FILTERS.map(f => {
          const count = f === 'All' ? counts.ALL : counts[f] || 0;
          const active = filter === f;
          const colorMap = {
            All:  active ? 'bg-white/10 border-white/20 text-white'              : 'border-white/8 text-slate-400 hover:text-white hover:bg-white/5',
            BUY:  active ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'border-white/8 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/20',
            HOLD: active ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'   : 'border-white/8 text-slate-400 hover:text-amber-400 hover:border-amber-500/20',
            PASS: active ? 'bg-red-500/20 border-red-500/40 text-red-300'         : 'border-white/8 text-slate-400 hover:text-red-400 hover:border-red-500/20',
          };
          return (
            <button key={f} onClick={() => { setFilter(f); setReportPage(1); setHistoryPage(1); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${colorMap[f]}`}
              aria-label={`Filter by ${f} verdict`}
            >
              {f}
              <span className="opacity-60 font-medium">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Saved Reports */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400" /> Saved Reports
            </CardTitle>
            <span className="text-xs text-slate-500">{processedReports.length} result{processedReports.length !== 1 ? 's' : ''}</span>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-14 animate-pulse bg-slate-800/60 rounded-xl" />)}</div>
          ) : paginatedReports.length === 0 ? (
            <EmptyState icon={FileText} title={filter === 'All' ? 'No reports found' : `No matching ${filter} reports`}
              description={filter === 'All' ? 'Try adjusting your search criteria or analyze a company first.' : `Try adjusting your search parameters.`}
              actionText={filter === 'All' ? "Analyze a Company" : null} onAction={() => navigate('/workspace')} />
          ) : (
            <div className="space-y-2.5">
              <AnimatePresence mode="popLayout">
                {paginatedReports.map((rep, i) => {
                  const gradientClass = getInitialsBg(rep.company_ticker);
                  return (
                    <motion.div key={rep.id || i}
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="flex items-center gap-4 p-3.5 rounded-xl bg-white/3 border border-white/5
                        hover:border-emerald-500/20 hover:bg-white/5 transition-all group"
                    >
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br border flex items-center justify-center text-[11px] font-black flex-shrink-0 ${gradientClass}`}>
                        {(rep.company_ticker||'?').slice(0,3)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{rep.company_name || rep.company_ticker}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{rep.created_at ? new Date(rep.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : '—'}</p>
                      </div>
                      {rep.key_highlights?.verdict && <VerdictBadge verdict={rep.key_highlights.verdict} />}
                      {rep.key_highlights?.overall_score && (
                        <span className="text-xs font-bold text-slate-400 tabular-nums">{rep.key_highlights.overall_score}/100</span>
                      )}
                      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => navigate(`/workspace?q=${rep.company_ticker}`)}
                          className="p-1.5 text-slate-500 hover:text-blue-400 transition-colors"
                          aria-label={`View analysis workspace for ${rep.company_ticker}`}
                        >
                          <Search className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleExport(rep.company_ticker)} disabled={exporting === rep.company_ticker}
                          className="p-1.5 text-slate-500 hover:text-emerald-400 transition-colors"
                          aria-label={`Export ${rep.company_ticker} report as PDF`}
                        >
                          {exporting === rep.company_ticker ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {/* Reports Pagination */}
              {totalReportPages > 1 && (
                <div className="flex items-center justify-center gap-3 pt-4 mt-2 border-t border-white/5 text-xs">
                  <button
                    onClick={() => setReportPage(p => Math.max(p - 1, 1))}
                    disabled={reportPage === 1}
                    className="px-3 py-1.5 bg-white/4 border border-white/8 hover:bg-white/8 rounded-lg disabled:opacity-40 disabled:hover:bg-white/4 font-semibold text-slate-300 hover:text-white"
                  >
                    Previous
                  </button>
                  <span className="text-slate-500 font-bold">Page {reportPage} of {totalReportPages}</span>
                  <button
                    onClick={() => setReportPage(p => Math.min(p + 1, totalReportPages))}
                    disabled={reportPage === totalReportPages}
                    className="px-3 py-1.5 bg-white/4 border border-white/8 hover:bg-white/8 rounded-lg disabled:opacity-40 disabled:hover:bg-white/4 font-semibold text-slate-300 hover:text-white"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" /> Search History
            </CardTitle>
            <span className="text-xs text-slate-500">{processedHistory.length} result{processedHistory.length !== 1 ? 's' : ''}</span>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-12 animate-pulse bg-slate-800/60 rounded-xl" />)}</div>
          ) : paginatedHistory.length === 0 ? (
            <EmptyState icon={Clock} title="No search history found" description="Adjust your filters or query text above." />
          ) : (
            <div className="space-y-1.5">
              <AnimatePresence mode="popLayout">
                {paginatedHistory.map((item, i) => {
                  const gradientClass = getInitialsBg(item.company_ticker);
                  return (
                    <motion.div key={item.id || i}
                      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/4 border border-transparent
                        hover:border-white/8 transition-all group cursor-pointer"
                      onClick={() => navigate(`/workspace?q=${item.company_ticker}`)}
                    >
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br border flex items-center justify-center text-[9px] font-black flex-shrink-0 ${gradientClass}`}>
                        {(item.company_ticker||'?').slice(0,3)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-200 truncate">{item.company_name || item.company_ticker}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{item.search_date ? new Date(item.search_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {item.recommendation && <VerdictBadge verdict={item.recommendation} />}
                        {item.confidence && <span className="text-[11px] text-slate-400 font-semibold">{item.confidence}%</span>}
                      </div>
                      <svg className="w-3.5 h-3.5 text-slate-600 group-hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all"
                        xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
                      </svg>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {/* History Pagination */}
              {totalHistoryPages > 1 && (
                <div className="flex items-center justify-center gap-3 pt-4 mt-2 border-t border-white/5 text-xs">
                  <button
                    onClick={() => setHistoryPage(p => Math.max(p - 1, 1))}
                    disabled={historyPage === 1}
                    className="px-3 py-1.5 bg-white/4 border border-white/8 hover:bg-white/8 rounded-lg disabled:opacity-40 disabled:hover:bg-white/4 font-semibold text-slate-300 hover:text-white"
                  >
                    Previous
                  </button>
                  <span className="text-slate-500 font-bold">Page {historyPage} of {totalHistoryPages}</span>
                  <button
                    onClick={() => setHistoryPage(p => Math.min(p + 1, totalHistoryPages))}
                    disabled={historyPage === totalHistoryPages}
                    className="px-3 py-1.5 bg-white/4 border border-white/8 hover:bg-white/8 rounded-lg disabled:opacity-40 disabled:hover:bg-white/4 font-semibold text-slate-300 hover:text-white"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
