import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import {
  FiDownload, FiSearch, FiFileText, FiClipboard,
  FiFilter, FiBook, FiEye,
} from 'react-icons/fi';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import FilePreview from '../../components/common/FilePreview';
import PageSkeleton from '../../components/common/PageSkeleton';
import { TERMS, SESSIONS } from '../../utils/constants';
import { formatDate, getErrorMessage } from '../../utils/helpers';

import { SERVER_URL as API_URL } from '../../utils/constants';

const TYPE_CONFIG = {
  lesson:     { label: 'Lesson Note',  icon: FiBook,      color: 'bg-blue-50 text-blue-600',   badge: 'bg-blue-100 text-blue-700' },
  assignment: { label: 'Assignment',   icon: FiClipboard, color: 'bg-amber-50 text-amber-600', badge: 'bg-amber-100 text-amber-700' },
};

export default function StudentDownloads() {
  const [lessonFiles,     setLessonFiles]     = useState([]);
  const [assignmentFiles, setAssignmentFiles] = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [search,          setSearch]          = useState('');
  const [typeFilter,      setTypeFilter]      = useState('all');
  const [term,            setTerm]            = useState('');
  const [session,         setSession]         = useState('2025/2026');
  const [preview,         setPreview]         = useState(null); // { fileUrl, fileName, title, type }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [lRes, aRes] = await Promise.all([
        api.get('/lesson-notes', { params: { term: term || undefined, session, limit: 100 } }),
        api.get('/assignments',  { params: { term: term || undefined, session, limit: 100 } }),
      ]);

      // Only lesson notes that have a file attached
      const lessons = (lRes.data.data || [])
        .filter((n) => n.fileUrl)
        .map((n) => ({
          _id:       n._id,
          type:      'lesson',
          title:     n.topic,
          subject:   n.subjectId?.name || '—',
          class:     n.classId?.name   || '—',
          teacher:   n.teacherId?.name || '—',
          week:      n.week,
          term:      n.term,
          session:   n.session,
          fileUrl:   n.fileUrl,
          fileName:  n.fileName,
          createdAt: n.createdAt,
        }));

      // Assignments that have a file attachment from the teacher
      const assignments = (aRes.data.data || [])
        .filter((a) => a.fileUrl)
        .map((a) => ({
          _id:       a._id,
          type:      'assignment',
          title:     a.title,
          subject:   a.subjectId?.name || '—',
          class:     a.classId?.name   || '—',
          teacher:   a.teacherId?.name || '—',
          dueDate:   a.dueDate,
          term:      a.term,
          session:   a.session,
          fileUrl:   a.fileUrl,
          fileName:  a.fileName,
          createdAt: a.createdAt,
        }));

      setLessonFiles(lessons);
      setAssignmentFiles(assignments);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [term, session]);

  useEffect(() => { load(); }, [load]);

  const allFiles = [
    ...(typeFilter === 'assignment' ? [] : lessonFiles),
    ...(typeFilter === 'lesson'     ? [] : assignmentFiles),
  ].filter((f) =>
    !search ||
    f.title.toLowerCase().includes(search.toLowerCase()) ||
    f.subject.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const handleDownload = (file) => {
    const fullUrl = file.fileUrl.startsWith('http') ? file.fileUrl : `${API_URL}${file.fileUrl}`;
    const a = document.createElement('a');
    a.href = fullUrl;
    a.download = file.fileName || file.title;
    a.click();
  };

  if (loading) return <PageSkeleton type="table" rows={8} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <FiDownload className="text-primary-500" size={20} /> Download Centre
        </h1>
        <p className="page-subtitle">All files shared by your teachers in one place</p>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Files',    value: lessonFiles.length + assignmentFiles.length, color: 'text-secondary-800' },
          { label: 'Lesson Notes',   value: lessonFiles.length,     color: 'text-blue-600' },
          { label: 'Assignments',    value: assignmentFiles.length,  color: 'text-amber-600' },
        ].map((s) => (
          <div key={s.label} className="card text-center">
            <p className="text-xs text-secondary-500 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-0 min-w-48">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" size={14} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search topic or subject…" className="input-field pl-9 py-1.5 text-sm w-full" />
        </div>
        <div className="flex items-center gap-1 bg-secondary-100 p-1 rounded-xl">
          {[
            { id: 'all',        label: 'All' },
            { id: 'lesson',     label: 'Lessons' },
            { id: 'assignment', label: 'Assignments' },
          ].map((t) => (
            <button key={t.id} onClick={() => setTypeFilter(t.id)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${typeFilter === t.id ? 'bg-white text-secondary-800 shadow-sm' : 'text-secondary-500 hover:text-secondary-700'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <select value={term} onChange={(e) => setTerm(e.target.value)} className="input-field py-1.5 text-sm w-32">
          <option value="">All Terms</option>
          {TERMS.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)} Term</option>)}
        </select>
        <select value={session} onChange={(e) => setSession(e.target.value)} className="input-field py-1.5 text-sm w-32">
          {SESSIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Files grid */}
      {allFiles.length === 0 ? (
        <div className="card text-center py-16 text-secondary-400">
          <FiDownload size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No files available</p>
          <p className="text-xs mt-1">Files attached by teachers will appear here</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {allFiles.map((file) => {
            const cfg = TYPE_CONFIG[file.type];
            return (
              <div key={`${file.type}-${file._id}`} className="card hover:shadow-card-md transition-all duration-200 group">
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className={`w-10 h-10 rounded-xl ${cfg.color} flex items-center justify-center flex-shrink-0`}>
                    <cfg.icon size={18} />
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                    {cfg.label}
                  </span>
                </div>

                {/* Info */}
                <p className="font-semibold text-secondary-800 truncate mb-1">{file.title}</p>
                <p className="text-sm text-secondary-500">{file.subject}</p>
                <p className="text-xs text-secondary-400 mt-0.5">
                  By {file.teacher}
                  {file.week && ` · Week ${file.week}`}
                  {file.dueDate && ` · Due ${formatDate(file.dueDate)}`}
                </p>
                <p className="text-xs text-secondary-400 mt-0.5 capitalize">
                  {file.term} term · {file.session}
                </p>

                {/* File name */}
                <div className="mt-3 flex items-center gap-2 p-2 bg-secondary-50 rounded-lg">
                  <FiFileText size={13} className="text-secondary-400 flex-shrink-0" />
                  <p className="text-xs text-secondary-600 truncate">{file.fileName || 'attachment'}</p>
                </div>

                {/* Actions */}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => setPreview(file)}
                    className="flex-1 min-w-0 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-secondary-600 bg-secondary-100 hover:bg-secondary-200 rounded-lg transition-colors"
                  >
                    <FiEye size={13} /> Preview
                  </button>
                  <button
                    onClick={() => handleDownload(file)}
                    className="flex-1 min-w-0 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors"
                  >
                    <FiDownload size={13} /> Download
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview Modal */}
      <Modal
        isOpen={!!preview}
        onClose={() => setPreview(null)}
        title={preview?.title || 'File Preview'}
        size="lg"
      >
        {preview && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-secondary-50 rounded-xl">
              <div className={`w-9 h-9 rounded-xl ${TYPE_CONFIG[preview.type]?.color} flex items-center justify-center flex-shrink-0`}>
                {preview.type === 'lesson' ? <FiBook size={16} /> : <FiClipboard size={16} />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-secondary-800 truncate">{preview.title}</p>
                <p className="text-xs text-secondary-400">{preview.subject} · By {preview.teacher}</p>
              </div>
              <button
                onClick={() => handleDownload(preview)}
                className="flex items-center gap-1.5 text-xs bg-primary-500 text-white px-3 py-1.5 rounded-lg hover:bg-primary-600 transition-colors flex-shrink-0"
              >
                <FiDownload size={12} /> Download
              </button>
            </div>

            <FilePreview
              fileUrl={preview.fileUrl}
              fileName={preview.fileName}
              size="lg"
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
