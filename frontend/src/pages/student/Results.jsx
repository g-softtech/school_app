import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { FiDownload, FiShare2 } from 'react-icons/fi';
import { getStudentResults, generateShareToken } from '../../services/resultService';
import { printReportCards } from '../../utils/printHelper';
import { TERMS, SESSIONS } from '../../utils/constants';
import { getErrorMessage } from '../../utils/helpers';
import api from '../../services/api';
import ReportCard from '../../components/common/ReportCard';

export default function StudentResults() {
  const [student, setStudent] = useState(null);
  const [results, setResults] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [term, setTerm]       = useState('first');
  const [session, setSession] = useState('2025/2026');
  const [shareUrl, setShareUrl] = useState('');
  const [sharing, setSharing]   = useState(false);

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
      const url = `${window.location.origin}/results/share/${token}`;
      setShareUrl(url);
      await navigator.clipboard.writeText(url).catch(() => {});
      toast.success('Share link copied to clipboard!');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally { setSharing(false); }
  };

  const handlePrint = () => {
    printReportCards([{ student, results, summary, term, session }]);
  };

  return (
    <div className="space-y-6">
      {/* Page controls */}
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

      {/* Canonical report card */}
      <ReportCard
        student={student}
        results={results}
        summary={summary}
        term={term}
        session={session}
        loading={loading}
      />
    </div>
  );
}
