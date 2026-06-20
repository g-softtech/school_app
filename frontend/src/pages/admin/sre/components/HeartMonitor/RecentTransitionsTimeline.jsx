import React from 'react';

const RecentTransitionsTimeline = ({ transitions }) => {
  if (!transitions || transitions.length === 0) {
    return (
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 shadow-sm mt-6">
        <h2 className="text-gray-400 text-sm font-semibold tracking-wider uppercase mb-4">Recent SRE State Transitions</h2>
        <span className="text-gray-500">No recent transitions recorded.</span>
      </div>
    );
  }

  const getStateColor = (state) => {
    switch (state) {
      case 'NORMAL': return 'text-green-400';
      case 'PENDING_FREEZE': return 'text-yellow-400';
      case 'DEGRADED': return 'text-orange-400';
      case 'FROZEN': return 'text-red-500';
      case 'EMERGENCY_BYPASS': return 'text-purple-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 shadow-sm mt-6">
      <h2 className="text-gray-400 text-sm font-semibold tracking-wider uppercase mb-6">Recent SRE State Transitions</h2>
      
      <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-700 before:to-transparent">
        
        {transitions.map((transition, index) => (
          <div key={transition.transitionId || index} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
            
            <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-gray-900 bg-gray-700 text-gray-300 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
            
            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-gray-800 p-4 rounded-lg border border-gray-700 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <time className="text-xs font-medium text-blue-400">{new Date(transition.timestamp).toLocaleString()}</time>
                <span className="text-xs font-mono text-gray-500">{transition.triggerSource}</span>
              </div>
              <div className="text-sm text-gray-300 font-bold flex items-center gap-2">
                <span className={getStateColor(transition.fromState)}>{transition.fromState}</span>
                <span className="text-gray-500">→</span>
                <span className={getStateColor(transition.toState)}>{transition.toState}</span>
              </div>
              {transition.errorAcceleration > 0 && (
                <div className="mt-2 text-xs text-red-400 bg-red-900/20 inline-block px-2 py-1 rounded">
                  Acceleration: +{transition.errorAcceleration} errors
                </div>
              )}
            </div>
          </div>
        ))}
        
      </div>
    </div>
  );
};

export default RecentTransitionsTimeline;
