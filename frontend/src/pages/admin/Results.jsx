import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { FiUpload, FiSearch, FiFileText, FiEdit2, FiTrash2, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import Modal from '../../components/common/Modal';
import Badge from '../../components/common/Badge';
import { getStudents } from '../../services/studentService';
import { getClasses } from '../../services/classService';
import { getSubjects } from '../../services/subjectService';
import { getClassResults, uploadResult, updateResult, deleteResult } from '../../services/resultService';
import { getErrorMessage } from '../../utils/helpers';
import { generateClassReportCard } from '../../utils/reportCardHelper';
import { TERMS, SESSIONS } from '../../utils/constants';

const GRADE_CONFIG = {
  A1:{ variant:'success', range:[75,100] }, B2:{ variant:'success', range:[70,74] },
  B3:{ variant:'success', range:[65,69] }, C4:{ variant:'info',    range:[60,64] },
  C5:{ variant:'info',    range:[55,59] }, C6:{ variant:'info',    range:[50,54] },
  D7:{ variant:'warning', range:[45,49] }, E8:{ variant:'warning', range:[40,44] },
  F9:{ variant:'danger',  range:[0,39]  },
};

const PASS_GRADES = ['A1','B2','B3','C4','C5','C6'];

function computeGrade(total) {
  for (const [grade, cfg] of Object.entries(GRADE_CONFIG)) {
    if (total >= cfg.range[0] && total <= cfg.range[1]) return grade;
  }
  return 'F9';
}

function computeRemark(grade) {
  const remarks = { A1:'Excellent', B2:'Very Good', B3:'Good', C4:'Credit', C5:'Credit', C6:'Credit', D7:'Pass', E8:'Pass', F9:'Fail' };
  return remarks[grade] || 'Fail';
}

// Single subject row in the bulk upload grid
function SubjectRow({ subject, existingResult, onChange }) {
  const [ca,   setCa]   = useState(existingResult?.ca   ?? '');
  const [exam, setExam] = useState(existingResult?.exam ?? '');

  const ca_num   = Number(ca)   || 0;
  const exam_num = Number(exam) || 0;
  const total    = ca_num + exam_num;
  const grade    = (ca !== '' || exam !== '') ? computeGrade(total) : null;
  const isPassing = grade ? PASS_GRADES.includes(grade) : null;

  useEffect(() => {
    onChange(subject._id, {
      ca:        ca   === '' ? null : Number(ca),
      exam:      exam === '' ? null : Number(exam),
      total:     ca !== '' || exam !== '' ? total : null,
      grade,
      remark:    grade ? computeRemark(grade) : null,
      hasData:   ca !== '' || exam !== '',
      existingId: existingResult?._id,
    });
  }, [ca, exam]);

  return (
    <tr className={`border-t border-secondary-100 ${existingResult ? 'bg-blue-50/30' : ''}`}>
      <td className="px-4 py-2.5 text-sm font-medium text-secondary-800">
        {subject.name}
        {existingResult && (
          <span className="ml-2 text-xs text-blue-500 font-normal">(existing)</span>
        )}
      </td>
      <td className="px-3 py-2">
        <input
          type="number" min="0" max="40"
          value={ca}
          onChange={e => setCa(e.target.value)}
          placeholder="0–40"
          className="input-field py-1.5 text-sm text-center w-20"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="number" min="0" max="60"
          value={exam}
          onChange={e => setExam(e.target.value)}
          placeholder="0–60"
          className="input-field py-1.5 text-sm text-center w-20"
        />
      </td>
      <td className="px-3 py-2 text-center">
        {grade ? (
          <span className={`text-sm font-bold ${isPassing ? 'text-green-600' : 'text-red-500'}`}>
            {total}
          </span>
        ) : <span className="text-secondary-300 text-sm">—</span>}
      </td>
      <td className="px-3 py-2 text-center">
        {grade ? (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isPassing ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
            {grade}
          </span>
        ) : <span className="text-secondary-300 text-sm">—</span>}
      </td>
      <td className="px-3 py-2 text-center">
        {isPassing === true  && <FiCheckCircle size={15} className="text-green-500 mx-auto" />}
        {isPassing === false && <FiAlertCircle size={15} className="text-red-400 mx-auto" />}
      </td>
    </tr>
  );
}

export default function AdminResults() {
  const [classes,    setClasses]    = useState([]);
  const [subjects,   setSubjects]   = useState([]);
  const [results,    setResults]    = useState([]);
  const [students,   setStudents]   = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [classId,    setClassId]    = useState('');
  const [term,       setTerm]       = useState('first');
  const [session,    setSession]    = useState('2025/2026');
  const [showModal,  setShowModal]  = useState(false);
  const [saving,     setSaving]     = useState(false);

  // Bulk upload state
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [subjectData,       setSubjectData]        = useState({}); // { subjectId: { ca, exam, total, grade, hasData } }
  const [existingResults,   setExistingResults]    = useState({}); // { subjectId: resultDoc }

  useEffect(() => {
    Promise.all([
      getClasses({ limit: 100 }),
      getSubjects({ limit: 300 }),
    ]).then(([cr, sr]) => {
      setClasses(cr.data.data || []);
      setSubjects(sr.data.data || []);
    });
  }, []);

  const handleSearch = useCallback(async () => {
    if (!classId || !term || !session) { toast.error('Select class, term and session'); return; }
    setLoading(true);
    try {
      const res = await getClassResults(classId, { term, session, limit: 500 });
      setResults(res.data.data || []);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, [classId, term, session]);

  const openUpload = async () => {
    if (!classId) { toast.error('Please select a class first'); return; }
    const res = await getStudents({ classId, limit: 200 });
    setStudents(res.data.data || []);
    setSelectedStudentId('');
    setSubjectData({});
    setExistingResults({});
    setShowModal(true);
  };

  // When student is selected, load their existing results for this term/session
  const handleStudentSelect = async (stuId) => {
    setSelectedStudentId(stuId);
    setSubjectData({});
    if (!stuId) { setExistingResults({}); return; }
    try {
      const res = await getClassResults(classId, { term, session, studentId: stuId, limit: 100 });
      const map = {};
      (res.data.data || []).forEach(r => {
        const sid = r.subjectId?._id || r.subjectId;
        map[sid] = r;
      });
      setExistingResults(map);
    } catch { setExistingResults({}); }
  };

  const handleSubjectChange = (subjectId, data) => {
    setSubjectData(prev => ({ ...prev, [subjectId]: data }));
  };

  const handleBulkSave = async () => {
    if (!selectedStudentId) { toast.error('Select a student first'); return; }

    const toSave = Object.entries(subjectData).filter(([, d]) => d.hasData);
    if (toSave.length === 0) { toast.error('Enter scores for at least one subject'); return; }

    // Validate scores
    for (const [, d] of toSave) {
      if (d.ca !== null && (d.ca < 0 || d.ca > 40))   { toast.error('CA score must be 0–40'); return; }
      if (d.exam !== null && (d.exam < 0 || d.exam > 60)) { toast.error('Exam score must be 0–60'); return; }
    }

    setSaving(true);
    let saved = 0, failed = 0;
    for (const [subjectId, d] of toSave) {
      try {
        const payload = {
          studentId: selectedStudentId,
          subjectId,
          classId,
          ca:      d.ca   ?? 0,
          exam:    d.exam ?? 0,
          term,
          session,
        };
        if (d.existingId) {
          await updateResult(d.existingId, payload);
        } else {
          await uploadResult(payload);
        }
        saved++;
      } catch { failed++; }
    }

    if (saved > 0)  toast.success(`${saved} result${saved > 1 ? 's' : ''} saved successfully!`);
    if (failed > 0) toast.error(`${failed} result${failed > 1 ? 's' : ''} failed to save`);

    setSaving(false);
    setShowModal(false);
    handleSearch();
  };

  // Subjects for selected class
  const classSubjects = subjects.filter(s =>
    (s.classId?._id || s.classId) === classId
  );

  // Group results by student for display
  const grouped = results.reduce((acc, r) => {
    const sid  = r.studentId?._id || r.studentId;
    const name = r.studentId?.userId?.name || '—';
    const admNo = r.studentId?.admissionNumber || '—';
    if (!acc[sid]) acc[sid] = { sid, name, admNo, results: [] };
    acc[sid].results.push(r);
    return acc;
  }, {});

  const studentSummaries = Object.values(grouped).map(g => {
    const total  = g.results.length;
    const passed = g.results.filter(r => PASS_GRADES.includes(r.grade)).length;
    const avg    = total > 0
      ? (g.results.reduce((s, r) => s + r.total, 0) / total).toFixed(1)
      : 0;
    return { ...g, total, passed, failed: total - passed, avg };
  }).sort((a, b) => Number(b.avg) - Number(a.avg));

  const selectedStudent = students.find(s => s._id === selectedStudentId);

  // Count filled subjects
  const filledCount = Object.values(subjectData).filter(d => d.hasData).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Results Management</h1>
          <p className="page-subtitle">Upload and manage student results by class</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {results.length > 0 && (
            <button
              onClick={() => {
                const cls = classes.find(c => c._id === classId);
                generateClassReportCard({
                  className: cls ? `${cls.name} ${cls.section || ''}`.trim() : 'Class',
                  students: studentSummaries.map(g => ({
                    name: g.name,
                    admissionNumber: g.admNo,
                    results: g.results.map(r => ({
                      subjectName: r.subjectId?.name,
                      ca: r.ca, exam: r.exam, total: r.total, grade: r.grade, remark: r.remark,
                    })),
                  })),
                  term, session,
                });
              }}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <FiFileText size={15} /> Report Cards
            </button>
          )}
          <button onClick={openUpload} className="btn-primary flex items-center gap-2 text-sm">
            <FiUpload size={16} /> Upload Results
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="input-label">Class *</label>
          <select className="input-field py-1.5 text-sm w-40" value={classId} onChange={e => setClassId(e.target.value)}>
            <option value="">— Select —</option>
            {classes.map(c => <option key={c._id} value={c._id}>{c.name} {c.section}</option>)}
          </select>
        </div>
        <div>
          <label className="input-label">Term</label>
          <select className="input-field py-1.5 text-sm w-32" value={term} onChange={e => setTerm(e.target.value)}>
            {TERMS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)} Term</option>)}
          </select>
        </div>
        <div>
          <label className="input-label">Session</label>
          <select className="input-field py-1.5 text-sm w-32" value={session} onChange={e => setSession(e.target.value)}>
            {SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button onClick={handleSearch} disabled={!classId} className="btn-primary py-2 flex items-center gap-2">
          <FiSearch size={15} /> Search
        </button>
      </div>

      {/* Results summary by student */}
      {loading ? (
        <div className="card space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-secondary-50 rounded-xl animate-pulse" />)}
        </div>
      ) : studentSummaries.length === 0 ? (
        <div className="card text-center py-12 text-secondary-400">
          <FiFileText size={32} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">No results found</p>
          <p className="text-xs mt-1">Select a class, term and session then click Search</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="px-5 py-3 bg-secondary-50 border-b border-secondary-100 flex items-center justify-between">
            <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wide">
              {studentSummaries.length} student{studentSummaries.length !== 1 ? 's' : ''} — {term} term {session}
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary-50 border-b border-secondary-100">
                {['#','Student','Adm. No','Subjects','Average','Passed','Failed',''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-50">
              {studentSummaries.map((g, i) => (
                <tr key={g.sid} className="hover:bg-secondary-50 transition-colors">
                  <td className="px-4 py-3 text-secondary-400 text-xs">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-secondary-800">{g.name}</td>
                  <td className="px-4 py-3 text-xs text-secondary-500">{g.admNo}</td>
                  <td className="px-4 py-3 text-center"><Badge variant="info">{g.total}</Badge></td>
                  <td className="px-4 py-3 font-bold text-blue-600">{g.avg}%</td>
                  <td className="px-4 py-3"><Badge variant="success">{g.passed}</Badge></td>
                  <td className="px-4 py-3"><Badge variant={g.failed > 0 ? 'danger' : 'gray'}>{g.failed}</Badge></td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => {
                        // Open upload pre-selected for this student
                        openUpload().then ? null : null;
                        openUpload();
                        setTimeout(() => setSelectedStudentId(g.sid), 300);
                      }}
                      className="text-xs text-primary-500 hover:underline font-medium"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── BULK UPLOAD MODAL ── */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Upload Results" size="xl">
        <div className="space-y-5">
          {/* Step 1: Select student */}
          <div>
            <label className="input-label">Select Student *</label>
            <select
              className="input-field"
              value={selectedStudentId}
              onChange={e => handleStudentSelect(e.target.value)}
            >
              <option value="">— Choose student —</option>
              {students.map(s => (
                <option key={s._id} value={s._id}>
                  {s.userId?.name} ({s.admissionNumber})
                </option>
              ))}
            </select>
          </div>

          {/* Step 2: Term + Session */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Term</label>
              <select className="input-field" value={term} onChange={e => setTerm(e.target.value)}>
                {TERMS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)} Term</option>)}
              </select>
            </div>
            <div>
              <label className="input-label">Session</label>
              <select className="input-field" value={session} onChange={e => setSession(e.target.value)}>
                {SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Step 3: Bulk subject grid */}
          {selectedStudentId && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-secondary-800">
                    {selectedStudent?.userId?.name} — {classSubjects.length} subjects
                  </p>
                  <p className="text-xs text-secondary-400 mt-0.5">
                    Enter CA (max 40) and Exam (max 60) scores. Leave blank to skip a subject.
                    {Object.keys(existingResults).length > 0 && (
                      <span className="text-blue-500 ml-1">
                        · {Object.keys(existingResults).length} existing result(s) pre-filled
                      </span>
                    )}
                  </p>
                </div>
                {filledCount > 0 && (
                  <span className="text-xs bg-primary-50 text-primary-700 px-3 py-1 rounded-full font-semibold">
                    {filledCount} subject{filledCount !== 1 ? 's' : ''} filled
                  </span>
                )}
              </div>

              {classSubjects.length === 0 ? (
                <div className="text-center py-8 text-secondary-400 bg-secondary-50 rounded-xl">
                  <p className="text-sm font-medium">No subjects assigned to this class</p>
                  <p className="text-xs mt-1">Go to Classes & Subjects to assign subjects first</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-secondary-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-secondary-800 text-white">
                        <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase">Subject</th>
                        <th className="text-center px-3 py-2.5 font-semibold text-xs uppercase">CA (0–40)</th>
                        <th className="text-center px-3 py-2.5 font-semibold text-xs uppercase">Exam (0–60)</th>
                        <th className="text-center px-3 py-2.5 font-semibold text-xs uppercase">Total</th>
                        <th className="text-center px-3 py-2.5 font-semibold text-xs uppercase">Grade</th>
                        <th className="text-center px-3 py-2.5 font-semibold text-xs uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classSubjects.map(subject => (
                        <SubjectRow
                          key={subject._id}
                          subject={subject}
                          existingResult={existingResults[subject._id]}
                          onChange={handleSubjectChange}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Summary preview */}
              {filledCount > 0 && (() => {
                const filled = Object.values(subjectData).filter(d => d.hasData);
                const passCount = filled.filter(d => d.grade && PASS_GRADES.includes(d.grade)).length;
                const avg = filled.length > 0
                  ? (filled.reduce((s, d) => s + (d.total || 0), 0) / filled.length).toFixed(1)
                  : 0;
                return (
                  <div className="flex gap-4 p-3 bg-primary-50 rounded-xl border border-primary-100">
                    <div className="text-center">
                      <p className="text-xs text-primary-600 font-medium">Subjects</p>
                      <p className="text-xl font-bold text-primary-700">{filledCount}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-secondary-500 font-medium">Average</p>
                      <p className="text-xl font-bold text-blue-600">{avg}%</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-green-600 font-medium">Passing</p>
                      <p className="text-xl font-bold text-green-600">{passCount}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-red-500 font-medium">Failing</p>
                      <p className="text-xl font-bold text-red-500">{filledCount - passCount}</p>
                    </div>
                  </div>
                );
              })()}
            </>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2 border-t border-secondary-100">
            <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
            <button
              onClick={handleBulkSave}
              disabled={saving || !selectedStudentId || filledCount === 0}
              className="btn-primary flex-1 justify-center"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Saving {filledCount} result{filledCount !== 1 ? 's' : ''}…
                </span>
              ) : (
                `Save ${filledCount > 0 ? filledCount : ''} Result${filledCount !== 1 ? 's' : ''}`
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
