import api from './api';

export const sreService = {
  getHealth: async () => {
    const response = await api.get('/operations/outbox/health');
    return response.data;
  },
  getMetrics: async () => {
    const response = await api.get('/operations/outbox/metrics');
    return response.data;
  },
  getSreStatus: async () => {
    const response = await api.get('/operations/outbox/sre-status');
    return response.data;
  },
  getSreTransitions: async (limit = 5) => {
    const response = await api.get(`/operations/outbox/sre-transitions?limit=${limit}`);
    return response.data;
  },
  getTimeseries: async () => {
    const response = await api.get('/operations/outbox/timeseries');
    return response.data;
  },
  getCertification: async () => {
    const response = await api.get('/operations/certification');
    return response.data;
  },
  activateBreakGlass: async (payload) => {
    const response = await api.post('/operations/outbox/break-glass', payload);
    return response.data;
  },
  getBreakGlassHistory: async (limit = 10) => {
    const response = await api.get(`/operations/outbox/break-glass-history?limit=${limit}`);
    return response.data;
  },
  getIncidents: async () => {
    const response = await api.get('/operations/outbox/incidents');
    return response.data;
  },
  getUnifiedEvents: async (limit = 50) => {
    const response = await api.get(`/operations/outbox/unified-events?limit=${limit}`);
    return response.data;
  },
  getExecutiveSummary: async () => {
    const response = await api.get('/operations/outbox/executive-summary');
    return response.data;
  },
  getReliabilityHistory: async (days = 30) => {
    const response = await api.get(`/operations/outbox/reliability-history?days=${days}`);
    return response.data;
  }
};
