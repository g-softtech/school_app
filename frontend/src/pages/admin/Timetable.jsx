import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { FiGrid, FiSave, FiTrash2, FiPlus, FiX, FiEdit2, FiClock } from 'react-icons/fi';
import { getClasses } from '../../services/classService';
import { getTimetable, saveTimetable, deleteTimetable } from '../../services/academicService';
import api from '../../services/api';
import { TERMS, SESSIONS } from '../../utils/constants';
import { getErrorMessage } from '../../utils/helpers';

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday'];

const DEFAULT_PERIODS = [
  { id: 1, label: 'Period 1', start: '08:00', end: '08:40', isBreak: false },
  { id: 2, label: 'Period 2', start: '08:40', end: '09:20', isBreak: false },
  { id: 3, label: 'Period 3', start: '09:20', end: '10:00', isBreak: false },
  { id: 'break1', label: 'Short Break', start: '10:00', end: '10:20', isBreak: true },
  { id: 4, label: 'Period 4', start: '10:20', end: '11:00', isBreak: false },
  { id: 5, label: 'Period 5', start: '11:00', end: '11:40', isBreak: false },
  { id: 6, label: 'Period 6', start: '11:40', end: '12:20', isBreak: false },
  { id: 'lunch', label: 'Lunch Break', start: '12:20', end: '13:10', isBreak: true },
  { id: 7, label: 'Period 7', start: '13:10', end: '13:50', isBreak: false },
  { id: 8, label: 'Period 8', start: '13:50', end: '14:30', isBreak: false },
];

const SUBJECT_COLORS = [
  '#C9A227','#1F2937','#10b981','#3b82f6','#8b5cf6',
  '#f59e0b','#ef4444','#06b6d4','#ec4899','#84cc16',
];

// ── Period Config Editor ────────────────────────────────────────────────────
function PeriodConfigPanel({ periods, onChange }) {
  const addPeriod = () => {
    const nums = periods.filter(p => !p.isBreak).length + 1;
    onChange([...periods, { id: Date.now(), label: `Period ${nums}`, start: '', end: '', isBreak: false }]);
  };
  const addBreak = () => {
    onChange([...periods, { id: Date.now(), label: 'Break', start: '', end: '', isBreak: true }]);
  };
  const update = (idx, field, val) => {
    const updated = [...periods];
    updated[idx] = { ...updated[idx], [field]: val };
    onChange(updated);
  };
  const remove = (idx) => onChange(periods.filter((_, i) => i !== idx));
  const moveUp = (idx) => {
    if (idx === 0) return;
    const arr = [...periods];
    [arr[idx-1], arr[idx]] = [arr[idx], arr[idx-1]];
    onChange(arr);
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wide mb-2">
        Period Configuration — edit times, labels, add/remove periods and breaks
      </p>
      {periods.map((p, i) => (
        <div key={p.id} className={`flex items-center gap-2 p-2.5 rounded-xl border ${p.isBreak ? 'bg-amber-50 border-amber-200' : 'bg-secondary-50 border-secondary-200'}`}>
          <button onClick={() => moveUp(i)} className="text-secondary-400 hover:text-secondary-600 text-xs px-1" title="Move up">↑</button>
          <input
            value={p.label}
            onChange={(e) => update(i, 'label', e.target.value)}
            className="input-field py-1 text-xs w-28 flex-shrink-0"
            placeholder="Label"
          />
          <input type="time" value={p.start} onChange={(e) => update(i, 'start', e.target.value)} className="input-field py-1 text-xs w-24 flex-shrink-0" />
          <span className="text-secondary-400 text-xs flex-shrink-0">→</span>
          <input type="time" value={p.end} onChange={(e) => update(i, 'end', e.target.value)} className="input-field py-1 text-xs w-24 flex-shrink-0" />
          <label className="flex items-center gap-1 text-xs text-secondary-500 flex-shrink-0">
            <input type="checkbox" checked={p.isBreak} onChange={(e) => update(i, 'isBreak', e.target.checked)} className="w-3.5 h-3.5 accent-amber-500" />
            Break
          </label>
          <button onClick={() => remove(i)} className="ml-auto p-1 hover:bg-red-50 rounded text-red-400"><FiX size={12} /></button>
        </div>
      ))}
      <div className="flex gap-2 pt-1">
        <button onClick={addPeriod} className="flex items-center gap-1.5 text-xs bg-secondary-100 hover:bg-secondary-200 text-secondary-700 px-3 py-1.5 rounded-lg transition-colors">
          <FiPlus size={12} /> Add Period
        </button>
        <button onClick={addBreak} className="flex items-center gap-1.5 text-xs bg-amber-100 hover:bg-amber-200 text-amber-700 px-3 py-1.5 rounded-lg transition-colors">
          <FiPlus size={12} /> Add Break
        </button>
      </div>
    </div>
  );
}

// ── Cell Editor popover ─────────────────────────────────────────────────────
function CellEditor({ initial, subjects, teachers, onSave, onClear, onCancel }) {
  const [subjectId, setSubjectId] = useState(initial?.subjectId || '');
  const [teacherId, setTeacherId] = useState(initial?.teacherId || '');
  const [label,     setLabel]     = useState(initial?.label     || '');
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-secondary-700">Edit Cell</p>
        <button onClick={onCancel} className="text-secondary-400 hover:text-secondary-600"><FiX size={13} /></button>
      </div>
      <div>
        <label className="text-[10px] font-semibold text-secondary-500 uppercase">Subject</label>
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="input-field py-1 text-xs w-full mt-0.5">
          <option value="">— None —</option>
          {subjects.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
        </select>
      </div>
      <div>
        <label className="text-[10px] font-semibold text-secondary-500 uppercase">Teacher</label>
        <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className="input-field py-1 text-xs w-full mt-0.5">
          <option value="">— None —</option>
          {teachers.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
        </select>
      </div>
      <div>
        <label className="text-[10px] font-semibold text-secondary-500 uppercase">Custom Label</label>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Assembly, Games" className="input-field py-1 text-xs w-full mt-0.5" />
      </div>
      <div className="flex gap-1.5 pt-1">
        <button onClick={() => onSave({ subjectId, teacherId, label })} className="flex-1 min-w-0 bg-primary-500 hover:bg-primary-600 text-white text-xs py-1.5 rounded-lg font-medium transition-colors">Save</button>
        {initial && <button onClick={onClear} className="px-2 bg-red-50 hover:bg-red-100 text-red-500 text-xs py-1.5 rounded-lg"><FiTrash2 size={12} /></button>}
        <button onClick={onCancel} className="px-2 bg-secondary-100 hover:bg-secondary-200 text-secondary-600 text-xs py-1.5 rounded-lg"><FiX size={12} /></button>
      </div>
    </div>
  );
}

// ── Main Timetable Page ─────────────────────────────────────────────────────
export default function AdminTimetable() {
  const [classes,      setClasses]      = useState([]);
  const [subjects,     setSubjects]     = useState([]);
  const [teachers,     setTeachers]     = useState([]);
  const [classId,      setClassId]      = useState('');
  const [term,         setTerm]         = useState('first');
  const [session,      setSession]      = useState('2025/2026');
  const [grid,         setGrid]         = useState({});
  const [timetableId,  setTimetableId]  = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [editCell,     setEditCell]     = useState(null);
  const [showConfig,   setShowConfig]   = useState(false);
  const [periods,      setPeriods]      = useState(DEFAULT_PERIODS);
  const [subjectColorMap, setSubjectColorMap] = useState({});

  useEffect(() => {
    Promise.all([
      getClasses({ limit: 100 }),
      api.get('/subjects', { params: { limit: 200 } }),
      api.get('/users/directory', { params: { role: 'teacher', limit: 200 } }),
    ]).then(([cl, sub, tr]) => {
      setClasses(cl.data.data || []);
      setSubjects(sub.data.data || []);
      setTeachers(tr.data.data || []);
      const map = {};
      (sub.data.data || []).forEach((s, i) => { map[s._id] = SUBJECT_COLORS[i % SUBJECT_COLORS.length]; });
      setSubjectColorMap(map);
    }).catch(() => {});
  }, []);

  const loadTimetable = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    try {
      const res = await getTimetable({ classId, session, term });
      const tt  = res.data.data;
      if (tt) {
        setTimetableId(tt._id);
        const g = {};
        tt.periods.forEach((p) => {
          if (!p.isBreak) {
            const key = `${p.day}-${p.period}`;
            g[key] = { subjectId: p.subjectId?._id || p.subjectId || '', teacherId: p.teacherId?._id || p.teacherId || '', label: p.label || '' };
          }
        });
        setGrid(g);
        // Restore saved period config if available
        if (tt.periodConfig) setPeriods(tt.periodConfig);
      } else {
        setTimetableId(null); setGrid({});
        setPeriods(DEFAULT_PERIODS);
      }
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, [classId, session, term]);

  useEffect(() => { loadTimetable(); }, [loadTimetable]);

  const getCell = (day, periodId) => grid[`${day}-${periodId}`] || null;
  const updateCell = (day, periodId, data) => { setGrid((prev) => ({ ...prev, [`${day}-${periodId}`]: data })); setEditCell(null); };
  const clearCell  = (day, periodId) => { setGrid((prev) => { const g = { ...prev }; delete g[`${day}-${periodId}`]; return g; }); setEditCell(null); };

  const handleSave = async () => {
    if (!classId) { toast.error('Select a class first'); return; }
    setSaving(true);
    try {
      const periodsPayload = [];
      periods.filter(p => !p.isBreak).forEach((p) => {
        DAYS.forEach((day) => {
          const cell = grid[`${day}-${p.id}`];
          if (cell) {
            periodsPayload.push({
              day, period: p.id,
              startTime: p.start || '', endTime: p.end || '',
              subjectId: cell.subjectId || null,
              teacherId: cell.teacherId || null,
              label:     cell.label     || null,
            });
          }
        });
      });
      await saveTimetable({ classId, academicSession: session, term, periods: periodsPayload, periodConfig: periods });
      toast.success('Timetable saved!');
      loadTimetable();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!timetableId || !window.confirm('Delete this timetable?')) return;
    try { await deleteTimetable(timetableId); toast.success('Deleted'); setGrid({}); setTimetableId(null); setPeriods(DEFAULT_PERIODS); }
    catch (err) { toast.error(getErrorMessage(err)); }
  };

  const classSubjects = subjects.filter((s) => (s.classId?._id || s.classId) === classId);
  const activePeriods = periods.filter(p => !p.isBreak);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2"><FiGrid className="text-primary-500" size={22} /> Timetable</h1>
          <p className="page-subtitle">Build and manage weekly class timetables</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowConfig(!showConfig)} className="btn-secondary flex items-center gap-2 text-sm">
            <FiClock size={14} /> {showConfig ? 'Hide' : 'Edit'} Periods
          </button>
          {timetableId && (
            <button onClick={handleDelete} className="btn-secondary flex items-center gap-2 text-sm text-red-500 hover:bg-red-50 border-red-200">
              <FiTrash2 size={14} /> Delete
            </button>
          )}
          <button onClick={handleSave} disabled={!classId || saving} className="btn-primary flex items-center gap-2">
            <FiSave size={15} /> {saving ? 'Saving…' : 'Save Timetable'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <select value={classId} onChange={(e) => setClassId(e.target.value)} className="input-field py-1.5 text-sm w-44">
          <option value="">Select class…</option>
          {classes.map((c) => <option key={c._id} value={c._id}>{c.name} {c.section}</option>)}
        </select>
        <select value={term} onChange={(e) => setTerm(e.target.value)} className="input-field py-1.5 text-sm w-32">
          {TERMS.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)} Term</option>)}
        </select>
        <select value={session} onChange={(e) => setSession(e.target.value)} className="input-field py-1.5 text-sm w-32">
          {SESSIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {timetableId && (
          <span className="inline-flex items-center gap-1.5 text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-xl font-medium border border-green-100">✓ Timetable loaded</span>
        )}
      </div>

      {/* Period config panel */}
      {showConfig && (
        <div className="card">
          <PeriodConfigPanel periods={periods} onChange={setPeriods} />
        </div>
      )}

      {!classId ? (
        <div className="card text-center py-16 text-secondary-400">
          <FiGrid size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Select a class to view or build its timetable</p>
        </div>
      ) : loading ? (
        <div className="card animate-pulse h-64" />
      ) : (
        <>
          {/* Subject legend */}
          {classSubjects.length > 0 && (
            <div className="card p-4">
              <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wide mb-2">Subjects — click cell to assign</p>
              <div className="flex flex-wrap gap-2">
                {classSubjects.map((s) => (
                  <span key={s._id} className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full text-white font-medium" style={{ backgroundColor: subjectColorMap[s._id] || '#94a3b8' }}>
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Timetable grid */}
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
                        const cell  = getCell(day, p.id);
                        const subj  = cell?.subjectId ? subjects.find((s) => s._id === cell.subjectId) : null;
                        const tchr  = cell?.teacherId ? teachers.find((t) => t._id === cell.teacherId) : null;
                        const color = subj ? (subjectColorMap[subj._id] || '#94a3b8') : null;
                        const key   = `${day}-${p.id}`;
                        const isEd  = editCell === key;
                        return (
                          <td key={day} className="px-2 py-1.5 text-center relative min-w-24">
                            {isEd ? (
                              <div className="absolute z-20 top-0 left-0 bg-white border border-secondary-200 rounded-xl shadow-xl p-3 w-52 text-left">
                                <CellEditor
                                  initial={cell}
                                  subjects={classSubjects}
                                  teachers={teachers}
                                  onSave={(data) => updateCell(day, p.id, data)}
                                  onClear={() => clearCell(day, p.id)}
                                  onCancel={() => setEditCell(null)}
                                />
                              </div>
                            ) : cell ? (
                              <div onClick={() => setEditCell(key)} className="rounded-lg px-2 py-1.5 cursor-pointer hover:opacity-85 transition-opacity text-white" style={{ backgroundColor: color || '#94a3b8' }}>
                                <p className="font-semibold truncate">{subj?.name || cell.label || '—'}</p>
                                {tchr && <p className="text-[10px] opacity-80 truncate">{tchr.name}</p>}
                              </div>
                            ) : (
                              <button onClick={() => setEditCell(key)} className="w-full h-10 border-2 border-dashed border-secondary-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-all flex items-center justify-center text-secondary-300 hover:text-primary-500">
                                <FiPlus size={14} />
                              </button>
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
          <p className="text-xs text-secondary-400 text-center">Click any cell to assign a subject · Click "Edit Periods" to customise time slots · Save when done</p>
        </>
      )}
    </div>
  );
}
