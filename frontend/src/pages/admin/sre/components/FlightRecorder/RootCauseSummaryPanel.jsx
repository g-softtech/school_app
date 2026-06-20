import React from 'react';

const RootCauseSummaryPanel = ({ incident }) => {
  if (!incident) return null;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 mb-6">
      <h4 className="text-gray-400 text-xs font-semibold tracking-wider uppercase mb-4">Root Cause Analysis</h4>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <div className="text-gray-500 text-[10px] uppercase tracking-widest mb-1">Primary Trigger</div>
          <div className="text-red-400 font-mono text-sm">{incident.trigger}</div>
        </div>
        
        <div>
          <div className="text-gray-500 text-[10px] uppercase tracking-widest mb-1">Peak Burn</div>
          <div className="text-gray-100 font-bold text-sm">{(incident.peakBurn || 0).toFixed(2)}x</div>
        </div>

        <div>
          <div className="text-gray-500 text-[10px] uppercase tracking-widest mb-1">Peak Error Accel</div>
          <div className="text-gray-100 font-bold text-sm">{incident.peakAcceleration > 0 ? '+' : ''}{incident.peakAcceleration}</div>
        </div>

        <div>
          <div className="text-gray-500 text-[10px] uppercase tracking-widest mb-1">Recovery Method</div>
          <div className="text-green-400 font-mono text-sm">
            {incident.interventions?.length > 0 
              ? incident.interventions.map(i => i.action.replace('SRE_', '')).join(', ') 
              : 'Auto-Recovered'}
          </div>
        </div>
        
        <div>
          <div className="text-gray-500 text-[10px] uppercase tracking-widest mb-1">Recovery Time</div>
          <div className="text-gray-100 font-bold text-sm">
            {incident.status === 'ONGOING' ? 'Ongoing' : `${incident.durationMinutes || '< 1'} minutes`}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RootCauseSummaryPanel;
