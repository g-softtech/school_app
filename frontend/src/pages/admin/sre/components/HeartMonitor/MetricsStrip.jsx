import React from 'react';

const MetricsStrip = ({ metrics }) => {
  if (!metrics) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div className="bg-gray-900 rounded-lg p-5 border border-gray-800 shadow-sm flex flex-col items-center">
        <span className="text-gray-500 text-xs uppercase tracking-widest mb-1">Active Workers</span>
        <span className="text-3xl font-bold text-blue-400">{metrics.activeWorkers || 0}</span>
      </div>
      
      <div className="bg-gray-900 rounded-lg p-5 border border-gray-800 shadow-sm flex flex-col items-center">
        <span className="text-gray-500 text-xs uppercase tracking-widest mb-1">Pending Queue</span>
        <span className="text-3xl font-bold text-gray-100">{metrics.pending || 0}</span>
      </div>

      <div className="bg-gray-900 rounded-lg p-5 border border-gray-800 shadow-sm flex flex-col items-center">
        <span className="text-gray-500 text-xs uppercase tracking-widest mb-1">Retry Wait</span>
        <span className="text-3xl font-bold text-orange-400">{metrics.retry_wait || 0}</span>
      </div>

      <div className="bg-gray-900 rounded-lg p-5 border border-gray-800 shadow-sm flex flex-col items-center">
        <span className="text-gray-500 text-xs uppercase tracking-widest mb-1">Dead Letters (DLQ)</span>
        <span className="text-3xl font-bold text-red-500">{metrics.dead_letter || 0}</span>
      </div>
    </div>
  );
};

export default MetricsStrip;
