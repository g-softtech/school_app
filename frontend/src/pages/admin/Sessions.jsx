import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import {
  FiPlus, FiEdit2, FiTrash2, FiCalendar, FiCheckCircle,
  FiStar, FiChevronDown, FiChevronUp, FiClock,
} from 'react-icons/fi';
import {
  getSessions, createSession, updateSession,
  deleteSession, setCurrentSession,
} from '../../services/academicService';
import Modal from '../../components/common/Modal';
import { formatDate, getErrorMessage } from '../../utils/helpers';

const TERMS = [
  { key: 'first',  label: 'First Term'  },
  { key: 'second', label: 'Second Term' },
  { key: 'third',  label: 'Third Term'  },
];

const EMPTY_SESSION = {
  name: '', startDate: '', endDate: '', isCurrent: false,
  terms: TERMS.map((t) => ({ name: t.key, startDate: '', endDate: '', isActive: false })),
};

export default function AdminSessions() {
  const [sessions,    setSessions]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [showModal,   setShowModal]   = useState(false);
  const [editing,     setEditing]     = useState(null);
  const [form,        setForm]        = useState(EMPTY_SESSION);
  const [expanded,    setExpanded]    = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getSessions();
      setSessions(res.data.data || []);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_SESSION);
    setShowModal(true);
  };

  const openEdit = (s) => {
    setEditing(s);
    setForm({
      name:      s.name,
      startDate: s.startDate?.slice(0, 10) || '',
      endDate:   s.endDate?.slice(0, 10)   || '',
      isCurrent: s.isCurrent,
      terms: TERMS.map((t) => {
        const existing = s.terms?.find((x) => x.name === t.key);
        return {
          name:      t.key,
          startDate: existing?.startDate?.slice(0, 10) || '',
          endDate:   existing?.endDate?.slice(0, 10)   || '',
          isActive:  existing?.isActive || false,
        };
      }),
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name || !form.startDate || !form.endDate) {
      toast.error('Session name, start date and end date are required'); return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateSession(editing._id, form);
        toast.success('Session updated');
      } else {
        await createSession(form);
        toast.success('Session created');
      }
      setShowModal(false);
      load();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  const handleDelete = async (s) => {
    if (!window.confirm(`Delete session "${s.name}"? This cannot be undone.`)) return;
    try {
      await deleteSession(s._id);
      toast.success('Session deleted');
      load();
    } catch (err) { toast.error(getErrorMessage(err)); }
  };

  const handleSetCurrent = async (s) => {
    try {
      await setCurrentSession(s._id);
      toast.success(`${s.name} is now the current session`);
      load();
    } catch (err) { toast.error(getErrorMessage(err)); }
  };

  const updateTermField = (index, field, value) => {
    setForm((prev) => {
      const terms = [...prev.terms];
      terms[index] = { ...terms[index], [field]: value };
      return { ...prev, terms };
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <FiCalendar className="text-primary-500" size={22} /> Academic Sessions
          </h1>
          <p className="page-subtitle">Manage academic sessions and term dates</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <FiPlus size={16} /> New Session
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Sessions',  value: sessions.length, color: 'text-secondary-800' },
          { label: 'Current Session', value: sessions.find((s) => s.isCurrent)?.name || '—', color: 'text-primary-600' },
          { label: 'Active Sessions', value: sessions.filter((s) => s.isActive).length, color: 'text-green-600' },
        ].map((stat) => (
          <div key={stat.label} className="card text-center">
            <p className="text-xs text-secondary-500 mb-1">{stat.label}</p>
            <p className={`text-xl font-bold truncate ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Sessions list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="card h-20 animate-pulse" />)}
        </div>
      ) : sessions.length === 0 ? (
        <div className="card text-center py-16 text-secondary-400">
          <FiCalendar size={36} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">No academic sessions yet</p>
          <p className="text-xs mt-1">Click "New Session" to create the first one</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => {
            const isExpanded = expanded === s._id;
            return (
              <div key={s._id} className={`card border-2 transition-all duration-200 ${s.isCurrent ? 'border-primary-300 bg-primary-50/30' : 'border-secondary-100'}`}>
                {/* Session header */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${s.isCurrent ? 'bg-primary-500 text-white' : 'bg-secondary-100 text-secondary-500'}`}>
                      <FiCalendar size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-secondary-800">{s.name}</p>
                        {s.isCurrent && (
                          <span className="text-xs bg-primary-500 text-white px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                            <FiStar size={10} /> Current
                          </span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.isActive ? 'bg-green-100 text-green-700' : 'bg-secondary-100 text-secondary-500'}`}>
                          {s.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="text-xs text-secondary-400 mt-0.5">
                        {formatDate(s.startDate)} → {formatDate(s.endDate)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {!s.isCurrent && (
                      <button onClick={() => handleSetCurrent(s)}
                        className="flex items-center gap-1.5 text-xs bg-primary-50 hover:bg-primary-100 text-primary-700 px-3 py-1.5 rounded-lg transition-colors font-medium"
                        title="Set as current session"
                      >
                        <FiCheckCircle size={13} /> Set Current
                      </button>
                    )}
                    <button onClick={() => setExpanded(isExpanded ? null : s._id)}
                      className="p-1.5 hover:bg-secondary-100 rounded-lg transition-colors text-secondary-500"
                      title="View terms">
                      {isExpanded ? <FiChevronUp size={15} /> : <FiChevronDown size={15} />}
                    </button>
                    <button onClick={() => openEdit(s)} className="p-1.5 hover:bg-secondary-100 rounded-lg transition-colors">
                      <FiEdit2 size={14} className="text-secondary-500" />
                    </button>
                    <button onClick={() => handleDelete(s)} className="p-1.5 hover:bg-red-50 rounded-lg transition-colors">
                      <FiTrash2 size={14} className="text-red-400" />
                    </button>
                  </div>
                </div>

                {/* Expanded: terms */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-secondary-100">
                    <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                      <FiClock size={12} className="text-primary-500" /> Term Dates
                    </p>
                    {s.terms?.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {s.terms.map((t) => (
                          <div key={t._id} className={`p-3 rounded-xl border ${t.isActive ? 'bg-green-50 border-green-200' : 'bg-secondary-50 border-secondary-200'}`}>
                            <p className="text-xs font-bold text-secondary-700 capitalize mb-1">
                              {t.name} Term
                              {t.isActive && <span className="ml-1.5 text-green-600">(Active)</span>}
                            </p>
                            <p className="text-xs text-secondary-500">
                              {t.startDate ? formatDate(t.startDate) : '—'} → {t.endDate ? formatDate(t.endDate) : '—'}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-secondary-400 italic">No term dates set — click edit to add them.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Session' : 'New Academic Session'} size="lg">
        <form onSubmit={handleSave} className="space-y-5">
          {/* Session details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="input-label">Session Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. 2025/2026" className="input-field" required />
            </div>
            <div>
              <label className="input-label">Start Date *</label>
              <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="input-field" required />
            </div>
            <div>
              <label className="input-label">End Date *</label>
              <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="input-field" required />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input type="checkbox" id="isCurrent" checked={form.isCurrent}
              onChange={(e) => setForm({ ...form, isCurrent: e.target.checked })}
              className="w-4 h-4 accent-primary-500" />
            <label htmlFor="isCurrent" className="text-sm text-secondary-700 cursor-pointer">
              Set as current session <span className="text-secondary-400">(replaces any existing current session)</span>
            </label>
          </div>

          {/* Term dates */}
          <div>
            <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wide mb-3 border-t border-secondary-100 pt-4">
              Term Dates (optional)
            </p>
            <div className="space-y-3">
              {TERMS.map((t, i) => (
                <div key={t.key} className="p-3 bg-secondary-50 rounded-xl border border-secondary-200">
                  <p className="text-xs font-semibold text-secondary-700 mb-2 capitalize">{t.label}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="input-label">Start Date</label>
                      <input type="date" value={form.terms[i]?.startDate || ''}
                        onChange={(e) => updateTermField(i, 'startDate', e.target.value)}
                        className="input-field py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="input-label">End Date</label>
                      <input type="date" value={form.terms[i]?.endDate || ''}
                        onChange={(e) => updateTermField(i, 'endDate', e.target.value)}
                        className="input-field py-1.5 text-sm" />
                    </div>
                    <div className="flex items-end pb-0.5">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={form.terms[i]?.isActive || false}
                          onChange={(e) => updateTermField(i, 'isActive', e.target.checked)}
                          className="w-4 h-4 accent-primary-500" />
                        <span className="text-xs text-secondary-600">Active term</span>
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Saving…' : editing ? 'Update Session' : 'Create Session'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
