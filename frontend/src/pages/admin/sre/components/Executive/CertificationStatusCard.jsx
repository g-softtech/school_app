import React from 'react';

const CertificationStatusCard = ({ certification }) => {
  if (!certification) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h3 className="text-gray-300 font-semibold text-sm uppercase tracking-wider mb-3">System Certification</h3>
        <p className="text-gray-600 text-sm">No certification on record.</p>
      </div>
    );
  }

  const isPassed = certification.status === 'PASS';

  return (
    <div className={`rounded-xl border-2 p-6 ${isPassed ? 'border-emerald-800 bg-emerald-900/10' : 'border-red-800 bg-red-900/10'}`}>
      <div className="flex justify-between items-start mb-5">
        <h3 className="text-gray-300 font-semibold text-sm uppercase tracking-wider">Latest Chaos Certification</h3>
        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${isPassed ? 'bg-emerald-900/30 text-emerald-400 border-emerald-700' : 'bg-red-900/30 text-red-400 border-red-700'}`}>
          {isPassed ? '✓ CERTIFIED' : '✗ FAILED'}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
        <div>
          <div className="text-gray-500 text-xs uppercase tracking-widest mb-1">Version</div>
          <div className="text-gray-100 font-mono text-sm font-bold">{certification.version}</div>
        </div>
        <div>
          <div className="text-gray-500 text-xs uppercase tracking-widest mb-1">Last Tested</div>
          <div className="text-gray-100 text-sm">
            {certification.certifiedAt ? new Date(certification.certifiedAt).toLocaleDateString() : '—'}
          </div>
        </div>
        <div>
          <div className="text-gray-500 text-xs uppercase tracking-widest mb-1">Worker Kills Survived</div>
          <div className="text-gray-100 font-bold text-sm">{certification.workerKillsSurvived ?? '—'}</div>
        </div>
        <div>
          <div className="text-gray-500 text-xs uppercase tracking-widest mb-1">Job Loss Rate</div>
          <div className={`font-bold text-sm ${certification.jobLossRate === 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {(certification.jobLossRate * 100).toFixed(2)}%
          </div>
        </div>
        <div>
          <div className="text-gray-500 text-xs uppercase tracking-widest mb-1">Double Execution</div>
          <div className={`font-bold text-sm ${certification.duplicateExecution === 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {(certification.duplicateExecution * 100).toFixed(2)}%
          </div>
        </div>
        <div>
          <div className="text-gray-500 text-xs uppercase tracking-widest mb-1">Financial Safety</div>
          <div className={`font-bold text-sm ${certification.jobLossRate === 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {certification.jobLossRate === 0 ? 'GUARANTEED' : 'AT RISK'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CertificationStatusCard;
