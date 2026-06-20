import React from 'react';

const TrustScorePanel = ({ certification }) => {
  if (!certification) return null;

  return (
    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 shadow-sm flex items-center justify-between">
      <div>
        <h2 className="text-gray-400 text-sm font-semibold tracking-wider uppercase">System Reliability Trust Score</h2>
        <div className="flex items-center gap-4 mt-2">
          <span className="text-3xl font-bold text-white">
            Certified: {certification.isCertified ? <span className="text-green-500">PASS</span> : <span className="text-red-500">FAIL</span>}
          </span>
          <span className="text-gray-500 text-sm bg-gray-800 px-3 py-1 rounded-full border border-gray-700">
            {certification.version}
          </span>
        </div>
      </div>
      <div className="flex gap-8 text-right">
        <div>
          <div className="text-2xl font-bold text-gray-100">{certification.jobLossRate}%</div>
          <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">Job Loss</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-gray-100">{certification.doubleExecutions}</div>
          <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">Double Exec.</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-gray-100">{certification.indexDegradationRate}%</div>
          <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">Index Degradation</div>
        </div>
      </div>
    </div>
  );
};

export default TrustScorePanel;
