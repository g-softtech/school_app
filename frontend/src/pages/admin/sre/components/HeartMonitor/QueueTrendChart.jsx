import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const QueueTrendChart = ({ trends }) => {
  if (!trends || trends.length === 0) {
    return (
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 shadow-sm h-64 flex items-center justify-center">
        <span className="text-gray-500">No trend data available</span>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 shadow-sm h-80 flex flex-col">
      <h2 className="text-gray-400 text-sm font-semibold tracking-wider uppercase mb-4">Queue Growth Trend</h2>
      <div className="flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trends} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
            <XAxis dataKey="timestamp" stroke="#6b7280" fontSize={12} tickFormatter={(tick) => new Date(tick).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} />
            <YAxis stroke="#6b7280" fontSize={12} />
            <Tooltip
              contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#f3f4f6' }}
              labelFormatter={(label) => new Date(label).toLocaleTimeString()}
            />
            <Area type="monotone" dataKey="dead_letter" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} name="Dead Letter" />
            <Area type="monotone" dataKey="retry_wait" stackId="1" stroke="#f97316" fill="#f97316" fillOpacity={0.6} name="Retry Wait" />
            <Area type="monotone" dataKey="pending" stackId="1" stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.6} name="Pending" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default QueueTrendChart;
