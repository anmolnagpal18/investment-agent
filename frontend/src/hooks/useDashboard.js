import { useState, useEffect, useCallback } from 'react';
import researchService from '../services/researchService';
import api from '../services/api';

// Items created within the last 7 days
function countThisWeek(items, dateField = 'created_at') {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return items.filter(item => {
    const d = item[dateField] ? new Date(item[dateField]) : null;
    return d && d >= oneWeekAgo;
  }).length;
}

export function useDashboard() {
  const [history, setHistory] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [comparisons, setComparisons] = useState([]);
  const [reports, setReports] = useState([]);
  const [agentStatus, setAgentStatus] = useState('idle');
  const [lastRunAt, setLastRunAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [histRes, favRes, compRes, repRes] = await Promise.allSettled([
        researchService.getHistory(),
        researchService.getFavorites(),
        api.get('/research/comparisons/'),
        api.get('/research/reports/'),
      ]);

      if (histRes.status === 'fulfilled') setHistory(histRes.value || []);
      if (favRes.status === 'fulfilled') setFavorites(favRes.value || []);
      if (compRes.status === 'fulfilled') setComparisons(compRes.value?.data || []);
      if (repRes.status === 'fulfilled') setReports(repRes.value?.data || []);

      // Poll agent status from last conversation
      try {
        const convRes = await api.get('/chat/conversations/');
        const conversations = convRes.data?.results || convRes.data || [];
        const latest = conversations[0];
        if (latest) {
          const s = latest.status || 'idle';
          setAgentStatus(s === 'completed' ? 'idle' : s);
          setLastRunAt(latest.updated_at || latest.created_at || null);
        }
      } catch {
        setAgentStatus('idle');
        setLastRunAt(null);
      }
    } catch (err) {
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const hist = history;
  const reps = reports;
  const favs = favorites;
  const comps = comparisons;

  const stats = {
    reportsGenerated:  reps.length,
    favoriteCompanies: favs.length,
    recentComparisons: comps.length,
    aiConversations:   hist.length,
    // Weekly deltas
    reportsThisWeek:   countThisWeek(reps, 'created_at'),
    favsThisWeek:      countThisWeek(favs, 'created_at'),
    compsThisWeek:     countThisWeek(comps, 'compared_at'),
    chatsThisWeek:     countThisWeek(hist, 'search_date'),
  };

  return {
    history,
    favorites,
    comparisons,
    reports,
    agentStatus,
    lastRunAt,
    loading,
    error,
    stats,
    refetch: fetchAll,
  };
}

export default useDashboard;
