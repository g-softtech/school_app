import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { FiUpload, FiSearch, FiFileText, FiCheckCircle, FiAlertCircle, FiEye } from 'react-icons/fi';
import Modal from '../../components/common/Modal';
import Badge from '../../components/common/Badge';
import ReportCard from '../../components/common/ReportCard';
import { getStudents } from '../../services/studentService';
import { getClasses } from '../../services/classService';
import { getSubjects } from '../../services/subjectService';
import { getClassResults, uploadResult, updateResult, getStudentResults } from '../../services/resultService';
import { getErrorMessage } from '../../utils/helpers';
import { generateClassReportCard } from '../../utils/reportCardHelper';
import { TERMS, SESSIONS } from '../../utils/constants';

const GRADE_CSS = {
  A1:'bg-green-100 text-green-700', B2:'bg-green-100 text-green-700',
  B3:'bg-green-100 text-green-700', C4:'bg-blue-100 text-blue-700',
  C5:'bg-blue-100 text-blue-700',   C6:'bg-blue-100 text-blue-700',
  D7:'bg-amber-100 text-amber-700', E8:'bg-amber-100 text-amber-700',
  F9:'bg-red-100 text-red-600',
};
const PASS_GRADES = ['A1','B2','B3','C4','C5','C6'];

function computeGrade(total) {
  if (total >= 75) return 'A1'; if (total >= 70) return 'B2';
  if (total >= 65) return 'B3'; if (total >= 60) return 'C4';
  if (total >= 55) return 'C5'; if (total >= 50) return 'C6';
  if (total >= 45) return 'D7'; if (total >= 40) return 'E8';
  return 'F9';
}
function computeRemark(g) {
  return { A1:'Excellent',B2:'Very Good',B3:'Good',C4:'Credit',C5:'Credit',
           C6:'Credit',D7:'Pass',E8:'Pass',F9:'Fail' }[g] || 'Fail';
}

// ── Extract student name/admNo from a result doc regardless of populate depth ──
function extractStudentInfo(r) {
  const stu = r.studentId;
  if (!stu) return { name: '—', admNo: '—', sid: String(r._id) };

  // Deeply populated: { _id, admissionNumber, userId: { name } }
  const name  = stu.userId?.name
             || stu.name          // sometimes flattened
             || '—';
  const admNo = stu.admissionNumber || '—';
  const sid   = String(stu._id || stu);
  return { name, admNo, sid };
}

// ── SubjectRow — one row per subject in the bulk upload grid ─────────────────
function SubjectRow({ subject, existingResult, onChange }) {
  const [ca,   setCa]   = useState(existingResult?.ca   ?? '');
  const [exam, setExam] = useState(existingResult?.exam ?? '');

  const caNum   = ca   !== '' ? Number(ca)   : null;
  const examNum = exam !== '' ? Number(exam) : null;
  const hasData = ca !== '' || exam !== '';
  const total   = hasData ? (caNum || 0) + (examNum || 0) : null;
  const grade   = total !== null ? computeGrade(total) : null;
  const passing = grade ? PASS_GRADES.includes(grade) : null;

  useEffect(() => {
    onChange(subject._id, {
      ca: caNum, exam: examNum, total, grade,
      remark: grade ? computeRemark(grade) : null,
      hasData, existingId: existingResult?._id,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ca, exam]);

  return (
    <tr className={`border-t border-secondary-100 ${existingResult ? 'bg-blue-50/30' : ''}`}>
      <td className="px-4 py-2.5 text-sm font-medium text-secondary-800">
        {subject.name}
        {existingResult && <span className="ml-2 text-xs text-blue-500">(existing)</span>}
      </td>
      <td className="px-3 py-2">
        <input type="number" min="0" max="40" value={ca}
          onChange={e => setCa(e.target.value)}
          placeholder="0–40" className="input-field py-1.5 text-sm text-center w-20" />
      </td>
      <td className="px-3 py-2">
        <input type="number" min="0" max="60" value={exam}
          onChange={e => setExam(e.target.value)}
          placeholder="0–60" className="input-field py-1.5 text-sm text-center w-20" />
      </td>
      <td className="px-3 py-2 text-center font-bold text-sm text-secondary-800">
        {total !== null ? total : <span className="text-secondary-300">—</span>}
      </td>
      <td className="px-3 py-2 text-center">
        {grade
          ? <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${GRADE_CSS[grade]}`}>{grade}</span>
          : <span className="text-secondary-300 text-sm">—</span>}
      </td>
      <td className="px-3 py-2 text-center">
        {passing === true  && <FiCheckCircle size={15} className="text-green-500 mx-auto" />}
        {passing === false && <FiAlertCircle size={15} className="text-red-400 mx-auto" />}
      </td>
    </tr>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AdminResults() {
  const [classes,           setClasses]           = useState([]);
  const [subjects,          setSubjects]          = useState([]);
  const [results,           setResults]           = useState([]);
  const [students,          setStudents]          = useState([]);
  const [loading,           setLoading]           = useState(false);
  const [classId,           setClassId]           = useState('');
  const [term,              setTerm]              = useState('first');
  const [session,           setSession]           = useState('2025/2026');
  const [search,            setSearch]            = useState('');
  const [showModal,         setShowModal]         = useState(false);
  const [saving,            setSaving]            = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [subjectData,       setSubjectData]       = useState({});
  const [existingResults,   setExistingResults]   = useState({});

  // Report card modal state
  const [rcStudent,   setRcStudent]   = useState(null);
  const [rcResults,   setRcResults]   = useState([]);
  const [rcSummary,   setRcSummary]   = useState(null);
  const [rcLoading,   setRcLoading]   = useState(false);
  const [showRcModal, setShowRcModal] = useState(false);

  useEffect(() => {
    Promise.all([
      getClasses({ limit: 100 }),
      getSubjects({ limit: 300 }),
    ]).then(([cr, sr]) => {
      setClasses(cr.data.data || []);
      setSubjects(sr.data.data || []);
    }).catch(() => {});
  }, []);

  const handleSearch = useCallback(async () => {
    if (!classId) { toast.error('Select a class first'); return; }
    setLoading(true);
    try {
      const res = await getClassResults(classId, { term, session, limit: 500 });
      setResults(res.data.data || []);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, [classId, term, session]);

  const openUpload = async () => {
    if (!classId) { toast.error('Select a class first'); return; }
    try {
      const res = await getStudents({ classId, limit: 200 });
      setStudents(res.data.data || []);
    } catch {}
    setSelectedStudentId('');
    setSubjectData({});
    setExistingResults({});
    setShowModal(true);
  };

  const handleStudentSelect = async (stuId) => {
    setSelectedStudentId(stuId);
    setSubjectData({});
    if (!stuId) { setExistingResults({}); return; }
    try {
      const res = await getClassResults(classId, { term, session, limit: 100 });
      const map = {};
      (res.data.data || [])
        .filter(r => String(r.studentId?._id || r.studentId) === String(stuId))
        .forEach(r => {
          const subId = String(r.subjectId?._id || r.subjectId);
          map[subId] = r;
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

    for (const [, d] of toSave) {
      if (d.ca   !== null && (d.ca   < 0 || d.ca   > 40)) { toast.error('CA must be 0–40');   return; }
      if (d.exam !== null && (d.exam < 0 || d.exam > 60)) { toast.error('Exam must be 0–60'); return; }
    }

    setSaving(true);
    let saved = 0, failed = 0;
    for (const [subjectId, d] of toSave) {
      try {
        const payload = {
          studentId: selectedStudentId, subjectId, classId,
          ca: d.ca ?? 0, exam: d.exam ?? 0, term, session,
        };
        if (d.existingId) await updateResult(d.existingId, payload);
        else              await uploadResult(payload);
        saved++;
      } catch { failed++; }
    }
    if (saved  > 0) toast.success(`${saved} result${saved > 1 ? 's' : ''} saved!`);
    if (failed > 0) toast.error(`${failed} failed to save`);
    setSaving(false);
    setShowModal(false);
    handleSearch();
  };

  const openReportCard = async (studentId, studentName) => {
    setRcStudent({ id: studentId, name: studentName });
    setRcResults([]);
    setRcSummary(null);
    setRcLoading(true);
    setShowRcModal(true);
    try {
      const res = await getStudentResults(studentId, { term, session });
      setRcResults(res.data.data || []);
      setRcSummary(res.data.summary);
    } catch (err) {
      toast.error('Failed to load report card: ' + getErrorMessage(err));
    } finally {
      setRcLoading(false);
    }
  };

  // ── Build report card — definitive fix ────────────────────────────────────────
  const handleReportCards = async () => {
    if (results.length === 0) {
      toast.error('No results loaded. Click Search first.');
      return;
    }

    const cls = classes.find(c => c._id === classId);
    const className = cls ? `${cls.name} ${cls.section || ''}`.trim() : 'Class';

    // Fetch students fresh — guaranteed to have userId.name
    let studentList = [];
    try {
      const stuRes = await getStudents({ classId, limit: 200 });
      studentList = stuRes.data.data || [];
    } catch {}

    // studentMap: _id → { name, admNo }
    const studentMap = {};
    studentList.forEach(s => {
      studentMap[String(s._id)] = {
        name:  s.userId?.name || s.name || '—',
        admNo: s.admissionNumber || '—',
      };
    });

    // subjectMap: _id → name (from subjects already loaded on page mount)
    const subjectMap = {};
    subjects.forEach(s => { subjectMap[String(s._id)] = s.name; });

    // Group results by student
    const grouped = {};
    results.forEach(r => {
      const sid = String(r.studentId?._id || r.studentId || 'unknown');

      const stuInfo   = studentMap[sid];
      const name      = stuInfo?.name  || r.studentId?.userId?.name || '—';
      const admNo     = stuInfo?.admNo || r.studentId?.admissionNumber || '—';

      const rawSubId  = String(r.subjectId?._id || r.subjectId || '');
      const subjectName = r.subjectId?.name || subjectMap[rawSubId] || '—';

      if (!grouped[sid]) grouped[sid] = { name, admNo, results: [] };
      grouped[sid].results.push({
        subjectName,
        ca:     r.ca    !== undefined ? r.ca    : '—',
        exam:   r.exam  !== undefined ? r.exam  : '—',
        total:  r.total !== undefined ? r.total : '—',
        grade:  r.grade  || '—',
        remark: r.remark || '—',
      });
    });

    const reportStudents = Object.values(grouped);
    if (reportStudents.length === 0) {
      toast.error('Could not build report card data');
      return;
    }
    generateClassReportCard({ className, students: reportStudents, term, session });
  };

  // Class subjects
  const classSubjects = subjects.filter(s =>
    String(s.classId?._id || s.classId) === String(classId)
  );

  // Group results by student for table display
  const grouped = results.reduce((acc, r) => {
    const { name, admNo, sid } = extractStudentInfo(r);

    // Also check students list for better name
    const fromList = students.find(s => String(s._id) === sid);
    const finalName  = fromList?.userId?.name || name;
    const finalAdmNo = fromList?.admissionNumber || admNo;

    if (!acc[sid]) acc[sid] = { sid, name: finalName, admNo: finalAdmNo, results: [] };
    acc[sid].results.push(r);
    return acc;
  }, {});

  const studentSummaries = Object.values(grouped).map(g => {
    const passed = g.results.filter(r => PASS_GRADES.includes(r.grade)).length;
    const avg    = g.results.length > 0
      ? (g.results.reduce((s, r) => s + (r.total || 0), 0) / g.results.length).toFixed(1)
      : 0;
    return { ...g, passed, failed: g.results.length - passed, avg };
  }).sort((a, b) => Number(b.avg) - Number(a.avg));

  const filteredSummaries = studentSummaries.filter(g =>
    !search ||
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    g.admNo.toLowerCase().includes(search.toLowerCase())
  );

  const filledCount    = Object.values(subjectData).filter(d => d.hasData).length;
  const selectedStudent = students.find(s => s._id === selectedStudentId);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Results Management</h1>
          <p className="page-subtitle">Upload and manage student academic results</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {results.length > 0 && (
            <button onClick={handleReportCards}
              className="btn-secondary flex items-center gap-2 text-sm">
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
          <select className="input-field py-1.5 text-sm w-40" value={classId}
            onChange={e => { setClassId(e.target.value); setResults([]); }}>
            <option value="">— Select —</option>
            {classes.map(c => <option key={c._id} value={c._id}>{c.name} {c.section}</option>)}
          </select>
        </div>
        <div>
          <label className="input-label">Term</label>
          <select className="input-field py-1.5 text-sm w-32" value={term}
            onChange={e => setTerm(e.target.value)}>
            {TERMS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)} Term</option>)}
          </select>
        </div>
        <div>
          <label className="input-label">Session</label>
          <select className="input-field py-1.5 text-sm w-32" value={session}
            onChange={e => setSession(e.target.value)}>
            {SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button onClick={handleSearch} disabled={!classId || loading}
          className="btn-primary py-2 flex items-center gap-2">
          <FiSearch size={15} /> {loading ? 'Searching…' : 'Search'}
        </button>
      </div>

      {/* Results table */}
      {loading ? (
        <div className="card space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-secondary-50 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <>
          {results.length > 0 && (
            <div className="card p-4">
              <div className="relative max-w-xs">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" size={14} />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search student…" className="input-field pl-9 py-1.5 text-sm" />
              </div>
            </div>
          )}

          {filteredSummaries.length === 0 ? (
            <div className="card text-center py-12 text-secondary-400">
              <FiFileText size={32} className="mx-auto mb-3 opacity-40" />
              <p className="font-medium">{results.length === 0 ? 'No results yet' : 'No students match your search'}</p>
              <p className="text-xs mt-1">
                {results.length === 0 ? 'Select class, term and session then click Search' : 'Try a different search term'}
              </p>
            </div>
          ) : (
            <div className="card overflow-hidden p-0 max-w-[100vw]">
              <div className="px-5 py-3 bg-secondary-50 border-b border-secondary-100">
                <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wide">
                  {filteredSummaries.length} student{filteredSummaries.length !== 1 ? 's' : ''} — {term} term · {session}
                </p>
              </div>
              <div className="overflow-x-auto w-full"><table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="bg-secondary-50 border-b border-secondary-100">
                    {['#','Student','Adm. No','Subjects','Average','Passed','Failed', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-secondary-50">
                  {filteredSummaries.map((g, i) => (
                    <tr key={g.sid} className="hover:bg-secondary-50 transition-colors">
                      <td className="px-4 py-3 text-secondary-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-secondary-800">{g.name}</td>
                      <td className="px-4 py-3 text-xs text-secondary-500">{g.admNo}</td>
                      <td className="px-4 py-3 text-center"><Badge variant="info">{g.results.length}</Badge></td>
                      <td className="px-4 py-3 font-bold text-blue-600">{g.avg}%</td>
                      <td className="px-4 py-3"><Badge variant="success">{g.passed}</Badge></td>
                      <td className="px-4 py-3"><Badge variant={g.failed > 0 ? 'danger' : 'gray'}>{g.failed}</Badge></td>
                      <td className="px-4 py-3">
                         <button
                           title="View Report Card"
                           onClick={() => openReportCard(g.sid, g.name)}
                           className="p-1.5 hover:bg-primary-50 rounded-lg transition-colors"
                         >
                           <FiEye size={14} className="text-primary-500" />
                         </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          )}
        </>
      )}

      {/* Bulk Upload Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Upload Results" size="xl">
        <div className="space-y-5">
          <div>
            <label className="input-label">Select Student *</label>
            <select className="input-field" value={selectedStudentId}
              onChange={e => handleStudentSelect(e.target.value)}>
              <option value="">— Choose student —</option>
              {students.map(s => (
                <option key={s._id} value={s._id}>
                  {s.userId?.name || s.name} ({s.admissionNumber})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

          {selectedStudentId && (
            <>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-sm font-semibold text-secondary-800">
                    {selectedStudent?.userId?.name || selectedStudent?.name} — {classSubjects.length} subject{classSubjects.length !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-secondary-400 mt-0.5">
                    Enter CA (max 40) and Exam (max 60). Leave blank to skip.
                    {Object.keys(existingResults).length > 0 && (
                      <span className="text-blue-500 ml-1">
                        · {Object.keys(existingResults).length} existing result{Object.keys(existingResults).length !== 1 ? 's' : ''} pre-loaded
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
                <div className="text-center py-8 bg-secondary-50 rounded-xl text-secondary-400">
                  <p className="text-sm font-medium">No subjects assigned to this class</p>
                  <p className="text-xs mt-1">Go to Classes &amp; Subjects to assign subjects first</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-secondary-200">
                  <div className="overflow-x-auto w-full"><table className="w-full text-sm min-w-[600px]">
                    <thead>
                      <tr className="bg-secondary-800 text-white">
                        <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase">Subject</th>
                        <th className="text-center px-3 py-2.5 text-xs font-semibold uppercase">CA (0–40)</th>
                        <th className="text-center px-3 py-2.5 text-xs font-semibold uppercase">Exam (0–60)</th>
                        <th className="text-center px-3 py-2.5 text-xs font-semibold uppercase">Total</th>
                        <th className="text-center px-3 py-2.5 text-xs font-semibold uppercase">Grade</th>
                        <th className="text-center px-3 py-2.5 text-xs font-semibold uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classSubjects.map(subject => (
                        <SubjectRow
                          key={subject._id}
                          subject={subject}
                          existingResult={existingResults[subject._id] || existingResults[String(subject._id)]}
                          onChange={handleSubjectChange}
                        />
                      ))}
                    </tbody>
                  </table></div>
                </div>
              )}

              {filledCount > 0 && (() => {
                const filled     = Object.values(subjectData).filter(d => d.hasData);
                const passCount  = filled.filter(d => d.grade && PASS_GRADES.includes(d.grade)).length;
                const avg        = filled.length > 0
                  ? (filled.reduce((s, d) => s + (d.total || 0), 0) / filled.length).toFixed(1)
                  : 0;
                return (
                  <div className="flex gap-6 p-3 bg-primary-50 rounded-xl border border-primary-100">
                    <div className="text-center"><p className="text-xs text-primary-600 font-medium">Subjects</p><p className="text-xl font-bold text-primary-700">{filledCount}</p></div>
                    <div className="text-center"><p className="text-xs text-secondary-500 font-medium">Average</p><p className="text-xl font-bold text-blue-600">{avg}%</p></div>
                    <div className="text-center"><p className="text-xs text-green-600 font-medium">Passing</p><p className="text-xl font-bold text-green-600">{passCount}</p></div>
                    <div className="text-center"><p className="text-xs text-red-500 font-medium">Failing</p><p className="text-xl font-bold text-red-500">{filledCount - passCount}</p></div>
                  </div>
                );
              })()}
            </>
          )}

          <div className="flex gap-3 pt-2 border-t border-secondary-100">
            <button onClick={() => setShowModal(false)} className="btn-secondary flex-1 min-w-0">Cancel</button>
            <button onClick={handleBulkSave}
              disabled={saving || !selectedStudentId || filledCount === 0}
              className="btn-primary flex-1 min-w-0 justify-center">
              {saving ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Saving…
                </span>
              ) : `Save ${filledCount > 0 ? filledCount + ' ' : ''}Result${filledCount !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </Modal>

      {/* Report Card Modal */}
      <Modal
        isOpen={showRcModal}
        onClose={() => setShowRcModal(false)}
        title={rcStudent ? `Report Card — ${rcStudent.name}` : 'Report Card'}
        size="xl"
      >
        <ReportCard
          student={rcResults[0]?.studentId ? {
            userId: { name: rcStudent?.name },
            admissionNumber: rcResults[0]?.studentId?.admissionNumber,
            classId: rcResults[0]?.classId,
          } : null}
          results={rcResults}
          summary={rcSummary}
          term={term}
          session={session}
          loading={rcLoading}
        />
      </Modal>
    </div>
  );
}
