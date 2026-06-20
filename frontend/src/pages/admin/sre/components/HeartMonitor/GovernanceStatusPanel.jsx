import React from 'react';

const GovernanceStatusPanel = ({ status }) => {
  if (!status) return null;

  const isBreakGlass = status.breakGlassActive && new Date(status.breakGlassExpiresAt) > new Date();

  return (
    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 shadow-sm h-full flex flex-col justify-between">
      <div>
        <h2 className="text-gray-400 text-sm font-semibold tracking-wider uppercase mb-4">SRE Governance Status</h2>
        
        <div className="flex items-start gap-12">
          <div>
            <div className="text-gray-500 text-xs uppercase mb-1">Enforcement Layer</div>
            <div className={`text-lg font-bold ${status.sreState === 'FROZEN' ? 'text-red-500' : 'text-green-500'}`}>
              {status.sreState === 'FROZEN' ? 'LOCKED (423)' : 'ACTIVE'}
            </div>
            {status.freezeReason && (
              <div className="text-sm text-red-400 mt-1 mt-2 max-w-sm">Reason: {status.freezeReason}</div>
            )}
          </div>

          <div>
            <div className="text-gray-500 text-xs uppercase mb-1">Break Glass Override</div>
            <div className="text-lg font-bold text-gray-100 flex items-center gap-2">
              {isBreakGlass ? (
                <>
                  <span className="w-3 h-3 bg-purple-500 rounded-full animate-pulse"></span>
                  <span className="text-purple-400">ACTIVE</span>
                </>
              ) : (
                <span className="text-gray-600">INACTIVE</span>
              )}
            </div>
          </div>
          
          {isBreakGlass && (
            <div>
              <div className="text-gray-500 text-xs uppercase mb-1">Expires At</div>
              <div className="text-lg font-bold text-gray-100">
                {new Date(status.breakGlassExpiresAt).toLocaleTimeString()}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 border-t border-gray-800 pt-4">
        <div className="text-gray-500 text-xs uppercase mb-2">Allowed Scope (Break-Glass Context)</div>
        <div className="flex gap-4 text-sm font-mono">
          <div className="flex items-center gap-2">
            {isBreakGlass && status.breakGlassScope?.includes('replayDlq') ? (
              <span className="text-green-500">✓</span>
            ) : (
              <span className="text-gray-600">✗</span>
            )}
            <span className={isBreakGlass && status.breakGlassScope?.includes('replayDlq') ? 'text-gray-300' : 'text-gray-600'}>replayDlq</span>
          </div>
          <div className="flex items-center gap-2">
            {isBreakGlass && status.breakGlassScope?.includes('retryJob') ? (
              <span className="text-green-500">✓</span>
            ) : (
              <span className="text-gray-600">✗</span>
            )}
            <span className={isBreakGlass && status.breakGlassScope?.includes('retryJob') ? 'text-gray-300' : 'text-gray-600'}>retryJob</span>
          </div>
          <div className="flex items-center gap-2">
            {isBreakGlass && status.breakGlassScope?.includes('ackAlert') ? (
              <span className="text-green-500">✓</span>
            ) : (
              <span className="text-gray-600">✗</span>
            )}
            <span className={isBreakGlass && status.breakGlassScope?.includes('ackAlert') ? 'text-gray-300' : 'text-gray-600'}>ackAlert</span>
          </div>
        </div>
      </div>

    </div>
  );
};

export default GovernanceStatusPanel;
