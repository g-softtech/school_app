import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { FiArrowRight, FiUsers, FiCheckSquare, FiSquare, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';
import { getClasses } from '../../services/classService';
import { promoteStudents } from '../../services/academicService';
import api from '../../services/api';
import PageSkeleton from '../../components/common/PageSkeleton';
import { getErrorMessage } from '../../utils/helpers';

export default function AdminPromote() {
  const [classes,    setClasses]    = useState([]);
  const [fromClass,  setFromClass]  = useState('');
  const [toClass,    setToClass]    = useState('');
  const [students,   setStudents]   = useState([]);
  const [selected,   setSelected]   = useState([]); // selected student _ids
  const [loading,    setLoading]    = useState(false);
  const [loadingStu, setLoadingStu] = useState(false);
  const [result,     setResult]     = useState(null); // success result
  const [promoting,  setPromoting]  = useState(false);
  const [step,       setStep]       = useState(1); // 1=select classes, 2=select students, 3=confirm, 4=done

  useEffect(() => {
    getClasses({ limit: 100 })
      .then((r) => setClasses(r.data.data || []))
      .catch(() => {});
  }, []);

  // Load students when fromClass changes
  useEffect(() => {
    if (!fromClass) { setStudents([]); setSelected([]); return; }
    setLoadingStu(true);
    api.get('/students', { params: { classId: fromClass, limit: 200, isActive: true } })
      .then((r) => {
        setStudents(r.data.data || []);
        setSelected((r.data.data || []).map((s) => s._id)); // select all by default
      })
      .catch(() => {})
      .finally(() => setLoadingStu(false));
  }, [fromClass]);

  const toggleStudent = (id) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    setSelected(selected.length === students.length ? [] : students.map((s) => s._id));
  };

  const handlePromote = async () => {
    if (!fromClass || !toClass)       { toast.error('Please select both classes'); return; }
    if (selected.length === 0)        { toast.error('No students selected'); return; }
    if (fromClass === toClass)        { toast.error('Source and destination cannot be the same'); return; }
    setPromoting(true);
    try {
      const res = await promoteStudents({ fromClassId: fromClass, toClassId: toClass, studentIds: selected });
      setResult(res.data.data);
      setStep(4);
      toast.success(res.data.message);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally { setPromoting(false); }
  };

  const reset = () => {
    setFromClass(''); setToClass(''); setStudents([]);
    setSelected([]); setResult(null); setStep(1);
  };

  const fromClassObj = classes.find((c) => c._id === fromClass);
  const toClassObj   = classes.find((c) => c._id === toClass);

  const STEPS = [
    { n: 1, label: 'Select Classes' },
    { n: 2, label: 'Select Students' },
    { n: 3, label: 'Confirm' },
    { n: 4, label: 'Done' },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <FiArrowRight className="text-primary-500" size={22} /> Class Promotion
        </h1>
        <p className="page-subtitle">Bulk promote students from one class to the next</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => (
          <div key={s.n} className="flex items-center flex-1">
            <div className={`flex items-center gap-2 ${i > 0 ? 'flex-1' : ''}`}>
              {i > 0 && <div className={`h-0.5 flex-1 ${step > i ? 'bg-primary-500' : 'bg-secondary-200'}`} />}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${
                step > s.n ? 'bg-primary-500 text-white' :
                step === s.n ? 'bg-primary-500 text-white ring-4 ring-primary-100' :
                'bg-secondary-200 text-secondary-500'
              }`}>
                {step > s.n ? '✓' : s.n}
              </div>
            </div>
            {i < STEPS.length - 1 && <div className={`h-0.5 flex-1 ${step > s.n ? 'bg-primary-500' : 'bg-secondary-200'}`} />}
          </div>
        ))}
      </div>
      <div className="flex justify-between -mt-2">
        {STEPS.map((s) => (
          <p key={s.n} className={`text-xs font-medium ${step === s.n ? 'text-primary-600' : 'text-secondary-400'}`}>{s.label}</p>
        ))}
      </div>

      {/* Step 1 — Select classes */}
      {step === 1 && (
        <div className="card space-y-5">
          <h2 className="font-semibold text-secondary-800">Select Source and Destination Classes</h2>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 flex gap-2">
            <FiAlertCircle size={14} className="flex-shrink-0 mt-0.5" />
            <p>This moves students permanently from one class to another. It is typically done at the end of each academic session. This action can be reversed by promoting them back.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="input-label">From Class (current class) *</label>
              <select value={fromClass} onChange={(e) => { setFromClass(e.target.value); setStep(1); }} className="input-field">
                <option value="">Select class…</option>
                {classes.map((c) => <option key={c._id} value={c._id}>{c.name} {c.section} ({c.studentCount ?? 0} students)</option>)}
              </select>
            </div>
            <div>
              <label className="input-label">To Class (destination) *</label>
              <select value={toClass} onChange={(e) => setToClass(e.target.value)} className="input-field">
                <option value="">Select class…</option>
                {classes.filter((c) => c._id !== fromClass).map((c) => (
                  <option key={c._id} value={c._id}>{c.name} {c.section}</option>
                ))}
              </select>
            </div>
          </div>
          {fromClass && toClass && (
            <div className="flex items-center gap-3 p-3 bg-secondary-50 rounded-xl">
              <span className="font-semibold text-secondary-800">{fromClassObj?.name} {fromClassObj?.section}</span>
              <FiArrowRight className="text-primary-500" size={20} />
              <span className="font-semibold text-secondary-800">{toClassObj?.name} {toClassObj?.section}</span>
            </div>
          )}
          <button onClick={() => setStep(2)} disabled={!fromClass || !toClass} className="btn-primary w-full">
            Next: Select Students →
          </button>
        </div>
      )}

      {/* Step 2 — Select students */}
      {step === 2 && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-secondary-800">
              Students in {fromClassObj?.name} {fromClassObj?.section}
            </h2>
            <button onClick={toggleAll} className="text-xs text-primary-500 hover:underline flex items-center gap-1.5">
              {selected.length === students.length ? <FiCheckSquare size={13} /> : <FiSquare size={13} />}
              {selected.length === students.length ? 'Deselect all' : 'Select all'}
            </button>
          </div>

          {loadingStu ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-secondary-50 rounded-xl animate-pulse" />)}</div>
          ) : students.length === 0 ? (
            <div className="text-center py-10 text-secondary-400">
              <FiUsers size={28} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No active students in this class</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {students.map((stu) => {
                const isSelected = selected.includes(stu._id);
                return (
                  <div key={stu._id}
                    onClick={() => toggleStudent(stu._id)}
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${isSelected ? 'bg-primary-50 border-primary-200' : 'bg-secondary-50 border-secondary-100 hover:border-secondary-300'}`}>
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${isSelected ? 'bg-primary-500 border-primary-500' : 'border-secondary-300'}`}>
                      {isSelected && <span className="text-white text-xs">✓</span>}
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-secondary-200 flex items-center justify-center text-xs font-bold text-secondary-600 flex-shrink-0">
                      {stu.userId?.name?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-secondary-800 truncate">{stu.userId?.name || '—'}</p>
                      <p className="text-xs text-secondary-400">{stu.admissionNumber}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-xs text-secondary-500 text-right">{selected.length} of {students.length} selected</p>
          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="btn-secondary flex-1">← Back</button>
            <button onClick={() => setStep(3)} disabled={selected.length === 0} className="btn-primary flex-1">
              Next: Confirm →
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Confirm */}
      {step === 3 && (
        <div className="card space-y-5">
          <h2 className="font-semibold text-secondary-800">Confirm Promotion</h2>

          <div className="p-4 bg-secondary-50 rounded-xl space-y-3 border border-secondary-200">
            <div className="flex items-center gap-3">
              <div className="flex-1 p-3 bg-white rounded-xl border border-secondary-200 text-center">
                <p className="text-xs text-secondary-500">From</p>
                <p className="font-bold text-secondary-800">{fromClassObj?.name} {fromClassObj?.section}</p>
              </div>
              <FiArrowRight size={24} className="text-primary-500 flex-shrink-0" />
              <div className="flex-1 p-3 bg-white rounded-xl border border-secondary-200 text-center">
                <p className="text-xs text-secondary-500">To</p>
                <p className="font-bold text-secondary-800">{toClassObj?.name} {toClassObj?.section}</p>
              </div>
            </div>
            <div className="text-center p-3 bg-primary-50 rounded-xl border border-primary-100">
              <p className="text-2xl font-bold text-primary-600">{selected.length}</p>
              <p className="text-xs text-primary-700">student{selected.length !== 1 ? 's' : ''} will be promoted</p>
            </div>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 flex gap-2">
            <FiAlertCircle size={14} className="flex-shrink-0 mt-0.5" />
            <p>Once confirmed, the selected students will be moved to <strong>{toClassObj?.name} {toClassObj?.section}</strong>. Their results, assignments and lesson notes history will not be affected.</p>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="btn-secondary flex-1">← Back</button>
            <button onClick={handlePromote} disabled={promoting} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {promoting ? (
                <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Promoting…</>
              ) : (
                <><FiArrowRight size={15} /> Confirm Promotion</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 4 — Done */}
      {step === 4 && result && (
        <div className="card text-center space-y-5 py-8">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <FiCheckCircle className="text-green-600" size={36} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-secondary-800">Promotion Successful!</h2>
            <p className="text-secondary-500 mt-2 text-sm">
              <strong className="text-green-600">{result.promoted}</strong> student{result.promoted !== 1 ? 's' : ''} successfully moved from{' '}
              <strong>{result.fromClass}</strong> to <strong>{result.toClass}</strong>.
            </p>
          </div>
          <button onClick={reset} className="btn-primary mx-auto">
            Promote Another Class
          </button>
        </div>
      )}
    </div>
  );
}
