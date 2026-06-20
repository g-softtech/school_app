import React from 'react';

const UnifiedEventStream = ({ events }) => {
  if (!events || events.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center text-gray-500">
        No events found in the selected timeframe.
      </div>
    );
  }

  const renderEventDetails = (ev) => {
    switch (ev.type) {
      case 'STATE_CHANGE':
        return (
          <div className="text-gray-300">
            SRE State Transition: <span className="font-bold text-gray-100">{ev.details.fromState}</span> → <span className="font-bold text-gray-100">{ev.details.toState}</span>
            <div className="text-xs text-gray-500 mt-1">Trigger: {ev.details.triggerSource} | Burn: {(ev.details.burnRateFast||0).toFixed(2)}x</div>
          </div>
        );
      case 'SRE_BREAK_GLASS_ACTIVATED':
        return (
          <div className="text-purple-300">
            Emergency Override Activated by {ev.actor}
            <div className="text-xs text-purple-400 mt-1">Scope: {ev.details?.scope?.join(', ')}</div>
          </div>
        );
      case 'ALERT':
        return (
          <div className="text-orange-300">
            System Alert ({ev.details.severity}): {ev.details.message}
            <div className="text-xs text-orange-400 mt-1">Status: {ev.details.status}</div>
          </div>
        );
      default:
        return (
          <div className="text-gray-300">
            {ev.type.replace(/_/g, ' ')} by {ev.actor || 'System'}
          </div>
        );
    }
  };

  const getEventIcon = (type) => {
    if (type === 'STATE_CHANGE') return '🔄';
    if (type.includes('BREAK_GLASS')) return '🔴';
    if (type === 'ALERT') return '⚠';
    return '⚡';
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
      <table className="w-full text-left text-sm text-gray-400">
        <thead className="bg-gray-950 text-xs uppercase text-gray-500 border-b border-gray-800">
          <tr>
            <th className="px-6 py-4">Timestamp</th>
            <th className="px-6 py-4">Event</th>
            <th className="px-6 py-4">Details</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {events.map(ev => (
            <tr key={ev.id} className="hover:bg-gray-800/50 transition-colors">
              <td className="px-6 py-4 font-mono text-xs whitespace-nowrap">
                {new Date(ev.timestamp).toLocaleString()}
              </td>
              <td className="px-6 py-4">
                <span className="flex items-center gap-2">
                  <span>{getEventIcon(ev.type)}</span>
                  <span className="font-semibold text-gray-300">{ev.type}</span>
                </span>
              </td>
              <td className="px-6 py-4">
                {renderEventDetails(ev)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default UnifiedEventStream;
