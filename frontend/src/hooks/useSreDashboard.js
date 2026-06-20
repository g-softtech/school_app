import { useState, useEffect } from 'react';
import { sreService } from '../services/sreService';

export const useSreDashboard = () => {
  const [status, setStatus] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [transitions, setTransitions] = useState([]);
  const [trends, setTrends] = useState(null);
  const [certification, setCertification] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    const fetchFast = async () => {
      try {
        const [statusData, metricsData, transitionsData, certData] = await Promise.all([
          sreService.getSreStatus(),
          sreService.getMetrics(),
          sreService.getSreTransitions(),
          sreService.getCertification().catch(() => ({ data: null }))
        ]);
        if (mounted) {
          setStatus(statusData.data);
          setMetrics(metricsData.data);
          setTransitions(transitionsData.data);
          if (certData && certData.data) {
            setCertification(certData.data);
          }
          setError(null);
        }
      } catch (err) {
        if (mounted) setError(err.response?.data?.message || err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    const fetchSlow = async () => {
      try {
        const trendsData = await sreService.getTimeseries();
        if (mounted) {
          setTrends(trendsData.data);
        }
      } catch (err) {
        console.error('Failed to load trends', err);
      }
    };

    // Initial fetch
    fetchFast();
    fetchSlow();

    // The backend worker is evaluating every 60s. We poll /sre-status and /metrics every 15s
    const fastInterval = setInterval(fetchFast, 15000);
    // Poll timeseries every 60s
    const slowInterval = setInterval(fetchSlow, 60000);

    return () => {
      mounted = false;
      clearInterval(fastInterval);
      clearInterval(slowInterval);
    };
  }, []);

  return { status, metrics, transitions, trends, certification, loading, error };
};
