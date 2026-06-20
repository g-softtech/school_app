import React from 'react';
import RootCauseSummaryPanel from './RootCauseSummaryPanel';

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

const IncidentTimeline = ({ incidents }) => {
  if (!incidents || incidents.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center text-gray-500">
        No incidents recorded in this timeframe.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {incidents.map((incident) => {
        // Merge state transitions and interventions for a single chronologial incident timeline
        const allEvents = [
          ...incident.events.map(e => ({ type: 'STATE', time: new Date(e.timestamp), data: e })),
          ...incident.interventions.map(i => ({ type: 'INTERVENTION', time: new Date(i.timestamp), data: i }))
        ].sort((a, b) => a.time - b.time);

        return (
          <div key={incident.id} className="bg-gray-950 border border-gray-800 rounded-xl overflow-hidden">
            {/* Incident Header */}
            <div className={`px-6 py-4 border-b border-gray-800 flex justify-between items-center ${incident.status === 'ONGOING' ? 'bg-red-900/20' : 'bg-gray-900'}`}>
              <div>
                <h3 className="text-lg font-bold text-gray-100">{incident.id}</h3>
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(incident.startTime).toLocaleString()} — {incident.endTime ? new Date(incident.endTime).toLocaleString() : 'Present'}
                </div>
              </div>
              <div>
                <span className={`px-3 py-1 rounded text-xs font-bold ${incident.status === 'ONGOING' ? 'bg-red-500 text-white animate-pulse' : 'bg-green-900/30 text-green-400 border border-green-800'}`}>
                  {incident.status}
                </span>
              </div>
            </div>

            <div className="p-6">
              <RootCauseSummaryPanel incident={incident} />

              <h4 className="text-gray-400 text-xs font-semibold tracking-wider uppercase mb-4">Event Reconstruction</h4>
              
              <div className="space-y-0 relative before:absolute before:inset-0 before:ml-3 before:-translate-x-px before:h-full before:w-0.5 before:bg-gray-800">
                {allEvents.map((ev, idx) => (
                  <div key={idx} className="relative flex items-start gap-6 pb-6 last:pb-0">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-900 border-2 border-gray-700 z-10 shrink-0 mt-0.5"></div>
                    <div className="flex-1 -mt-1">
                      <div className="text-xs text-gray-500 font-mono mb-1">{ev.time.toLocaleTimeString()}</div>
                      
                      {ev.type === 'STATE' ? (
                        <div className="bg-gray-900 border border-gray-800 rounded p-3 text-sm">
                          <span className="text-gray-400">SRE State: </span>
                          <span className={getStateColor(ev.data.fromState)}>{ev.data.fromState}</span>
                          <span className="text-gray-600 mx-2">→</span>
                          <span className={getStateColor(ev.data.toState)}>{ev.data.toState}</span>
                        </div>
                      ) : (
                        <div className="bg-purple-900/20 border border-purple-800/50 rounded p-3 text-sm flex justify-between items-center">
                          <div>
                            <span className="text-purple-400 font-bold">{ev.data.action.replace('SRE_', '').replace(/_/g, ' ')}</span>
                            <span className="text-gray-500 ml-2">by {ev.data.actor}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default IncidentTimeline;
