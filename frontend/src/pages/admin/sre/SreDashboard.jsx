import React from 'react';
import { useSreDashboard } from '../../../hooks/useSreDashboard';
import TrustScorePanel from './components/HeartMonitor/TrustScorePanel';
import SystemStatusLight from './components/HeartMonitor/SystemStatusLight';
import GovernanceStatusPanel from './components/HeartMonitor/GovernanceStatusPanel';
import MetricsStrip from './components/HeartMonitor/MetricsStrip';
import BurnRateMiniPanel from './components/HeartMonitor/BurnRateMiniPanel';
import QueueTrendChart from './components/HeartMonitor/QueueTrendChart';
import SuccessFailureChart from './components/HeartMonitor/SuccessFailureChart';
import RecentTransitionsTimeline from './components/HeartMonitor/RecentTransitionsTimeline';

const SreDashboard = () => {
  const { status, metrics, transitions, trends, certification, loading, error } = useSreDashboard();

  if (loading && !status) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="text-xl animate-pulse">Initializing SRE Control Plane...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-gray-900 min-h-screen text-red-500">
        <h2 className="text-2xl font-bold mb-4">Control Plane Connectivity Error</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <header className="mb-8 border-b border-gray-800 pb-4">
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <span className="text-blue-500">◈</span> SRE Control Plane
          </h1>
          <p className="text-gray-400 mt-1">Real-time reliability telemetry and governance status</p>
        </header>

        {/* 1. Trust Score Panel */}
        <TrustScorePanel certification={certification} />

        {/* 2. Traffic Light & Governance Status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <SystemStatusLight status={status} />
          </div>
          <div className="lg:col-span-2">
            <GovernanceStatusPanel status={status} />
          </div>
        </div>

        {/* 3. Metrics Strip */}
        <MetricsStrip metrics={metrics} />

        {/* 4. Burn Rate Panel */}
        <BurnRateMiniPanel status={status} />

        {/* 5. Trend Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <QueueTrendChart trends={trends} />
          <SuccessFailureChart trends={trends} />
        </div>

        {/* 6. Recent Transitions Timeline */}
        <RecentTransitionsTimeline transitions={transitions} />

      </div>
    </div>
  );
};

export default SreDashboard;
