import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { FiClipboard, FiPlus, FiEdit2, FiTrash2, FiSearch, FiEye } from 'react-icons/fi';
import api from '../../services/api';
import FilePreview from '../../components/common/FilePreview';
import FileUpload from '../../components/common/FileUpload';
import Modal from '../../components/common/Modal';
import Table from '../../components/common/Table';
import { TERMS, SESSIONS } from '../../utils/constants';
import { formatDate, getErrorMessage } from '../../utils/helpers';

const EMPTY_FORM = { classId: '', subjectId: '', title: '', question: '', dueDate: '', maxScore: '', term: 'first', session: '2025/2026' };
import { SERVER_URL as API_URL } from '../../utils/constants';

export default function TeacherAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [classes, setClasses]     = useState([]);
  const [subjects, setSubjects]           = useState([]);
  const [filteredSubjects, setFilteredSubjects] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem]   = useState(null);
  const [viewSubs, setViewSubs]   = useState(null);  // assignment for viewing submissions
  const [submissions, setSubmissions] = useState([]);
  const [gradingId, setGradingId] = useState(null);
  const [gradeForm, setGradeForm] = useState({ score: '', feedback: '' });
  const [form, setForm]           = useState(EMPTY_FORM);
  const [file, setFile]           = useState(null);
  const [search, setSearch]       = useState('');
  const [term, setTerm]           = useState('');
  const [session, setSession]     = useState('2025/2026');
  const [pagination, setPagination] = useState({});
  const [page, setPage]           = useState(1);

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/assignments', { params: { term: term || undefined, session, page, limit: 10 } });
      setAssignments(res.data.data || []);
      setPagination(res.data.pagination || {});
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, [term, session, page]);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

  useEffect(() => {
    Promise.allSettled([
      api.get('/classes', { params: { limit: 100 } }),
      api.get('/subjects', { params: { limit: 100 } }),
    ]).then(([clRes, subRes]) => {
      if (clRes.status  === 'fulfilled') setClasses(clRes.value.data.data || []);
      if (subRes.status === 'fulfilled') setSubjects(subRes.value.data.data || []);
    });
  }, []);

  const openCreate = () => { setEditItem(null); setForm(EMPTY_FORM); setFile(null); setShowModal(true); };
  const openEdit = (a) => {
    setEditItem(a);
    setForm({ classId: a.classId?._id || '', subjectId: a.subjectId?._id || '', title: a.title,
      question: a.question, dueDate: a.dueDate?.slice(0, 16) || '', maxScore: a.maxScore,
      term: a.term, session: a.session });
    setFile(null); setShowModal(true);
  };

  // Filter subjects by selected class
  useEffect(() => {
    if (!form.classId) {
      setFilteredSubjects(subjects);
    } else {
      setFilteredSubjects(subjects.filter((s) => (s.classId?._id || s.classId) === form.classId));
    }
  }, [form.classId, subjects]);

  const handleSave = async () => {
    if (!form.classId || !form.subjectId || !form.title || !form.question || !form.dueDate || !form.maxScore) {
      toast.error('Please fill in all required fields'); return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (file) fd.append('file', file);
      if (editItem) {
        await api.patch(`/assignments/${editItem._id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success('Assignment updated!');
      } else {
        await api.post('/assignments', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success('Assignment created!');
      }
      setShowModal(false);
      fetchAssignments();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this assignment and all its submissions?')) return;
    try {
      await api.delete(`/assignments/${id}`);
      toast.success('Deleted');
      fetchAssignments();
    } catch (err) { toast.error(getErrorMessage(err)); }
  };

  const openSubmissions = async (assignment) => {
    setViewSubs(assignment);
    setSubmissions([]);
    try {
      const res = await api.get(`/assignments/${assignment._id}/submissions`);
      setSubmissions(res.data.data || []);
    } catch (err) { toast.error(getErrorMessage(err)); }
  };

  const handleGrade = async (subId) => {
    if (!gradeForm.score) { toast.error('Enter a score'); return; }
    try {
      await api.patch(`/submissions/${subId}/grade`, { score: Number(gradeForm.score), feedback: gradeForm.feedback });
      toast.success('Graded!');
      setGradingId(null);
      setGradeForm({ score: '', feedback: '' });
      openSubmissions(viewSubs);
    } catch (err) { toast.error(getErrorMessage(err)); }
  };

  const filtered = assignments.filter((a) =>
    !search || a.title.toLowerCase().includes(search.toLowerCase()) || a.subjectId?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const fc = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div><h1 className="page-title">Assignments</h1><p className="page-subtitle">Create, manage and grade student assignments</p></div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2"><FiPlus size={16} />New Assignment</button>
      </div>

      <div className="card p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-0 min-w-48">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" size={14} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="input-field pl-9 py-1.5 text-sm w-full" />
        </div>
        <select value={term} onChange={(e) => { setTerm(e.target.value); setPage(1); }} className="input-field py-1.5 text-sm w-32">
          <option value="">All Terms</option>
          {TERMS.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)} Term</option>)}
        </select>
        <select value={session} onChange={(e) => { setSession(e.target.value); setPage(1); }} className="input-field py-1.5 text-sm w-32">
          {SESSIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <Table
        loading={loading}
        emptyMessage="No assignments found"
        columns={[
          { key: 'title', label: 'Title', render: (val) => <span className="font-medium text-secondary-800 max-w-48 truncate block">{val}</span> },
          { key: 'subjectId', label: 'Subject', render: (val) => val?.name || '—' },
          { key: 'classId', label: 'Class', render: (val) => val?.name || '—' },
          { key: 'dueDate', label: 'Due Date', render: (val) => {
              const overdue = new Date() > new Date(val);
              return <span className={overdue ? 'text-red-500 font-medium' : ''}>{formatDate(val)}</span>;
            }
          },
          { key: 'maxScore', label: 'Max Score', render: (val) => <span className="text-center block">{val}</span> },
          { key: 'term', label: 'Term', render: (val) => <span className="capitalize">{val}</span> },
          { key: 'actions', label: '', render: (_, a) => (
              <div className="flex items-center gap-1 justify-end">
                <button onClick={() => openSubmissions(a)} className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors" title="View submissions">
                  <FiEye size={14} className="text-blue-500" />
                </button>
                <button onClick={() => openEdit(a)} className="p-1.5 hover:bg-secondary-100 rounded-lg transition-colors">
                  <FiEdit2 size={14} className="text-secondary-500" />
                </button>
                <button onClick={() => handleDelete(a._id)} className="p-1.5 hover:bg-red-50 rounded-lg transition-colors">
                  <FiTrash2 size={14} className="text-red-400" />
                </button>
              </div>
            )
          }
        ]} 
        data={filtered} 
      />

      {pagination.pages > 1 && (
        <div className="flex justify-center gap-2">
          {[...Array(pagination.pages)].map((_, i) => (
            <button key={i} onClick={() => setPage(i + 1)} className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${page === i + 1 ? 'bg-primary-500 text-white' : 'bg-white border border-secondary-200 text-secondary-600 hover:border-primary-300'}`}>{i + 1}</button>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Edit Assignment' : 'New Assignment'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="input-label">Class <span className="text-red-500">*</span></label>
              <select name="classId" value={form.classId} onChange={fc} className="input-field">
                <option value="">Select class…</option>
                {classes.map((c) => <option key={c._id} value={c._id}>{c.name} {c.section}</option>)}
              </select>
            </div>
            <div>
              <label className="input-label">Subject <span className="text-red-500">*</span></label>
              <select name="subjectId" value={form.subjectId} onChange={fc} className="input-field">
                <option value="">Select subject…</option>
                {filteredSubjects.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
                {form.classId && filteredSubjects.length === 0 && (
                  <option disabled>No subjects for this class</option>
                )}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="input-label">Title <span className="text-red-500">*</span></label>
              <input name="title" value={form.title} onChange={fc} placeholder="Assignment title" className="input-field" />
            </div>
            <div className="sm:col-span-2">
              <label className="input-label">Question <span className="text-red-500">*</span></label>
              <textarea name="question" value={form.question} onChange={fc} rows={3} placeholder="Write the assignment question…" className="input-field resize-none" />
            </div>
            <div>
              <label className="input-label">Due Date <span className="text-red-500">*</span></label>
              <input name="dueDate" type="datetime-local" value={form.dueDate} onChange={fc} className="input-field" />
            </div>
            <div>
              <label className="input-label">Max Score <span className="text-red-500">*</span></label>
              <input name="maxScore" type="number" min="1" value={form.maxScore} onChange={fc} placeholder="e.g. 100" className="input-field" />
            </div>
            <div>
              <label className="input-label">Term</label>
              <select name="term" value={form.term} onChange={fc} className="input-field capitalize">
                {TERMS.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)} Term</option>)}
              </select>
            </div>
            <div>
              <label className="input-label">Session</label>
              <select name="session" value={form.session} onChange={fc} className="input-field">
                {SESSIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <FileUpload
            value={file}
            onChange={setFile}
            label="Attach File (optional)"
            placeholder="Upload PDF, image, Word doc or any resource"
            existingFileName={editItem?.fileName}
            maxSizeMB={20}
          />
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowModal(false)} className="btn-secondary flex-1 min-w-0">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 min-w-0">{saving ? 'Saving…' : editItem ? 'Save Changes' : 'Create'}</button>
          </div>
        </div>
      </Modal>

      {/* Submissions Modal */}
      <Modal isOpen={!!viewSubs} onClose={() => { setViewSubs(null); setGradingId(null); }} title={`Submissions — ${viewSubs?.title || ''}`} size="xl">
        {submissions.length === 0 ? (
          <p className="text-center text-secondary-400 py-10">No submissions yet</p>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-4 text-sm text-secondary-500 pb-2 border-b border-secondary-100">
              <span>Total: <b>{submissions.length}</b></span>
              <span>Graded: <b>{submissions.filter((s) => s.status === 'graded').length}</b></span>
              <span>Pending: <b>{submissions.filter((s) => s.status !== 'graded').length}</b></span>
            </div>
            {submissions.map((sub) => (
              <div key={sub._id} className="border border-secondary-100 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-secondary-800">{sub.studentId?.userId?.name || '—'}</p>
                    <p className="text-xs text-secondary-400">{sub.studentId?.admissionNumber} · Submitted: {formatDate(sub.submittedAt)}</p>
                  </div>
                  {sub.status === 'graded' ? (
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-600">{sub.score}/{viewSubs?.maxScore}</p>
                      <p className="text-xs text-secondary-400">Graded</p>
                    </div>
                  ) : (
                    <button onClick={() => { setGradingId(sub._id); setGradeForm({ score: '', feedback: '' }); }} className="btn-primary text-xs py-1.5 px-3">
                      Grade
                    </button>
                  )}
                </div>
                {sub.answer && <p className="text-sm text-secondary-700 bg-secondary-50 rounded-lg p-2.5">{sub.answer}</p>}
                {sub.fileUrl && (
                  <FilePreview fileUrl={sub.fileUrl} fileName={sub.fileName} size="sm" />
                )}
                {sub.feedback && <p className="text-xs text-blue-700 bg-blue-50 rounded-lg p-2">Feedback: {sub.feedback}</p>}

                {gradingId === sub._id && (
                  <div className="flex gap-2 pt-1">
                    <input type="number" value={gradeForm.score} onChange={(e) => setGradeForm((p) => ({ ...p, score: e.target.value }))} placeholder={`Score (max ${viewSubs?.maxScore})`} min="0" max={viewSubs?.maxScore} className="input-field py-1.5 text-sm w-36" />
                    <input value={gradeForm.feedback} onChange={(e) => setGradeForm((p) => ({ ...p, feedback: e.target.value }))} placeholder="Feedback (optional)" className="input-field py-1.5 text-sm flex-1 min-w-0" />
                    <button onClick={() => handleGrade(sub._id)} className="btn-primary text-sm px-4">Save</button>
                    <button onClick={() => setGradingId(null)} className="btn-secondary text-sm px-3">✕</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
