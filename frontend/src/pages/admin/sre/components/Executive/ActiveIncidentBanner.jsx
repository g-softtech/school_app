import React from 'react';

const ActiveIncidentBanner = ({ summary }) => {
  if (!summary?.isIncidentActive) {
    return (
      <div className="flex items-center gap-3 bg-green-900/20 border border-green-800 rounded-lg px-5 py-3">
        <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
        <span className="text-green-400 font-semibold text-sm">No Active Incidents</span>
        <span className="text-green-600 text-sm">— All systems are operating normally.</span>
      </div>
    );
  }

  const startedAt = summary.activeIncidentStartedAt ? new Date(summary.activeIncidentStartedAt) : null;
  const elapsedMinutes = startedAt
    ? Math.floor((Date.now() - startedAt.getTime()) / 60000)
    : null;

  return (
    <div className="flex items-start gap-4 bg-red-900/20 border-2 border-red-700 rounded-lg px-5 py-4 animate-pulse-slow">
      <span className="mt-0.5 w-3 h-3 rounded-full bg-red-500 animate-pulse shrink-0"></span>
      <div className="flex-1">
        <div className="text-red-300 font-bold text-sm uppercase tracking-wider mb-1">Active Incident In Progress</div>
        <div className="flex flex-wrap gap-6 text-sm text-gray-300">
          {elapsedMinutes !== null && (
            <span>Started: <span className="text-white font-semibold">{elapsedMinutes} minutes ago</span></span>
          )}
          <span>Current State: <span className={`font-semibold ${summary.activeIncidentState === 'FROZEN' ? 'text-red-400' : 'text-orange-400'}`}>{summary.activeIncidentState}</span></span>
          {summary.activeIncidentBreakGlass && (
            <span className="text-purple-400 font-semibold">● Break Glass Active</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActiveIncidentBanner;
