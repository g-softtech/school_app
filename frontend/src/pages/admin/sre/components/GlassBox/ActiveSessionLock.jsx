import React from 'react';
import BreakGlassCountdown from './BreakGlassCountdown';
import ScopePermissionsCard from './ScopePermissionsCard';

const ActiveSessionLock = ({ status }) => {
  const adminName = status.breakGlassAdminId?.name || 'Administrator';

  return (
    <div className="bg-purple-900/10 border-2 border-purple-700 rounded-lg p-8 space-y-6">
      <div className="flex items-center gap-3">
        <span className="w-4 h-4 rounded-full bg-purple-500 animate-pulse"></span>
        <h2 className="text-xl font-bold text-purple-300">Emergency Override Already Active</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <div className="text-gray-500 text-xs uppercase tracking-widest mb-1">Activated By</div>
            <div className="text-gray-100 text-lg font-semibold">{adminName}</div>
          </div>
          <div>
            <div className="text-gray-500 text-xs uppercase tracking-widest mb-1">Reason</div>
            <div className="text-gray-300 text-sm bg-gray-800 rounded p-3 border border-gray-700">
              {status.breakGlassReason || '—'}
            </div>
          </div>
        </div>

        <div>
          <BreakGlassCountdown expiresAt={status.breakGlassExpiresAt} />
        </div>
      </div>

      <ScopePermissionsCard activeScope={status.breakGlassScope} />

      <p className="text-gray-600 text-xs text-center">
        A new override cannot be stacked. Wait for this session to expire or contact the activating administrator.
      </p>
    </div>
  );
};

export default ActiveSessionLock;
