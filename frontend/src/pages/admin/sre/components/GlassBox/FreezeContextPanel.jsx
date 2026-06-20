import React from 'react';

const FreezeContextPanel = ({ status }) => {
  if (!status) return null;

  const stateColors = {
    FROZEN: 'border-red-800 bg-red-900/10',
    DEGRADED: 'border-orange-800 bg-orange-900/10',
    PENDING_FREEZE: 'border-yellow-800 bg-yellow-900/10',
    NORMAL: 'border-green-800 bg-green-900/10',
    EMERGENCY_BYPASS: 'border-purple-800 bg-purple-900/10',
  };

  const stateTextColors = {
    FROZEN: 'text-red-400',
    DEGRADED: 'text-orange-400',
    PENDING_FREEZE: 'text-yellow-400',
    NORMAL: 'text-green-400',
    EMERGENCY_BYPASS: 'text-purple-400',
  };

  const borderClass = stateColors[status.sreState] || 'border-gray-700 bg-gray-800/30';
  const textClass = stateTextColors[status.sreState] || 'text-gray-400';

  return (
    <div className={`rounded-lg p-6 border-2 ${borderClass}`}>
      <h3 className="text-gray-300 text-sm font-semibold tracking-wider uppercase mb-5">
        ⚠ Why Did the System Freeze?
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-y-5 gap-x-8">
        <div>
          <div className="text-gray-500 text-xs uppercase tracking-widest mb-1">Current State</div>
          <div className={`text-xl font-bold ${textClass}`}>{status.sreState}</div>
        </div>
        {status.freezeReason && (
          <div>
            <div className="text-gray-500 text-xs uppercase tracking-widest mb-1">Trigger</div>
            <div className="text-gray-100 font-mono text-sm">{status.freezeReason}</div>
          </div>
        )}
        {status.freezeStartedAt && (
          <div>
            <div className="text-gray-500 text-xs uppercase tracking-widest mb-1">Freeze Started</div>
            <div className="text-gray-100 text-sm">{new Date(status.freezeStartedAt).toLocaleString()}</div>
          </div>
        )}
        <div>
          <div className="text-gray-500 text-xs uppercase tracking-widest mb-1">Fast Burn (5m)</div>
          <div className={`text-xl font-bold ${status.currentFastBurn > 14.4 ? 'text-red-400' : 'text-gray-100'}`}>
            {(status.currentFastBurn || 0).toFixed(2)}x
          </div>
        </div>
        <div>
          <div className="text-gray-500 text-xs uppercase tracking-widest mb-1">Medium Burn (60m)</div>
          <div className={`text-xl font-bold ${status.currentMediumBurn > 6 ? 'text-orange-400' : 'text-gray-100'}`}>
            {(status.currentMediumBurn || 0).toFixed(2)}x
          </div>
        </div>
        <div>
          <div className="text-gray-500 text-xs uppercase tracking-widest mb-1">Error Acceleration</div>
          <div className={`text-xl font-bold ${status.currentAcceleration > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {status.currentAcceleration > 0 ? '+' : ''}{status.currentAcceleration || 0}
          </div>
        </div>
        <div>
          <div className="text-gray-500 text-xs uppercase tracking-widest mb-1">DLQ Size</div>
          <div className="text-xl font-bold text-gray-100">{status.errorBudgetUsed || 0} jobs</div>
        </div>
        <div>
          <div className="text-gray-500 text-xs uppercase tracking-widest mb-1">Evaluation Model</div>
          <div className="text-gray-400 text-sm font-mono">{status.evaluationVersion || 'v1.0'}</div>
        </div>
      </div>
    </div>
  );
};

export default FreezeContextPanel;
