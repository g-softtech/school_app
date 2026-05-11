import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, CartesianGrid, Legend, Cell,
} from 'recharts';
import { FiAward, FiAlertCircle, FiTrendingUp, FiTarget, FiBarChart2, FiStar } from 'react-icons/fi';
import api from '../../services/api';
import ChartCard, { CustomTooltip, exportCSV } from '../../components/common/ChartCard';
import PageSkeleton from '../../components/common/PageSkeleton';
import { getErrorMessage } from '../../utils/helpers';

const PASS_GRADES = ['A1','B2','B3','C4','C5','C6'];

function StatTile({ label, value, color, icon: Icon }) {
  return (
    <div className="card text-center">
      {Icon && <Icon size={18} className={`${color} mx-auto mb-1`} />}
      <p className="text-xs text-secondary-500 mb-0.5">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value ?? '—'}</p>
    </div>
  );
}

export default function StudentAnalytics() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const stuRes = await api.get('/students/me');
        const res    = await api.get(`/analytics/student/${stuRes.data.data._id}`);
        setData(res.data.data);
      } catch (err) {
        toast.error(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <PageSkeleton type="dashboard" statCols={6} />;

  const termTrendData = (data?.termTrend || []).map((t) => ({
    name:     `${t.term?.charAt(0).toUpperCase() + t.term?.slice(1)} ${String(t.session || '').slice(-4)}`,
    avg:      t.avgScore,
    passRate: t.passRate,
  }));

  const radarData = (data?.subjectStrengths || []).slice(0, 8).map((s) => ({
    subject: s.subjectName?.split(' ')[0] || '—',
    score:   s.avgScore,
  }));

  const barData = (data?.subjectStrengths || []).map((s) => ({
    name: s.subjectName,
    avg:  s.avgScore,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">My Progress</h1>
        <p className="page-subtitle">Track your academic performance over time</p>
      </div>

      {/* Overview stat tiles */}
      {data?.overall ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatTile label="Overall Avg"  value={`${data.overall.averageScore}%`}   color="text-blue-600"    icon={FiTrendingUp} />
          <StatTile label="Highest"      value={data.overall.highestScore}          color="text-green-600"   icon={FiStar}       />
          <StatTile label="Lowest"       value={data.overall.lowestScore}           color="text-red-500"     icon={FiAlertCircle}/>
          <StatTile label="Total Exams"  value={data.overall.totalExams}            color="text-secondary-800" icon={FiTarget}   />
          <StatTile label="Passed"       value={data.overall.totalPassed}           color="text-green-600"   icon={FiAward}      />
          <StatTile label="Pass Rate"    value={`${data.overall.overallPassRate}%`} color="text-primary-600" icon={FiBarChart2}  />
        </div>
      ) : (
        <div className="card text-center py-8 text-secondary-400">
          <FiBarChart2 size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm font-medium">No results recorded yet</p>
          <p className="text-xs mt-1">Analytics will appear once your results are uploaded</p>
        </div>
      )}

      {/* Best / Worst subject */}
      {data?.bestSubject && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="card flex items-center gap-4 bg-green-50 border border-green-100">
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
              <FiAward className="text-green-600" size={22} />
            </div>
            <div>
              <p className="text-xs text-green-600 font-semibold uppercase tracking-wide">Best Subject</p>
              <p className="font-bold text-secondary-800 mt-0.5">{data.bestSubject.subjectName}</p>
              <p className="text-sm text-green-700 font-semibold">{data.bestSubject.avgScore} avg score</p>
            </div>
          </div>
          {data.worstSubject && data.worstSubject.subjectName !== data.bestSubject?.subjectName && (
            <div className="card flex items-center gap-4 bg-red-50 border border-red-100">
              <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                <FiAlertCircle className="text-red-500" size={22} />
              </div>
              <div>
                <p className="text-xs text-red-500 font-semibold uppercase tracking-wide">Needs Improvement</p>
                <p className="font-bold text-secondary-800 mt-0.5">{data.worstSubject.subjectName}</p>
                <p className="text-sm text-red-600 font-semibold">{data.worstSubject.avgScore} avg score</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Term trend */}
        <ChartCard
          title="Score Trend by Term"
          subtitle="Average score and pass rate across terms"
          isEmpty={termTrendData.length === 0}
          emptyMessage="No term history yet"
          onExport={() => exportCSV(
            termTrendData.map(t => ({ Term: t.name, 'Avg Score': t.avg, 'Pass Rate %': t.passRate })),
            'score-trend'
          )}
        >
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={termTrendData} margin={{ left: -20, right: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" />
              <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="avg"      name="Avg Score"   stroke="#C9A227" strokeWidth={2.5} dot={{ r: 4, fill: '#C9A227' }} />
              <Line type="monotone" dataKey="passRate" name="Pass Rate %"  stroke="#10b981" strokeWidth={2}   dot={{ r: 3 }} strokeDasharray="5 3" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Radar */}
        <ChartCard
          title="Subject Strengths"
          subtitle="Your performance profile across subjects"
          isEmpty={radarData.length === 0}
          emptyMessage="No subject data yet"
        >
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#e2e8f0" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9 }} />
              <Radar name="Score" dataKey="score" stroke="#C9A227" fill="#C9A227" fillOpacity={0.25} strokeWidth={2} />
              <Tooltip content={<CustomTooltip formatter={v => [`${v}`, 'Score']} />} />
            </RadarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Subject bar — full width */}
        <ChartCard
          title="Average Score by Subject"
          subtitle="Your overall performance per subject"
          isEmpty={barData.length === 0}
          emptyMessage="No subject data yet"
          className="lg:col-span-2"
          onExport={() => exportCSV(
            barData.map(b => ({ Subject: b.name, 'Avg Score': b.avg })),
            'subject-averages'
          )}
        >
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={barData} margin={{ left: -20, right: 10, bottom: 45 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
              <Tooltip content={<CustomTooltip formatter={v => [`${v}`, 'Avg Score']} />} />
              <Bar dataKey="avg" name="Avg Score" radius={[4, 4, 0, 0]} maxBarSize={40}>
                {barData.map((entry, i) => (
                  <Cell key={`cell-${i}`} fill={entry.avg >= 50 ? '#10b981' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-secondary-400 mt-2 flex items-center gap-3">
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500 rounded-sm inline-block" /> Pass (≥50)</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-500 rounded-sm inline-block" /> Fail (&lt;50)</span>
          </p>
        </ChartCard>
      </div>
    </div>
  );
}
