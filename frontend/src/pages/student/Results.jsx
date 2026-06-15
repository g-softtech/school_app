import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { FiDownload, FiShare2, FiTrendingUp, FiAlertCircle } from 'react-icons/fi';
import { getStudentResults, generateShareToken } from '../../services/resultService';
import { downloadResultsPDF } from '../../utils/pdfHelper';
import { TERMS, SESSIONS, GRADE_COLORS } from '../../utils/constants';
import { getErrorMessage } from '../../utils/helpers';
import api from '../../services/api';

const GRADE_BG = {
  A1:'bg-green-100 text-green-700', B2:'bg-green-100 text-green-700', B3:'bg-green-100 text-green-700',
  C4:'bg-blue-100 text-blue-700',   C5:'bg-blue-100 text-blue-700',   C6:'bg-blue-100 text-blue-700',
  D7:'bg-amber-100 text-amber-700', E8:'bg-amber-100 text-amber-700',
  F9:'bg-red-100 text-red-600',
};

export default function StudentResults() {
  const [student, setStudent]   = useState(null);
  const [results, setResults]   = useState([]);
  const [summary, setSummary]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [term, setTerm]         = useState('first');
  const [session, setSession]   = useState('2025/2026');
  const [shareUrl, setShareUrl] = useState('');
  const [sharing, setSharing]   = useState(false);
  const printRef = useRef();

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const stuRes = await api.get('/students/me');
        const stu = stuRes.data.data;
        setStudent(stu);
        const res = await getStudentResults(stu._id, { term, session });
        setResults(res.data.data || []);
        setSummary(res.data.summary);
      } catch (err) {
        toast.error(getErrorMessage(err));
      } finally { setLoading(false); }
    }
    load();
  }, [term, session]);

  const handleShare = async () => {
    if (!student) return;
    setSharing(true);
    try {
      const res = await generateShareToken({ studentId: student._id, term, session });
      const token = res.data.token;
      const url = `${window.location.origin}/api/results/share/${token}`;
      setShareUrl(url);
      await navigator.clipboard.writeText(url).catch(() => {});
      toast.success('Share link copied to clipboard!');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally { setSharing(false); }
  };

  const handlePrint = () => downloadResultsPDF({ student, results, summary, term, session });

  const passed = results.filter((r) => ['A1','B2','B3','C4','C5','C6'].includes(r.grade)).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title">My Results</h1>
          <p className="page-subtitle">View and download your academic results</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={term} onChange={(e) => setTerm(e.target.value)} className="input-field py-1.5 text-sm w-32">
            {TERMS.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)} Term</option>)}
          </select>
          <select value={session} onChange={(e) => setSession(e.target.value)} className="input-field py-1.5 text-sm w-32">
            {SESSIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={handlePrint} className="btn-secondary flex items-center gap-2 text-sm">
            <FiDownload size={14} /> Print
          </button>
          <button onClick={handleShare} disabled={sharing} className="btn-primary flex items-center gap-2 text-sm">
            <FiShare2 size={14} /> {sharing ? 'Sharing…' : 'Share'}
          </button>
        </div>
      </div>

      {shareUrl && (
        <div className="card bg-blue-50 border border-blue-200 p-4">
          <p className="text-xs font-medium text-blue-700 mb-1">Share link (copied):</p>
          <p className="text-xs text-blue-600 break-all font-mono">{shareUrl}</p>
        </div>
      )}

      {/* Summary cards */}
      {!loading && summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Subjects', value: summary.totalSubjects, color: 'text-secondary-800' },
            { label: 'Average', value: `${summary.average}%`, color: 'text-blue-600' },
            { label: 'Passed', value: summary.passed, color: 'text-green-600', icon: FiTrendingUp },
            { label: 'Failed', value: summary.failed, color: 'text-red-500', icon: FiAlertCircle },
          ].map((s) => (
            <div key={s.label} className="card text-center">
              <p className="text-xs text-secondary-500 mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Result table */}
      <div className="card overflow-hidden p-0 max-w-[100vw]" ref={printRef}>
        <div className="p-5 border-b border-secondary-100">
          {student && (
            <div>
              <h2 className="font-bold text-secondary-800">{student.userId?.name || '—'}</h2>
              <p className="text-sm text-secondary-500">{student.admissionNumber} · {student.classId?.name} · {term.charAt(0).toUpperCase() + term.slice(1)} Term · {session}</p>
              {summary && (
                <div className="summary flex flex-wrap gap-3 mt-2">
                  <span>Total Subjects: <b>{summary.totalSubjects}</b></span>
                  <span>Average: <b>{summary.average}%</b></span>
                  <span className="pass">Passed: <b>{summary.passed}</b></span>
                  <span className="fail">Failed: <b>{summary.failed}</b></span>
                </div>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(6)].map((_, i) => <div key={i} className="h-10 bg-secondary-50 rounded-lg animate-pulse" />)}
          </div>
        ) : results.length === 0 ? (
          <p className="text-center text-secondary-400 py-12 text-sm">No results found for this term and session</p>
        ) : (
          <div className="overflow-x-auto w-full"><table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="bg-secondary-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">#</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Subject</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">CA (40)</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Exam (60)</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Total (100)</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Grade</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Remark</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-50">
              {results.map((r, i) => (
                <tr key={r._id} className="hover:bg-secondary-50 transition-colors">
                  <td className="px-5 py-3 text-secondary-400 text-xs">{i + 1}</td>
                  <td className="px-5 py-3 font-medium text-secondary-800">{r.subjectId?.name || '—'}</td>
                  <td className="px-3 py-3 text-center text-secondary-700">{r.ca}</td>
                  <td className="px-3 py-3 text-center text-secondary-700">{r.exam}</td>
                  <td className="px-3 py-3 text-center font-bold text-secondary-800">{r.total}</td>
                  <td className="px-3 py-3 text-center">
                    <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full ${GRADE_BG[r.grade] || 'bg-secondary-100 text-secondary-600'}`}>
                      {r.grade}
                    </span>
                  </td>
                  <td className={`px-5 py-3 text-sm ${['A1','B2','B3','C4','C5','C6'].includes(r.grade) ? 'pass text-green-700' : 'fail text-red-600'}`}>
                    {r.remark}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}
