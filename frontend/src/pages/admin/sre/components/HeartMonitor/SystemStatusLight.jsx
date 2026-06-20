import React from 'react';

const SystemStatusLight = ({ status }) => {
  const state = status?.sreState || 'UNKNOWN';

  const configs = {
    NORMAL: { color: 'bg-green-500', border: 'border-green-400', shadow: 'shadow-green-500/50', label: 'NORMAL' },
    PENDING_FREEZE: { color: 'bg-yellow-500', border: 'border-yellow-400', shadow: 'shadow-yellow-500/50', label: 'PENDING FREEZE' },
    DEGRADED: { color: 'bg-orange-500', border: 'border-orange-400', shadow: 'shadow-orange-500/50', label: 'DEGRADED' },
    FROZEN: { color: 'bg-red-600', border: 'border-red-400', shadow: 'shadow-red-600/70', label: 'FROZEN' },
    EMERGENCY_BYPASS: { color: 'bg-purple-600', border: 'border-purple-400', shadow: 'shadow-purple-600/70', label: 'EMERGENCY BYPASS' },
    UNKNOWN: { color: 'bg-gray-600', border: 'border-gray-400', shadow: '', label: 'UNKNOWN' }
  };

  const config = configs[state] || configs.UNKNOWN;

  return (
    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 shadow-sm flex flex-col items-center justify-center h-full min-h-[200px]">
      <h2 className="text-gray-400 text-sm font-semibold tracking-wider uppercase mb-6">Traffic Light</h2>
      
      <div className={`w-24 h-24 rounded-full border-4 ${config.border} ${config.color} shadow-[0_0_40px_rgba(0,0,0,0.5)] ${config.shadow} transition-all duration-500 ease-in-out`}>
      </div>

      <div className={`mt-6 text-xl font-bold tracking-widest ${config.color.replace('bg-', 'text-')}`}>
        {config.label}
      </div>
    </div>
  );
};

export default SystemStatusLight;
