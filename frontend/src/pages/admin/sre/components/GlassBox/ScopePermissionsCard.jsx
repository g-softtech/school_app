import React from 'react';

const SCOPE_DESCRIPTIONS = {
  replayDlq: {
    label: 'Replay DLQ',
    description: 'Replay dead-letter jobs back into the processing queue',
    risk: 'MEDIUM',
  },
  retryJob: {
    label: 'Retry Job',
    description: 'Retry individual failed jobs',
    risk: 'MEDIUM',
  },
  ackAlert: {
    label: 'Acknowledge Alert',
    description: 'Acknowledge active incidents (required for forceResolve)',
    risk: 'LOW',
  },
  forceResolve: {
    label: 'Force Resolve',
    description: 'Force close an alert without recovery — can hide active incidents',
    risk: 'HIGH',
  },
};

const riskBadge = {
  LOW: 'bg-green-900/30 text-green-400 border-green-800',
  MEDIUM: 'bg-orange-900/30 text-orange-400 border-orange-800',
  HIGH: 'bg-red-900/30 text-red-400 border-red-800',
};

const ScopePermissionsCard = ({ activeScope }) => {
  const scope = activeScope || [];

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-800">
        <h3 className="text-gray-300 text-sm font-semibold tracking-wider uppercase">Scope Permissions</h3>
      </div>
      <div className="divide-y divide-gray-800">
        {Object.entries(SCOPE_DESCRIPTIONS).map(([key, meta]) => {
          const allowed = scope.includes(key);
          return (
            <div key={key} className={`px-6 py-4 flex items-start justify-between gap-4 ${allowed ? '' : 'opacity-50'}`}>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <span className={`w-4 h-4 flex items-center justify-center text-sm font-bold ${allowed ? 'text-green-400' : 'text-gray-600'}`}>
                    {allowed ? '✓' : '✗'}
                  </span>
                  <span className={`font-semibold text-sm ${allowed ? 'text-gray-100' : 'text-gray-500'}`}>
                    {meta.label}
                  </span>
                  <span className="font-mono text-xs text-gray-600">{key}</span>
                </div>
                <p className="text-xs text-gray-500 ml-7">{meta.description}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded border font-semibold ${riskBadge[meta.risk]}`}>
                {meta.risk}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ScopePermissionsCard;
