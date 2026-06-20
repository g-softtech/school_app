import React from 'react';

const BurnRateMiniPanel = ({ status }) => {
  if (!status) return null;

  const thresholds = { fast: 14.4, medium: 6, slow: 1 };

  const renderBurnRate = (label, current, threshold, unit) => {
    const ratio = current / threshold;
    let colorClass = 'text-green-500';
    let bgClass = 'bg-green-500';
    if (ratio >= 1) {
      colorClass = 'text-red-500';
      bgClass = 'bg-red-500';
    } else if (ratio > 0.5) {
      colorClass = 'text-orange-400';
      bgClass = 'bg-orange-400';
    }

    return (
      <div className="flex flex-col border-r border-gray-800 last:border-0 px-6">
        <span className="text-gray-500 text-xs uppercase tracking-widest mb-2 flex items-center justify-between">
          {label} <span className="text-gray-600 ml-2">({unit})</span>
        </span>
        <div className="flex items-end gap-2">
          <span className={`text-3xl font-bold ${colorClass}`}>{current.toFixed(2)}x</span>
          <span className="text-sm text-gray-500 mb-1">/ {threshold}x limit</span>
        </div>
        <div className="w-full bg-gray-800 h-1 mt-3 rounded-full overflow-hidden">
          <div className={`h-full ${bgClass}`} style={{ width: `${Math.min(ratio * 100, 100)}%` }}></div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-gray-400 text-sm font-semibold tracking-wider uppercase">Burn Rate Signals</h2>
        {status.currentAcceleration > 0 && (
          <span className="text-xs bg-red-900/30 text-red-400 px-3 py-1 rounded-full border border-red-800/50 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            Error Acceleration Detected: +{status.currentAcceleration}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-800 -mx-6">
        {renderBurnRate('Fast Burn', status.currentFastBurn || 0, thresholds.fast, '5m')}
        {renderBurnRate('Medium Burn', status.currentMediumBurn || 0, thresholds.medium, '60m')}
        {renderBurnRate('Slow Burn', status.currentSlowBurn || 0, thresholds.slow, '240m')}
      </div>
    </div>
  );
};

export default BurnRateMiniPanel;
