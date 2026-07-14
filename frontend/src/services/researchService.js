import api from './api';

export const researchService = {
  analyze: async (ticker) => {
    const response = await api.post('/analyze/', { ticker });
    return response.data;
  },

  chat: async (ticker, content, conversationId = null) => {
    const response = await api.post('/chat/', {
      ticker,
      content,
      conversation_id: conversationId
    });
    return response.data;
  },

  explain: async (ticker, category, score) => {
    const response = await api.post('/explain/', { ticker, category, score });
    return response.data;
  },

  compare: async (tickers) => {
    const response = await api.post('/compare/', { tickers });
    return response.data;
  },

  compareChat: async (tickers, content, conversationId = null) => {
    const response = await api.post('/compare/chat/', {
      tickers,
      content,
      conversation_id: conversationId
    });
    return response.data;
  },

  compareExportPdf: async (tickers) => {
    const response = await api.post('/compare/export/pdf/', { tickers }, {
      responseType: 'blob'
    });
    return response.data;
  },

  getHistory: async () => {
    const response = await api.get('/history/');
    return response.data;
  },

  getFavorites: async () => {
    const response = await api.get('/favorites/');
    return response.data;
  },

  toggleFavorite: async (ticker) => {
    const response = await api.post('/favorites/', { ticker });
    return response.data;
  },

  exportPdf: async (ticker) => {
    const response = await api.post('/export/pdf/', { ticker }, {
      responseType: 'blob' // Essential for binary/document file downloads
    });
    return response.data;
  },

  checkReportStatus: async (reportId) => {
    const response = await api.get(`/report-status/${reportId}/`);
    return response.data;
  },

  retryReportStatus: async (reportId) => {
    const response = await api.post(`/report-status/${reportId}/retry/`);
    return response.data;
  },

  getMarketSummary: async () => {
    const response = await api.get('/companies/market-summary/');
    return response.data;
  },

  getTrending: async () => {
    const response = await api.get('/companies/trending/');
    return response.data;
  },

  getDashboardNews: async () => {
    const response = await api.get('/companies/dashboard-news/');
    return response.data;
  }
};

export default researchService;
