import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';

const ReliabilityTrendChart = ({ history }) => {
  if (!history || history.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 h-64 flex items-center justify-center text-gray-500">
        No reliability history available yet.
      </div>
    );
  }

  const min = Math.min(...history.map(h => h.reliability));
  const yDomain = [Math.max(90, Math.floor(min) - 1), 100];

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 h-80 flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-gray-300 font-semibold text-sm uppercase tracking-wider">Monthly Reliability Trend</h3>
        <span className="text-xs text-gray-500">Target: 99.5%</span>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history} margin={{ top: 5, right: 0, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="reliabilityGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="#6b7280"
              fontSize={11}
              tickFormatter={(d) => d.slice(5)} // MM-DD
            />
            <YAxis
              domain={yDomain}
              stroke="#6b7280"
              fontSize={11}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#f9fafb' }}
              formatter={(v) => [`${v.toFixed(3)}%`, 'Reliability']}
            />
            <ReferenceLine y={99.5} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'SLO', fill: '#f59e0b', fontSize: 11 }} />
            <Area
              type="monotone"
              dataKey="reliability"
              stroke="#10b981"
              strokeWidth={2.5}
              fill="url(#reliabilityGradient)"
              dot={false}
              name="Reliability %"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ReliabilityTrendChart;
