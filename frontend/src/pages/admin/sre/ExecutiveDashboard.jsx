import React, { useState, useEffect } from 'react';
import { sreService } from '../../../services/sreService';
import ReliabilityScoreCard from './components/Executive/ReliabilityScoreCard';
import ActiveIncidentBanner from './components/Executive/ActiveIncidentBanner';
import KpiStrip from './components/Executive/KpiStrip';
import ReliabilityTrendChart from './components/Executive/ReliabilityTrendChart';
import IncidentSummaryTable from './components/Executive/IncidentSummaryTable';
import CertificationStatusCard from './components/Executive/CertificationStatusCard';

const ExecutiveDashboard = () => {
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [sumRes, histRes, incRes] = await Promise.all([
          sreService.getExecutiveSummary(),
          sreService.getReliabilityHistory(30),
          sreService.getIncidents(),
        ]);
        if (!mounted) return;
        setSummary(sumRes.data);
        setHistory(histRes.data);
        setIncidents(incRes.data);
      } catch (err) {
        if (mounted) setError('Failed to load executive summary.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    const interval = setInterval(load, 60000); // refresh every minute
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400 animate-pulse">
        Loading Executive Summary...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 p-8 text-red-400">{error}</div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <header className="border-b border-gray-800 pb-4">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Executive Reliability Dashboard
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Business-level system health for principals and management.
          </p>
        </header>

        {/* Active Incident Banner */}
        <ActiveIncidentBanner summary={summary} />

        {/* Hero Reliability Score */}
        <ReliabilityScoreCard summary={summary} />

        {/* KPI Strip */}
        <KpiStrip summary={summary} />

        {/* Reliability Trend Chart */}
        <ReliabilityTrendChart history={history} />

        {/* Incident Table + Certification */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <IncidentSummaryTable incidents={incidents} />
          <CertificationStatusCard certification={summary?.lastCertification} />
        </div>

      </div>
    </div>
  );
};

export default ExecutiveDashboard;
