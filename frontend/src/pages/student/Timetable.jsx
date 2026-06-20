import { useState, useEffect, useCallback } from 'react';
import { FiGrid } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../../services/api';
import { getTimetable } from '../../services/academicService';
import { TERMS, SESSIONS } from '../../utils/constants';
import { getErrorMessage } from '../../utils/helpers';
import PageSkeleton from '../../components/common/PageSkeleton';

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
const SUBJECT_COLORS = [
  '#C9A227','#1F2937','#10b981','#3b82f6','#8b5cf6',
  '#f59e0b','#ef4444','#06b6d4','#ec4899','#84cc16',
];

export default function StudentTimetable() {
  const [student, setStudent]     = useState(null);
  const [timetable, setTimetable] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [term, setTerm]           = useState('first');
  const [session, setSession]     = useState('2025/2026');

  useEffect(() => {
    async function loadStudent() {
      try {
        const res = await api.get('/students/me');
        setStudent(res.data.data);
      } catch (err) {
        toast.error('Failed to load profile');
      }
    }
    loadStudent();
  }, []);

  const fetchTimetable = useCallback(async () => {
    if (!student || !student.classId) return;
    setLoading(true);
    try {
      const ttRes = await getTimetable({ classId: student.classId._id || student.classId, session, term });
      setTimetable(ttRes.data.data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [student, session, term]);

  useEffect(() => { fetchTimetable(); }, [fetchTimetable]);

  if (!student && loading) return <PageSkeleton type="dashboard" statCols={4} />;

  const subjectColorMap = {};
  if (timetable?.periods) {
    const uniqueSubjects = [...new Set(timetable.periods.map(p => p.subjectId?._id || p.subjectId).filter(Boolean))];
    uniqueSubjects.forEach((s, i) => { subjectColorMap[s] = SUBJECT_COLORS[i % SUBJECT_COLORS.length]; });
  }

  const periods = timetable?.periodConfig || [];
  const grid = {};
  if (timetable) {
    timetable.periods.forEach((p) => {
      if (!p.isBreak) {
        const key = `${p.day}-${p.period}`;
        grid[key] = { subjectId: p.subjectId?._id || p.subjectId || '', teacherId: p.teacherId?._id || p.teacherId || '', label: p.label || '', subjectName: p.subjectId?.name || '', teacherName: p.teacherId?.name || '' };
      }
    });
  }

  const getCell = (day, periodId) => grid[`${day}-${periodId}`] || null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2"><FiGrid className="text-primary-500" size={22} /> Class Timetable</h1>
          <p className="page-subtitle">View your weekly schedule</p>
        </div>
        <div className="flex gap-2">
          <select value={term} onChange={(e) => setTerm(e.target.value)} className="input-field py-1.5 text-sm w-32">
            {TERMS.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)} Term</option>)}
          </select>
          <select value={session} onChange={(e) => setSession(e.target.value)} className="input-field py-1.5 text-sm w-32">
            {SESSIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="card animate-pulse h-64" />
      ) : !timetable ? (
        <div className="card text-center py-16 text-secondary-400">
          <FiGrid size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No timetable has been published for your class this term.</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0 max-w-[100vw]">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-xs min-w-[600px]">
            <thead>
              <tr className="bg-secondary-800 text-white">
                <th className="px-3 py-3 text-left font-semibold w-28">Period</th>
                <th className="px-3 py-3 text-left font-semibold w-24">Time</th>
                {DAYS.map((d) => (
                  <th key={d} className="px-3 py-3 text-center font-semibold">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => {
                if (p.isBreak) {
                  return (
                    <tr key={p.id} className="bg-amber-50">
                      <td className="px-3 py-2 font-medium text-amber-700">{p.label}</td>
                      <td className="px-3 py-2 text-amber-600 text-[10px]">{p.start} – {p.end}</td>
                      <td colSpan={5} className="px-4 py-2 text-center text-xs text-amber-600 italic">— {p.label} —</td>
                    </tr>
                  );
                }
                return (
                  <tr key={p.id} className="border-t border-secondary-100 hover:bg-secondary-50/50">
                    <td className="px-3 py-2 font-semibold text-secondary-700">{p.label}</td>
                    <td className="px-3 py-2 text-secondary-500 whitespace-nowrap text-[10px]">{p.start} – {p.end}</td>
                    {DAYS.map((day) => {
                      const cell = getCell(day, p.id);
                      const color = cell?.subjectId ? (subjectColorMap[cell.subjectId] || '#94a3b8') : null;
                      return (
                        <td key={day} className="px-2 py-1.5 text-center relative min-w-24 border-l border-secondary-50">
                          {cell ? (
                            <div className="rounded-lg px-2 py-1.5 text-white shadow-sm" style={{ backgroundColor: color || '#94a3b8' }}>
                              <p className="font-semibold truncate">{cell.subjectName || cell.label || '—'}</p>
                              {cell.teacherName && <p className="text-[10px] opacity-80 truncate">{cell.teacherName}</p>}
                            </div>
                          ) : (
                            <div className="w-full h-10 border border-dashed border-secondary-200 rounded-lg flex items-center justify-center text-secondary-300">
                              <span className="text-[10px]">—</span>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}
