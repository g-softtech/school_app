import React from 'react';
import { useNavigate } from 'react-router-dom';

const IncidentSummaryTable = ({ incidents }) => {
  const navigate = useNavigate();

  if (!incidents || incidents.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h3 className="text-gray-300 font-semibold text-sm uppercase tracking-wider mb-4">Recent Incidents</h3>
        <p className="text-gray-600 text-sm">No incidents recorded this period.</p>
      </div>
    );
  }

  const getSeverity = (incident) => {
    if (incident.peakBurn >= 14.4) return { label: 'Critical', color: 'text-red-400 bg-red-900/20 border-red-800' };
    if (incident.peakBurn >= 6) return { label: 'Major', color: 'text-orange-400 bg-orange-900/20 border-orange-800' };
    return { label: 'Warning', color: 'text-yellow-400 bg-yellow-900/20 border-yellow-800' };
  };

  const getResolution = (incident) => {
    if (incident.status === 'ONGOING') return { label: 'Ongoing', color: 'text-red-400' };
    if (incident.interventions?.some(i => i.action === 'SRE_BREAK_GLASS_ACTIVATED')) return { label: 'Break Glass', color: 'text-purple-400' };
    if (incident.interventions?.some(i => i.action === 'SRE_DLQ_REPLAYED')) return { label: 'DLQ Replay', color: 'text-blue-400' };
    return { label: 'Auto Recovery', color: 'text-green-400' };
  };

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-800">
        <h3 className="text-gray-300 font-semibold text-sm uppercase tracking-wider">Recent Incidents</h3>
      </div>
      <table className="w-full text-sm text-gray-400">
        <thead className="bg-gray-950 text-xs uppercase text-gray-600 border-b border-gray-800">
          <tr>
            <th className="px-6 py-3 text-left">Date</th>
            <th className="px-6 py-3 text-left">Severity</th>
            <th className="px-6 py-3 text-left">Duration</th>
            <th className="px-6 py-3 text-left">Resolution</th>
            <th className="px-6 py-3 text-left"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {incidents.slice(0, 10).map((inc) => {
            const sev = getSeverity(inc);
            const res = getResolution(inc);
            return (
              <tr key={inc.id} className="hover:bg-gray-800/40 transition-colors">
                <td className="px-6 py-4 font-mono text-xs whitespace-nowrap">
                  {new Date(inc.startTime).toLocaleDateString()}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-0.5 rounded border text-xs font-semibold ${sev.color}`}>{sev.label}</span>
                </td>
                <td className="px-6 py-4">
                  {inc.status === 'ONGOING'
                    ? <span className="text-red-400 animate-pulse">Ongoing</span>
                    : `${inc.durationMinutes ?? '< 1'} min`}
                </td>
                <td className={`px-6 py-4 font-semibold ${res.color}`}>{res.label}</td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => navigate('/admin/sre-flight-recorder')}
                    className="text-xs text-blue-500 hover:text-blue-400 hover:underline"
                  >
                    View →
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default IncidentSummaryTable;
