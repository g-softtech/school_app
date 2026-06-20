import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const SuccessFailureChart = ({ trends }) => {
  if (!trends || trends.length === 0) {
    return (
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 shadow-sm h-64 flex items-center justify-center">
        <span className="text-gray-500">No trend data available</span>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 shadow-sm h-80 flex flex-col">
      <h2 className="text-gray-400 text-sm font-semibold tracking-wider uppercase mb-4">Success vs Failure Rate</h2>
      <div className="flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trends} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
            <XAxis dataKey="timestamp" stroke="#6b7280" fontSize={12} tickFormatter={(tick) => new Date(tick).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} />
            <YAxis stroke="#6b7280" fontSize={12} />
            <Tooltip
              contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#f3f4f6' }}
              labelFormatter={(label) => new Date(label).toLocaleTimeString()}
            />
            <Line type="monotone" dataKey="completed" stroke="#10b981" strokeWidth={3} dot={false} name="Completed" />
            <Line type="monotone" dataKey="failed" stroke="#ef4444" strokeWidth={3} dot={false} name="Failed" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default SuccessFailureChart;
