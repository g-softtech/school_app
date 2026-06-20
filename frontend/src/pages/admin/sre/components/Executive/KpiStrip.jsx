import React from 'react';

const kpis = (summary) => [
  {
    label: 'Service Availability',
    value: `${summary?.availability?.toFixed(3) ?? '—'}%`,
    sub: 'This Month',
    color: 'text-emerald-400',
  },
  {
    label: 'Mean Time To Recovery',
    value: summary?.mttrMinutes > 0 ? `${summary.mttrMinutes}m` : '—',
    sub: 'Average (Resolved Incidents)',
    color: 'text-blue-400',
  },
  {
    label: 'Incidents This Month',
    value: summary?.incidentsThisMonth ?? 0,
    sub: 'Total Disruption Events',
    color: summary?.incidentsThisMonth > 3 ? 'text-orange-400' : 'text-gray-100',
  },
  {
    label: 'Open Critical Alerts',
    value: summary?.criticalAlerts ?? 0,
    sub: 'Requiring Attention',
    color: summary?.criticalAlerts > 0 ? 'text-red-400' : 'text-green-400',
  },
];

const KpiStrip = ({ summary }) => {
  const items = kpis(summary);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {items.map((kpi) => (
        <div key={kpi.label} className="bg-gray-900 rounded-xl border border-gray-800 p-6 flex flex-col gap-1">
          <div className="text-gray-500 text-xs uppercase tracking-widest">{kpi.label}</div>
          <div className={`text-3xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</div>
          <div className="text-gray-600 text-xs mt-1">{kpi.sub}</div>
        </div>
      ))}
    </div>
  );
};

export default KpiStrip;
