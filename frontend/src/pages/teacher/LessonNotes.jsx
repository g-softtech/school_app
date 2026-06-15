import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { FiFileText, FiPlus, FiEdit2, FiTrash2, FiSearch, FiEye, FiEyeOff } from 'react-icons/fi';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import FileUpload from '../../components/common/FileUpload';
import FilePreview from '../../components/common/FilePreview';
import Table from '../../components/common/Table';
import { TERMS, SESSIONS } from '../../utils/constants';
import { formatDate, getErrorMessage } from '../../utils/helpers';

const EMPTY_FORM = { classId: '', subjectId: '', topic: '', week: '', term: 'first', session: '2025/2026', content: '', isPublished: true };

export default function TeacherLessonNotes() {
  const [notes, setNotes]         = useState([]);
  const [classes, setClasses]     = useState([]);
  const [subjects, setSubjects]   = useState([]);
  const [filteredSubjects, setFilteredSubjects] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showView, setShowView]   = useState(false);
  const [editNote, setEditNote]   = useState(null);
  const [viewNote, setViewNote]   = useState(null);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [file, setFile]           = useState(null);
  const [search, setSearch]       = useState('');
  const [term, setTerm]           = useState('');
  const [session, setSession]     = useState('2025/2026');
  const [pagination, setPagination] = useState({});
  const [page, setPage]           = useState(1);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/lesson-notes', {
        params: { term: term || undefined, session, page, limit: 10 },
      });
      setNotes(res.data.data || []);
      setPagination(res.data.pagination || {});
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, [term, session, page]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  useEffect(() => {
    async function loadMeta() {
      const [clRes, subRes] = await Promise.allSettled([
        api.get('/classes',  { params: { limit: 100 } }),
        api.get('/subjects', { params: { limit: 200 } }),
      ]);
      if (clRes.status  === 'fulfilled') setClasses(clRes.value.data.data || []);
      if (subRes.status === 'fulfilled') setSubjects(subRes.value.data.data || []);
    }
    loadMeta();
  }, []);

  // Filter subjects based on selected class
  useEffect(() => {
    if (!form.classId) {
      setFilteredSubjects(subjects);
    } else {
      setFilteredSubjects(subjects.filter((s) => (s.classId?._id || s.classId) === form.classId));
    }
  }, [form.classId, subjects]);

  const openCreate = () => {
    setEditNote(null);
    setForm(EMPTY_FORM);
    setFile(null);
    setShowModal(true);
  };

  const openEdit = (note) => {
    setEditNote(note);
    setForm({
      classId:     note.classId?._id   || note.classId   || '',
      subjectId:   note.subjectId?._id || note.subjectId || '',
      topic:       note.topic,
      week:        note.week,
      term:        note.term,
      session:     note.session,
      content:     note.content || '',
      isPublished: note.isPublished,
    });
    setFile(null);
    setShowModal(true);
  };

  const openView = (note) => {
    setViewNote(note);
    setShowView(true);
  };

  const handleSave = async () => {
    if (!form.classId || !form.subjectId || !form.topic || !form.week || !form.term) {
      toast.error('Please fill in all required fields'); return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (file) fd.append('file', file);

      if (editNote) {
        await api.patch(`/lesson-notes/${editNote._id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success('Lesson note updated!');
      } else {
        await api.post('/lesson-notes', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success('Lesson note created!');
      }
      setShowModal(false);
      fetchNotes();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this lesson note?')) return;
    setDeleting(id);
    try {
      await api.delete(`/lesson-notes/${id}`);
      toast.success('Deleted');
      fetchNotes();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setDeleting(null); }
  };

  const togglePublish = async (note) => {
    try {
      await api.patch(`/lesson-notes/${note._id}`, { isPublished: !note.isPublished });
      toast.success(note.isPublished ? 'Note unpublished' : 'Note published to students');
      fetchNotes();
    } catch (err) { toast.error(getErrorMessage(err)); }
  };

  const filtered = notes.filter((n) =>
    !search ||
    n.topic.toLowerCase().includes(search.toLowerCase()) ||
    n.subjectId?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const fc = (e) => setForm((p) => ({
    ...p,
    [e.target.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Lesson Notes</h1>
          <p className="page-subtitle">Create, manage and publish lesson notes to students</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <FiPlus size={16} /> New Note
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-0 min-w-48">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" size={14} />
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

      {/* Table */}
      <Table
        loading={loading}
        emptyMessage="No lesson notes found. Click 'New Note' to create your first lesson note."
        columns={[
          { key: 'topic', label: 'Topic', render: (val) => <span className="font-medium text-secondary-800 max-w-44 truncate">{val}</span> },
          { key: 'subjectId', label: 'Subject', render: (val) => <span className="text-secondary-600">{val?.name || '—'}</span> },
          { key: 'classId', label: 'Class', render: (val) => <span className="text-secondary-600">{val?.name || '—'}</span> },
          { key: 'week', label: 'Week', render: (val) => <span className="text-secondary-600">{val}</span> },
          { key: 'term', label: 'Term', render: (val) => <span className="capitalize text-secondary-600">{val}</span> },
          { key: 'fileUrl', label: 'File', render: (val) => val ? <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">📎 Yes</span> : <span className="text-xs text-secondary-300">—</span> },
          { key: 'isPublished', label: 'Status', render: (val) => <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${val ? 'bg-green-100 text-green-700' : 'bg-secondary-100 text-secondary-500'}`}>{val ? 'Published' : 'Draft'}</span> },
          { key: 'createdAt', label: 'Date', render: (val) => <span className="text-secondary-500 text-xs">{formatDate(val)}</span> },
          { key: 'actions', label: '', render: (_, n) => (
              <div className="flex items-center gap-1 justify-end">
                <button onClick={() => openView(n)} className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors" title="View">
                  <FiFileText size={14} className="text-blue-500" />
                </button>
                <button onClick={() => togglePublish(n)} className="p-1.5 hover:bg-secondary-100 rounded-lg transition-colors" title={n.isPublished ? 'Unpublish' : 'Publish'}>
                  {n.isPublished ? <FiEyeOff size={14} className="text-secondary-500" /> : <FiEye size={14} className="text-green-600" />}
                </button>
                <button onClick={() => openEdit(n)} className="p-1.5 hover:bg-secondary-100 rounded-lg transition-colors">
                  <FiEdit2 size={14} className="text-secondary-500" />
                </button>
                <button onClick={() => handleDelete(n._id)} disabled={deleting === n._id} className="p-1.5 hover:bg-red-50 rounded-lg transition-colors">
                  <FiTrash2 size={14} className="text-red-400" />
                </button>
              </div>
            )
          }
        ]}
        data={filtered}
      />

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

      {/* View Modal */}
      <Modal isOpen={showView} onClose={() => setShowView(false)} title={viewNote?.topic || 'Lesson Note'} size="lg">
        {viewNote && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className="badge badge-info">{viewNote.subjectId?.name}</span>
              <span className="badge badge-gray">{viewNote.classId?.name}</span>
              <span className="badge badge-gray">Week {viewNote.week}</span>
              <span className="badge badge-gray capitalize">{viewNote.term} Term</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${viewNote.isPublished ? 'bg-green-100 text-green-700' : 'bg-secondary-100 text-secondary-500'}`}>
                {viewNote.isPublished ? 'Published' : 'Draft'}
              </span>
            </div>
            <p className="text-xs text-secondary-400">{formatDate(viewNote.createdAt)}</p>

            {viewNote.content && (
              <div className="bg-secondary-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wide mb-2">Content</p>
                <p className="text-sm text-secondary-700 whitespace-pre-wrap leading-relaxed">{viewNote.content}</p>
              </div>
            )}

            {viewNote.fileUrl && (
              <div>
                <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wide mb-2">Attached File</p>
                <FilePreview fileUrl={viewNote.fileUrl} fileName={viewNote.fileName} size="md" />
              </div>
            )}

            {!viewNote.content && !viewNote.fileUrl && (
              <p className="text-secondary-400 text-sm text-center py-6">No content added yet</p>
            )}
          </div>
        )}
      </Modal>

      {/* Create/Edit Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editNote ? 'Edit Lesson Note' : 'New Lesson Note'} size="lg">
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
              </select>
              {form.classId && filteredSubjects.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">No subjects assigned to this class yet</p>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="input-label">Topic <span className="text-red-500">*</span></label>
              <input name="topic" value={form.topic} onChange={fc} placeholder="e.g. Photosynthesis in Plants" className="input-field" />
            </div>
            <div>
              <label className="input-label">Week <span className="text-red-500">*</span></label>
              <input name="week" type="number" min="1" max="14" value={form.week} onChange={fc} placeholder="1 – 14" className="input-field" />
            </div>
            <div>
              <label className="input-label">Term <span className="text-red-500">*</span></label>
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
            <div className="flex items-center gap-3 pt-4">
              <input type="checkbox" id="pub" name="isPublished" checked={form.isPublished} onChange={fc} className="w-4 h-4 accent-primary-500" />
              <label htmlFor="pub" className="text-sm text-secondary-700 cursor-pointer">
                Publish immediately <span className="text-secondary-400">(visible to students)</span>
              </label>
            </div>
          </div>

          <div>
            <label className="input-label">Content</label>
            <textarea name="content" value={form.content} onChange={fc} rows={5} placeholder="Write lesson content here. Students will see this in their Lesson Notes page." className="input-field resize-none" />
          </div>

          {/* File upload using FileUpload component */}
          <FileUpload
            value={file}
            onChange={setFile}
            label="Attach File (optional)"
            placeholder="Upload a PDF, Word doc, image or any resource"
            existingFileName={editNote?.fileName}
            maxSizeMB={20}
          />

          {/* Preview existing file if editing */}
          {editNote?.fileUrl && !file && (
            <div>
              <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wide mb-2">Current File</p>
              <FilePreview fileUrl={editNote.fileUrl} fileName={editNote.fileName} size="sm" />
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowModal(false)} className="btn-secondary flex-1 min-w-0">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 min-w-0">
              {saving ? 'Saving…' : editNote ? 'Save Changes' : 'Create Note'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
