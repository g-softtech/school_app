import { useState, useEffect, useCallback } from 'react';
import { FiFileText, FiSearch, FiBookOpen } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../../services/api';
import FilePreview from '../../components/common/FilePreview';
import Modal from '../../components/common/Modal';
import { TERMS, SESSIONS } from '../../utils/constants';
import { formatDate, getErrorMessage } from '../../utils/helpers';

import { SERVER_URL as API_URL } from '../../utils/constants';

export default function StudentLessonNotes() {
  const [notes, setNotes]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [term, setTerm]       = useState('');
  const [session, setSession] = useState('2025/2026');
  const [search, setSearch]   = useState('');
  const [page, setPage]       = useState(1);
  const [pagination, setPagination] = useState({});

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/lesson-notes', {
        params: { term: term || undefined, session, page, limit: 12 },
      });
      setNotes(res.data.data || []);
      setPagination(res.data.pagination || {});
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally { setLoading(false); }
  }, [term, session, page]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  const filtered = notes.filter((n) =>
    !search || n.topic.toLowerCase().includes(search.toLowerCase()) || n.subjectId?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Lesson Notes</h1>
        <p className="page-subtitle">Access study materials shared by your teachers</p>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-0 min-w-48">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" size={15} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search topic or subject…" className="input-field pl-9 py-1.5 text-sm w-full" />
        </div>
        <select value={term} onChange={(e) => { setTerm(e.target.value); setPage(1); }} className="input-field py-1.5 text-sm w-32">
          <option value="">All Terms</option>
          {TERMS.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)} Term</option>)}
        </select>
        <select value={session} onChange={(e) => { setSession(e.target.value); setPage(1); }} className="input-field py-1.5 text-sm w-32">
          {SESSIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Notes grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="card animate-pulse h-36" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16 text-secondary-400">
          <FiBookOpen size={32} className="mx-auto mb-3 opacity-40" />
          <p>No lesson notes found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((note) => (
            <div key={note._id} className="card hover:shadow-md transition-shadow cursor-pointer group" onClick={() => setSelected(note)}>
              <div className="flex items-start justify-between gap-2">
                <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                  <FiFileText className="text-primary-500" size={18} />
                </div>
                <span className="text-xs bg-secondary-100 text-secondary-600 px-2 py-0.5 rounded-full">Week {note.week}</span>
              </div>
              <div className="mt-3">
                <p className="font-semibold text-secondary-800 group-hover:text-primary-600 transition-colors line-clamp-2">{note.topic}</p>
                <p className="text-sm text-secondary-500 mt-1">{note.subjectId?.name}</p>
                <p className="text-xs text-secondary-400 mt-0.5">{note.classId?.name} · {note.term?.charAt(0).toUpperCase() + note.term?.slice(1)} Term</p>
              </div>
              <div className="mt-3 pt-3 border-t border-secondary-100 flex items-center justify-between">
                <span className="text-xs text-secondary-400">{formatDate(note.createdAt)}</span>
                {note.fileUrl && (
                  <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">📎 File</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex justify-center gap-2">
          {[...Array(pagination.pages)].map((_, i) => (
            <button key={i} onClick={() => setPage(i + 1)}
              className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${page === i + 1 ? 'bg-primary-500 text-white' : 'bg-white border border-secondary-200 text-secondary-600 hover:border-primary-300'}`}>
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title={selected?.topic || 'Lesson Note'} size="lg">
        {selected && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className="badge badge-info">{selected.subjectId?.name}</span>
              <span className="badge badge-gray">{selected.classId?.name}</span>
              <span className="badge badge-gray">Week {selected.week}</span>
              <span className="badge badge-gray">{selected.term?.charAt(0).toUpperCase() + selected.term?.slice(1)} Term</span>
            </div>
            <p className="text-xs text-secondary-400">By {selected.teacherId?.name} · {formatDate(selected.createdAt)}</p>

            {selected.content && (
              <div className="bg-secondary-50 rounded-xl p-4">
                <p className="text-sm text-secondary-700 whitespace-pre-wrap leading-relaxed">{selected.content}</p>
              </div>
            )}

            {selected.fileUrl && (
              <div>
                <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wide mb-2">Attachment</p>
                <FilePreview fileUrl={selected.fileUrl} fileName={selected.fileName} size="md" />
              </div>
            )}

            {!selected.content && !selected.fileUrl && (
              <p className="text-secondary-400 text-sm text-center py-6">No content available for this note</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
