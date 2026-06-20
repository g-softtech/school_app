import React from 'react';

const OverrideEventTimeline = ({ history }) => {
  if (!history || history.length === 0) {
    return (
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
        <h3 className="text-gray-400 text-sm font-semibold tracking-wider uppercase mb-4">Recent Break-Glass Events</h3>
        <p className="text-gray-600 text-sm">No break-glass events recorded.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
      <h3 className="text-gray-400 text-sm font-semibold tracking-wider uppercase mb-6">Recent Break-Glass Events</h3>
      <div className="space-y-4">
        {history.map((event, i) => {
          const details = event.details || {};
          const admin = event.userId;
          const adminName = admin?.name || 'Unknown Admin';
          const scope = details.scope || [];
          const duration = details.durationMinutes || 10;

          return (
            <div key={i} className="flex gap-4 items-start border-l-2 border-purple-800/50 pl-4 py-1">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-gray-100 font-semibold text-sm">{adminName}</span>
                  <span className="text-gray-600 text-xs">{new Date(event.createdAt).toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500">
                  <span>Scope: <span className="text-purple-400 font-mono">{scope.join(', ') || '—'}</span></span>
                  <span>•</span>
                  <span>Duration: <span className="text-gray-400">{duration}m</span></span>
                </div>
                {details.reason && (
                  <p className="text-gray-400 text-xs mt-1 italic">"{details.reason.slice(0, 120)}{details.reason.length > 120 ? '…' : ''}"</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OverrideEventTimeline;
