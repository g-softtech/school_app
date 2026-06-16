import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { FiClipboard, FiDownload, FiClock, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import api from '../../services/api';
import FilePreview from '../../components/common/FilePreview';
import FileUpload from '../../components/common/FileUpload';
import Modal from '../../components/common/Modal';
import { TERMS, SESSIONS } from '../../utils/constants';
import { SERVER_URL as API_URL } from '../../utils/constants';
import { formatDate, getErrorMessage } from '../../utils/helpers';

export default function StudentAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [selected, setSelected]       = useState(null);
  const [submitting, setSubmitting]   = useState(false);
  const [answer, setAnswer]           = useState('');
  const [file, setFile]               = useState(null);
  const [term, setTerm]               = useState('first');
  const [session, setSession]         = useState('2025/2026');
  const [tab, setTab]                 = useState('open'); // open | submitted

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [asgRes, subRes] = await Promise.all([
        api.get('/assignments', { params: { term, session, limit: 50 } }),
        api.get('/submissions/my'),
      ]);
      setAssignments(asgRes.data.data || []);
      setSubmissions(subRes.data.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally { setLoading(false); }
  }, [term, session]);

  useEffect(() => { load(); }, [load]);

  const getSubmission = (assignmentId) =>
    submissions.find((s) => s.assignmentId?._id === assignmentId || s.assignmentId === assignmentId);

  const openAssignments = assignments.filter((a) => {
    const sub = getSubmission(a._id);
    return !sub && new Date() <= new Date(a.dueDate);
  });
  const submittedAssignments = assignments.filter((a) => !!getSubmission(a._id));
  const overdueAssignments   = assignments.filter((a) => !getSubmission(a._id) && new Date() > new Date(a.dueDate));

  const displayed = tab === 'open'
    ? [...openAssignments, ...overdueAssignments]
    : submittedAssignments;

  const handleSubmit = async () => {
    if (!selected) return;
    if (!answer.trim() && !file) { toast.error('Please provide an answer or upload a file'); return; }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('assignmentId', selected._id);
      if (answer.trim()) fd.append('answer', answer);
      if (file) fd.append('file', file);
      await api.post('/submissions', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Assignment submitted!');
      setSelected(null);
      setAnswer('');
      setFile(null);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally { setSubmitting(false); }
  };

  const AssignmentCard = ({ assignment }) => {
    const sub     = getSubmission(assignment._id);
    const overdue = !sub && new Date() > new Date(assignment.dueDate);
    return (
      <div className="card hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${sub ? 'bg-green-50' : overdue ? 'bg-red-50' : 'bg-amber-50'}`}>
              {sub ? <FiCheckCircle className="text-green-500" size={18} /> : overdue ? <FiAlertCircle className="text-red-500" size={18} /> : <FiClock className="text-amber-500" size={18} />}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-secondary-800 truncate">{assignment.title}</p>
              <p className="text-sm text-secondary-500">{assignment.subjectId?.name}</p>
            </div>
          </div>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${sub ? 'bg-green-100 text-green-700' : overdue ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>
            {sub ? (sub.status === 'graded' ? 'Graded' : 'Submitted') : overdue ? 'Overdue' : 'Open'}
          </span>
        </div>

        <div className="mt-3 text-sm text-secondary-600 line-clamp-2">{assignment.question}</div>
                {assignment.fileUrl && (
                  <a
                    href={`${API_URL}${assignment.fileUrl}`}
                    download={assignment.fileName || 'attachment'}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    <FiDownload size={12} /> Download teacher attachment
                  </a>
                )}

        <div className="mt-3 pt-3 border-t border-secondary-100 flex items-center justify-between">
          <div className="text-xs text-secondary-400">
            <span>Due: {formatDate(assignment.dueDate)}</span>
            <span className="mx-2">·</span>
            <span>Max: {assignment.maxScore} marks</span>
          </div>
          {sub ? (
            <div className="text-right">
              {sub.status === 'graded' && (
                <span className="text-sm font-bold text-green-600">{sub.score}/{assignment.maxScore}</span>
              )}
              <p className="text-xs text-secondary-400">{sub.status === 'graded' ? 'Graded' : 'Awaiting grade'}</p>
            </div>
          ) : !overdue && (
            <button onClick={() => { setSelected(assignment); setAnswer(''); setFile(null); }} className="btn-primary text-xs py-1.5 px-3">
              Submit
            </button>
          )}
        </div>

        {sub?.feedback && (
          <div className="mt-2 p-2.5 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-700 font-medium">Teacher feedback:</p>
            <p className="text-xs text-blue-600 mt-0.5">{sub.feedback}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Assignments</h1>
        <p className="page-subtitle">View and submit your class assignments</p>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <select value={term} onChange={(e) => setTerm(e.target.value)} className="input-field py-1.5 text-sm w-32">
          {TERMS.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)} Term</option>)}
        </select>
        <select value={session} onChange={(e) => setSession(e.target.value)} className="input-field py-1.5 text-sm w-32">
          {SESSIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary-100 p-1 rounded-xl w-fit">
        {[
          { id: 'open', label: `Pending (${openAssignments.length + overdueAssignments.length})` },
          { id: 'submitted', label: `Submitted (${submittedAssignments.length})` },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? 'bg-white text-secondary-800 shadow-sm' : 'text-secondary-500 hover:text-secondary-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="card animate-pulse h-40" />)}
        </div>
      ) : displayed.length === 0 ? (
        <div className="card text-center py-16 text-secondary-400">
          <FiClipboard size={32} className="mx-auto mb-3 opacity-40" />
          <p>No assignments found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {displayed.map((a) => <AssignmentCard key={a._id} assignment={a} />)}
        </div>
      )}

      {/* Submit Modal */}
      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title={`Submit: ${selected?.title || ''}`} size="md">
        {selected && (
          <div className="space-y-4">
            <div className="bg-secondary-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wide mb-1">Question</p>
              <p className="text-sm text-secondary-700 leading-relaxed">{selected.question}</p>
              <p className="text-xs text-secondary-400 mt-2">Max score: {selected.maxScore} · Due: {formatDate(selected.dueDate)}</p>
            </div>

            <div>
              <label className="input-label">Your Answer</label>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={5}
                placeholder="Type your answer here…"
                className="input-field resize-none"
              />
            </div>

            <FileUpload
              value={file}
              onChange={setFile}
              label="Or Upload File (optional)"
              placeholder="Click to browse or drag & drop"
              maxSizeMB={20}
            />

            <div className="flex gap-3 pt-2">
              <button onClick={() => setSelected(null)} className="btn-secondary flex-1 min-w-0">Cancel</button>
              <button onClick={handleSubmit} disabled={submitting} className="btn-primary flex-1 min-w-0">
                {submitting ? 'Submitting…' : 'Submit Assignment'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
