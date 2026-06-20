import React from 'react';

const gradeColors = {
  'A+': { text: 'text-emerald-400', bg: 'bg-emerald-900/20', border: 'border-emerald-700', glow: 'shadow-emerald-900/50' },
  'A':  { text: 'text-green-400',   bg: 'bg-green-900/20',   border: 'border-green-700',   glow: 'shadow-green-900/50' },
  'B':  { text: 'text-blue-400',    bg: 'bg-blue-900/20',    border: 'border-blue-700',    glow: 'shadow-blue-900/50' },
  'C':  { text: 'text-yellow-400',  bg: 'bg-yellow-900/20',  border: 'border-yellow-700',  glow: 'shadow-yellow-900/50' },
  'D':  { text: 'text-orange-400',  bg: 'bg-orange-900/20',  border: 'border-orange-700',  glow: 'shadow-orange-900/50' },
  'F':  { text: 'text-red-500',     bg: 'bg-red-900/20',     border: 'border-red-700',     glow: 'shadow-red-900/50' },
};

const ReliabilityScoreCard = ({ summary }) => {
  if (!summary) return null;
  const grade = summary.grade || 'A+';
  const colors = gradeColors[grade] || gradeColors['A+'];

  return (
    <div className={`rounded-2xl border-2 ${colors.border} ${colors.bg} p-8 shadow-xl ${colors.glow} flex flex-col md:flex-row items-center justify-between gap-8`}>
      
      {/* Grade Badge */}
      <div className="flex flex-col items-center">
        <div className={`text-8xl font-black ${colors.text} leading-none`}>{grade}</div>
        <div className="text-gray-500 text-xs uppercase tracking-widest mt-2">Reliability Grade</div>
      </div>

      {/* Score and Status */}
      <div className="flex-1 text-center md:text-left">
        <div className="text-gray-400 text-sm uppercase tracking-widest mb-1">30-Day Reliability Score</div>
        <div className={`text-5xl font-bold ${colors.text}`}>{summary.reliabilityScore?.toFixed(3)}%</div>
        <div className="text-gray-500 text-sm mt-2">
          {summary.financialDataLoss === 0
            ? <span className="text-green-400">✓ Zero financial data loss confirmed</span>
            : <span className="text-red-400">⚠ Data loss detected: {summary.financialDataLoss}%</span>}
        </div>
      </div>

      {/* Right column stats */}
      <div className="grid grid-cols-2 gap-x-10 gap-y-4 text-right">
        <div>
          <div className="text-gray-500 text-xs uppercase tracking-widest mb-1">Last Incident</div>
          <div className="text-gray-100 font-bold text-lg">
            {summary.lastIncidentDaysAgo !== null ? `${summary.lastIncidentDaysAgo}d ago` : 'None'}
          </div>
        </div>
        <div>
          <div className="text-gray-500 text-xs uppercase tracking-widest mb-1">Critical Alerts</div>
          <div className={`font-bold text-lg ${summary.criticalAlerts > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {summary.criticalAlerts}
          </div>
        </div>
        <div>
          <div className="text-gray-500 text-xs uppercase tracking-widest mb-1">Avg MTTR</div>
          <div className="text-gray-100 font-bold text-lg">
            {summary.mttrMinutes > 0 ? `${summary.mttrMinutes}m` : '—'}
          </div>
        </div>
        <div>
          <div className="text-gray-500 text-xs uppercase tracking-widest mb-1">Incidents / Month</div>
          <div className="text-gray-100 font-bold text-lg">{summary.incidentsThisMonth}</div>
        </div>
      </div>
    </div>
  );
};

export default ReliabilityScoreCard;
