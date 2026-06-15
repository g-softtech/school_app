import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiUserCheck, FiMail, FiEye, FiEyeOff } from 'react-icons/fi';
import Modal from '../../components/common/Modal';
import Badge from '../../components/common/Badge';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Table from '../../components/common/Table';
import api from '../../services/api';
import { getErrorMessage } from '../../utils/helpers';

const EMPTY = { name: '', email: '', password: '', phone: '', qualification: '' };

export default function AdminTeachers() {
  const [teachers,    setTeachers]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [page,        setPage]        = useState(1);
  const [pagination,  setPagination]  = useState({});
  const [showModal,   setShowModal]   = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [editing,     setEditing]     = useState(null);
  const [deleting,    setDeleting]    = useState(null);
  const [saving,      setSaving]      = useState(false);
  const [form,        setForm]        = useState(EMPTY);
  const [showPass,    setShowPass]    = useState(false);

  const fetchTeachers = useCallback(async () => {
    setLoading(true);
    try {
      // Query User collection directly for role=teacher
      const res = await api.get('/auth/users', {
        params: { role: 'teacher', page, limit: 15, search: search || undefined },
      });
      setTeachers(res.data.data || []);
      setPagination(res.data.pagination || {});
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchTeachers(); }, [fetchTeachers]);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setShowModal(true); };
  const openEdit   = (t) => {
    setEditing(t);
    setForm({ name: t.name, email: t.email, password: '', phone: t.phone || '', qualification: t.qualification || '' });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email) { toast.error('Name and email are required'); return; }
    if (!editing && !form.password) { toast.error('Password is required for new teachers'); return; }
    setSaving(true);
    try {
      if (editing) {
        const payload = { name: form.name, phone: form.phone, qualification: form.qualification };
        if (form.password) payload.password = form.password;
        await api.patch(`/auth/users/${editing._id}`, payload);
        toast.success('Teacher updated');
      } else {
        await api.post('/auth/register', { ...form, role: 'teacher' });
        toast.success('Teacher account created');
      }
      setShowModal(false);
      fetchTeachers();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await api.delete(`/auth/users/${deleting._id}`);
      toast.success('Teacher removed');
      setShowConfirm(false);
      fetchTeachers();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (teacher) => {
    try {
      await api.patch(`/auth/users/${teacher._id}`, { isActive: !teacher.isActive });
      toast.success(teacher.isActive ? 'Teacher deactivated' : 'Teacher activated');
      fetchTeachers();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const filtered = teachers.filter(t =>
    !search ||
    t.name?.toLowerCase().includes(search.toLowerCase()) ||
    t.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Teachers</h1>
          <p className="page-subtitle">{pagination.total ?? teachers.length} teachers registered</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <FiPlus size={16} /> Add Teacher
        </button>
      </div>

      {/* Search */}
      <div className="card p-4">
        <div className="relative max-w-sm">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" size={15} />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name or email…"
            className="input-field pl-9 py-2 text-sm"
          />
        </div>
      </div>

      {/* Table */}
      <Table
        loading={loading}
        emptyMessage="No teachers found"
        columns={[
          { key: 'name', label: 'Name', render: (val, t) => (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-bold flex-shrink-0">
                  {t.name?.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                </div>
                <span className="font-medium text-secondary-800">{t.name}</span>
              </div>
            )
          },
          { key: 'email', label: 'Email', render: (val) => <span className="text-secondary-500 text-xs">{val}</span> },
          { key: 'phone', label: 'Phone', render: (val) => <span className="text-secondary-500 text-xs">{val || '—'}</span> },
          { key: 'qualification', label: 'Qualification', render: (val) => <span className="text-secondary-500 text-xs">{val || '—'}</span> },
          { key: 'isActive', label: 'Status', render: (val) => (
              <Badge variant={val !== false ? 'success' : 'danger'}>
                {val !== false ? 'Active' : 'Inactive'}
              </Badge>
            )
          },
          { key: 'actions', label: '', render: (_, t) => (
              <div className="flex items-center gap-1">
                <button onClick={() => handleToggleActive(t)}
                  className="p-1.5 hover:bg-secondary-100 rounded-lg transition-colors"
                  title={t.isActive !== false ? 'Deactivate' : 'Activate'}>
                  {t.isActive !== false
                    ? <FiEyeOff size={14} className="text-secondary-500" />
                    : <FiEye size={14} className="text-green-500" />}
                </button>
                <button onClick={() => openEdit(t)}
                  className="p-1.5 hover:bg-secondary-100 rounded-lg transition-colors">
                  <FiEdit2 size={14} className="text-secondary-500" />
                </button>
                <button onClick={() => { setDeleting(t); setShowConfirm(true); }}
                  className="p-1.5 hover:bg-red-50 rounded-lg transition-colors">
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
              className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                page === i + 1 ? 'bg-primary-500 text-white' : 'bg-white border border-secondary-200 text-secondary-600 hover:border-primary-300'
              }`}>
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Teacher' : 'Add New Teacher'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="input-label">Full Name *</label>
              <input className="input-field" value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Mr John Adeyemi" required />
            </div>
            <div>
              <label className="input-label">Email Address *</label>
              <input type="email" className="input-field" value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="teacher@school.com" required disabled={!!editing} />
              {editing && <p className="text-xs text-secondary-400 mt-1">Email cannot be changed</p>}
            </div>
            <div>
              <label className="input-label">Phone Number</label>
              <input className="input-field" value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="+234 800 000 0000" />
            </div>
            <div>
              <label className="input-label">Qualification</label>
              <input className="input-field" value={form.qualification}
                onChange={e => setForm({ ...form, qualification: e.target.value })}
                placeholder="e.g. B.Ed Mathematics, PGDE" />
            </div>
            <div className="sm:col-span-2">
              <label className="input-label">
                {editing ? 'New Password (leave blank to keep current)' : 'Password *'}
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  className="input-field pr-10"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  required={!editing}
                  minLength={6}
                />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-400 hover:text-secondary-600">
                  {showPass ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                </button>
              </div>
              {!editing && <p className="text-xs text-secondary-400 mt-1">Minimum 6 characters</p>}
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Teacher'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleDelete}
        loading={saving}
        title="Remove Teacher"
        message={`Remove ${deleting?.name} from the system? Their login access will be revoked.`}
      />
    </div>
  );
}
