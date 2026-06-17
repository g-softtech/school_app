import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { FiAward, FiPlus, FiEdit2, FiTrash2, FiSearch, FiUpload, FiFileText, FiEye } from 'react-icons/fi';
import { uploadResult, bulkUpload, updateResult, deleteResult, getClassResults, getStudentResults } from '../../services/resultService';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import ReportCard from '../../components/common/ReportCard';
import { TERMS, SESSIONS } from '../../utils/constants';
import { getErrorMessage } from '../../utils/helpers';
import { printReportCards } from '../../utils/printHelper';

const GRADES = [
  { range: [75, 100], grade: 'A1', remark: 'Excellent' },
  { range: [70, 74],  grade: 'B2', remark: 'Very Good' },
  { range: [65, 69],  grade: 'B3', remark: 'Good' },
  { range: [60, 64],  grade: 'C4', remark: 'Credit' },
  { range: [55, 59],  grade: 'C5', remark: 'Credit' },
  { range: [50, 54],  grade: 'C6', remark: 'Credit' },
  { range: [45, 49],  grade: 'D7', remark: 'Pass' },
  { range: [40, 44],  grade: 'E8', remark: 'Pass' },
  { range: [0, 39],   grade: 'F9', remark: 'Fail' },
];
const computeGrade = (total) => GRADES.find((g) => total >= g.range[0] && total <= g.range[1]) || GRADES[8];

const GRADE_BG = {
  A1:'bg-green-100 text-green-700', B2:'bg-green-100 text-green-700', B3:'bg-green-100 text-green-700',
  C4:'bg-blue-100 text-blue-700',   C5:'bg-blue-100 text-blue-700',   C6:'bg-blue-100 text-blue-700',
  D7:'bg-amber-100 text-amber-700', E8:'bg-amber-100 text-amber-700',
  F9:'bg-red-100 text-red-600',
};

const EMPTY_FORM = { studentId: '', subjectId: '', classId: '', ca: '', exam: '', term: 'first', session: '2025/2026' };

export default function TeacherResults() {
  const [results, setResults]     = useState([]);
  const [classes, setClasses]     = useState([]);
  const [subjects, setSubjects]   = useState([]);
  const [students, setStudents]   = useState([]);
  const [loading, setLoading]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editResult, setEditResult] = useState(null);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [classFilter, setClassFilter] = useState('');
  const [term, setTerm]           = useState('first');
  const [session, setSession]     = useState('2025/2026');
  const [search, setSearch]       = useState('');
  const [bulkFile, setBulkFile]   = useState(null);
  const [uploadingBulk, setUploadingBulk] = useState(false);
  const [printingBatch, setPrintingBatch] = useState(false);

  // Report card modal state
  const [rcStudent,  setRcStudent]  = useState(null);  // { id, name }
  const [rcResults,  setRcResults]  = useState([]);
  const [rcSummary,  setRcSummary]  = useState(null);
  const [rcLoading,  setRcLoading]  = useState(false);
  const [showRcModal, setShowRcModal] = useState(false);

  useEffect(() => {
    Promise.allSettled([
      api.get('/classes', { params: { limit: 100 } }),
      api.get('/subjects', { params: { limit: 100 } }),
    ]).then(([clRes, subRes]) => {
      if (clRes.status  === 'fulfilled') setClasses(clRes.value.data.data || []);
      if (subRes.status === 'fulfilled') setSubjects(subRes.value.data.data || []);
    });
  }, []);

  const fetchResults = useCallback(async () => {
    if (!classFilter) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await getClassResults(classFilter, { term, session, limit: 200 });
      setResults(res.data.data || []);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, [classFilter, term, session]);

  useEffect(() => { fetchResults(); }, [fetchResults]);

  useEffect(() => {
    if (!form.classId) return;
    api.get('/students', { params: { classId: form.classId, limit: 200 } })
      .then((r) => setStudents(r.data.data || []))
      .catch(() => {});
  }, [form.classId]);

  const openCreate = () => { setEditResult(null); setForm({ ...EMPTY_FORM, classId: classFilter, term, session }); setShowModal(true); };
  const openEdit = (r) => {
    setEditResult(r);
    setForm({ studentId: r.studentId?._id || r.studentId, subjectId: r.subjectId?._id || r.subjectId,
      classId: r.classId?._id || r.classId, ca: r.ca, exam: r.exam, term: r.term, session: r.session });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.studentId || !form.subjectId || !form.classId || !form.ca || !form.exam) {
      toast.error('Please fill in all required fields'); return;
    }
    const ca = Number(form.ca), exam = Number(form.exam);
    if (ca > 40)  { toast.error('CA score cannot exceed 40'); return; }
    if (exam > 60) { toast.error('Exam score cannot exceed 60'); return; }
    setSaving(true);
    try {
      const payload = { ...form, ca, exam };
      if (editResult) { await updateResult(editResult._id, payload); toast.success('Result updated!'); }
      else { await uploadResult(payload); toast.success('Result uploaded!'); }
      setShowModal(false);
      fetchResults();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this result?')) return;
    try { await deleteResult(id); toast.success('Deleted'); fetchResults(); }
    catch (err) { toast.error(getErrorMessage(err)); }
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

  const handleBulkUpload = async () => {
    if (!bulkFile) { toast.error('Select a CSV file'); return; }
    if (!classFilter || !term || !session) { toast.error('Please select class, term and session first'); return; }
    setUploadingBulk(true);
    try {
      const fd = new FormData();
      fd.append('file', bulkFile);
      fd.append('classId', classFilter);
      fd.append('term', term);
      fd.append('session', session);
      await bulkUpload(fd);
      toast.success('Bulk upload successful!');
      setBulkFile(null);
      fetchResults();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setUploadingBulk(false); }
  };

  const previewTotal = () => {
    const ca = Number(form.ca) || 0;
    const exam = Number(form.exam) || 0;
    const total = ca + exam;
    return total > 0 ? { total, ...computeGrade(total) } : null;
  };

  const preview = previewTotal();

  const filtered = results.filter((r) =>
    !search || r.studentId?.userId?.name?.toLowerCase().includes(search.toLowerCase()) || r.subjectId?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const fc = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div><h1 className="page-title">Results</h1><p className="page-subtitle">Upload and manage student results</p></div>
        <div className="flex gap-2">
          <label className="btn-secondary text-sm flex items-center gap-2 cursor-pointer">
            <FiUpload size={14} /> {bulkFile ? bulkFile.name.slice(0, 12) + '…' : 'Bulk CSV'}
            <input type="file" accept=".csv" className="hidden" onChange={(e) => setBulkFile(e.target.files[0])} />
          </label>
          {bulkFile && (
            <button onClick={handleBulkUpload} disabled={uploadingBulk} className="btn-secondary text-sm">
              {uploadingBulk ? 'Uploading…' : 'Upload CSV'}
            </button>
          )}
          <button onClick={openCreate} disabled={!classFilter} className="btn-primary flex items-center gap-2 text-sm">
            <FiPlus size={15} /> Add Result
          </button>
          {results.length > 0 && (
            <button
              onClick={async () => {
                const sids = [...new Set(results.map(r => r.studentId?._id || r.studentId))];
                if (!sids.length) return;
                setPrintingBatch(true);
                try {
                  const fetched = await Promise.all(
                    sids.map(id => getStudentResults(id, { term, session }).then(res => ({
                      student: res.data.student || { _id: id },
                      results: res.data.data || [],
                      summary: res.data.summary,
                      term,
                      session
                    })).catch(() => null))
                  );
                  const validData = fetched.filter(Boolean);
                  if (validData.length > 0) {
                    printReportCards(validData);
                  } else {
                    toast.error('Could not load report cards data.');
                  }
                } catch (err) {
                  toast.error('Failed to generate batch report cards');
                } finally {
                  setPrintingBatch(false);
                }
              }}
              disabled={printingBatch}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <FiFileText size={14} /> {printingBatch ? 'Loading...' : 'Report Cards'}
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <select value={classFilter} onChange={(e) => { setClassFilter(e.target.value); setPage?.(1); }} className="input-field py-1.5 text-sm w-40">
          <option value="">Select class…</option>
          {classes.map((c) => <option key={c._id} value={c._id}>{c.name} {c.section}</option>)}
        </select>
        <select value={term} onChange={(e) => setTerm(e.target.value)} className="input-field py-1.5 text-sm w-32">
          {TERMS.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)} Term</option>)}
        </select>
        <select value={session} onChange={(e) => setSession(e.target.value)} className="input-field py-1.5 text-sm w-32">
          {SESSIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {classFilter && (
          <div className="relative flex-1 min-w-0 min-w-48">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" size={14} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student or subject…" className="input-field pl-9 py-1.5 text-sm w-full" />
          </div>
        )}
      </div>

      {!classFilter ? (
        <div className="card text-center py-16 text-secondary-400"><FiAward size={32} className="mx-auto mb-3 opacity-40" /><p>Select a class to view results</p></div>
      ) : (
        <div className="card overflow-hidden p-0 max-w-[100vw]">
          {loading ? (
            <div className="p-6 space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="h-12 bg-secondary-50 rounded-xl animate-pulse" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-14 text-secondary-400"><FiAward size={32} className="mx-auto mb-3 opacity-40" /><p>No results found</p></div>
          ) : (
            <div className="overflow-x-auto w-full"><table className="w-full text-sm min-w-[600px]">
              <thead><tr className="bg-secondary-50">
                {['Student', 'Subject', 'CA (40)', 'Exam (60)', 'Total', 'Grade', 'Remark', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-secondary-50">
                {filtered.map((r) => (
                  <tr key={r._id} className="hover:bg-secondary-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-secondary-800">{r.studentId?.userId?.name || '—'}</td>
                    <td className="px-4 py-3 text-secondary-600">{r.subjectId?.name || '—'}</td>
                    <td className="px-4 py-3 text-center text-secondary-600">{r.ca}</td>
                    <td className="px-4 py-3 text-center text-secondary-600">{r.exam}</td>
                    <td className="px-4 py-3 text-center font-bold text-secondary-800">{r.total}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${GRADE_BG[r.grade] || 'bg-secondary-100 text-secondary-600'}`}>{r.grade}</span>
                    </td>
                    <td className={`px-4 py-3 text-sm ${['A1','B2','B3','C4','C5','C6'].includes(r.grade) ? 'text-green-700' : 'text-red-600'}`}>{r.remark}</td>
                  <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          title="View Report Card"
                          onClick={() => openReportCard(
                            r.studentId?._id || r.studentId,
                            r.studentId?.userId?.name || 'Student'
                          )}
                          className="p-1.5 hover:bg-primary-50 rounded-lg transition-colors"
                        >
                          <FiEye size={14} className="text-primary-500" />
                        </button>
                        <button onClick={() => openEdit(r)} className="p-1.5 hover:bg-secondary-100 rounded-lg transition-colors"><FiEdit2 size={14} className="text-secondary-500" /></button>
                        <button onClick={() => handleDelete(r._id)} className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"><FiTrash2 size={14} className="text-red-400" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editResult ? 'Edit Result' : 'Add Result'} size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="input-label">Class <span className="text-red-500">*</span></label>
              <select name="classId" value={form.classId} onChange={fc} className="input-field">
                <option value="">Select…</option>
                {classes.map((c) => <option key={c._id} value={c._id}>{c.name} {c.section}</option>)}
              </select>
            </div>
            <div>
              <label className="input-label">Student <span className="text-red-500">*</span></label>
              <select name="studentId" value={form.studentId} onChange={fc} className="input-field" disabled={!form.classId}>
                <option value="">Select…</option>
                {students.map((s) => <option key={s._id} value={s._id}>{s.userId?.name} ({s.admissionNumber})</option>)}
              </select>
            </div>
            <div>
              <label className="input-label">Subject <span className="text-red-500">*</span></label>
              <select name="subjectId" value={form.subjectId} onChange={fc} className="input-field">
                <option value="">Select…</option>
                {subjects.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="input-label">Term</label>
              <select name="term" value={form.term} onChange={fc} className="input-field capitalize">
                {TERMS.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)} Term</option>)}
              </select>
            </div>
            <div>
              <label className="input-label">CA Score (max 40) <span className="text-red-500">*</span></label>
              <input name="ca" type="number" min="0" max="40" value={form.ca} onChange={fc} placeholder="0–40" className="input-field" />
            </div>
            <div>
              <label className="input-label">Exam Score (max 60) <span className="text-red-500">*</span></label>
              <input name="exam" type="number" min="0" max="60" value={form.exam} onChange={fc} placeholder="0–60" className="input-field" />
            </div>
          </div>

          {preview && (
            <div className="flex items-center gap-3 p-3 bg-secondary-50 rounded-xl">
              <div><p className="text-xs text-secondary-500">Total</p><p className="text-xl font-bold text-secondary-800">{preview.total}</p></div>
              <div><p className="text-xs text-secondary-500">Grade</p><span className={`text-sm font-bold px-2 py-0.5 rounded-full ${GRADE_BG[preview.grade]}`}>{preview.grade}</span></div>
              <div><p className="text-xs text-secondary-500">Remark</p><p className="text-sm font-medium text-secondary-700">{preview.remark}</p></div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowModal(false)} className="btn-secondary flex-1 min-w-0">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 min-w-0">{saving ? 'Saving…' : editResult ? 'Update' : 'Upload'}</button>
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
