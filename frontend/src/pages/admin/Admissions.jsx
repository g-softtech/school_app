import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import {
  FiUser, FiMail, FiPhone, FiSearch, FiCheckCircle,
  FiXCircle, FiEye, FiClock, FiFilter, FiMessageSquare,
} from 'react-icons/fi';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import PageSkeleton from '../../components/common/PageSkeleton';
import { formatDate, getErrorMessage } from '../../utils/helpers';

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   color: 'bg-amber-100 text-amber-700',  icon: FiClock       },
  reviewing: { label: 'Reviewing', color: 'bg-blue-100 text-blue-700',    icon: FiEye         },
  accepted:  { label: 'Accepted',  color: 'bg-green-100 text-green-700',  icon: FiCheckCircle },
  rejected:  { label: 'Rejected',  color: 'bg-red-100 text-red-600',      icon: FiXCircle     },
};

const TABS = ['all','pending','reviewing','accepted','rejected'];

export default function AdminAdmissions() {
  const [applications, setApplications] = useState([]);
  const [messages,     setMessages]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [selected,     setSelected]     = useState(null);
  const [activeTab,    setActiveTab]    = useState('all');
  const [mainTab,      setMainTab]      = useState('applications'); // applications | messages
  const [search,       setSearch]       = useState('');
  const [page,         setPage]         = useState(1);
  const [pagination,   setPagination]   = useState({});
  const [updating,     setUpdating]     = useState(false);
  const [updateForm,   setUpdateForm]   = useState({ status: '', adminNotes: '' });
  const [stats,        setStats]        = useState({});

  const loadApplications = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15 };
      if (activeTab !== 'all') params.status = activeTab;
      const res = await api.get('/contact/admissions', { params });
      setApplications(res.data.data || []);
      setPagination(res.data.pagination || {});

      // Compute stats from counts
      const all = await api.get('/contact/admissions', { params: { limit: 1000 } });
      const data = all.data.data || [];
      setStats({
        total:     data.length,
        pending:   data.filter(a => a.status === 'pending').length,
        accepted:  data.filter(a => a.status === 'accepted').length,
        rejected:  data.filter(a => a.status === 'rejected').length,
      });
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, [activeTab, page]);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/contact/messages', { params: { page, limit: 15 } });
      setMessages(res.data.data || []);
      setPagination(res.data.pagination || {});
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => {
    if (mainTab === 'applications') loadApplications();
    else loadMessages();
  }, [mainTab, loadApplications, loadMessages]);

  const openApplication = (app) => {
    setSelected(app);
    setUpdateForm({ status: app.status, adminNotes: app.adminNotes || '' });
  };

  const handleUpdate = async () => {
    if (!selected || !updateForm.status) return;
    setUpdating(true);
    try {
      await api.patch(`/contact/admissions/${selected._id}`, updateForm);
      toast.success(`Application ${updateForm.status}`);
      setSelected(null);
      loadApplications();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setUpdating(false); }
  };

  const handleMarkRead = async (id) => {
    try {
      await api.patch(`/contact/messages/${id}/read`);
      setMessages(prev => prev.map(m => m._id === id ? { ...m, isRead: true } : m));
    } catch {}
  };

  const filtered = applications.filter(a =>
    !search ||
    a.fullName?.toLowerCase().includes(search.toLowerCase()) ||
    a.parentName?.toLowerCase().includes(search.toLowerCase()) ||
    a.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <FiUser className="text-primary-500" size={22} /> Admissions & Enquiries
        </h1>
        <p className="page-subtitle">Manage admission applications and contact messages from the public website</p>
      </div>

      {/* Main tabs */}
      <div className="flex gap-1 bg-secondary-100 p-1 rounded-xl w-fit">
        {[
          { id: 'applications', label: `Applications (${stats.total || 0})` },
          { id: 'messages',     label: `Contact Messages (${messages.length || 0})` },
        ].map(t => (
          <button key={t.id} onClick={() => { setMainTab(t.id); setPage(1); }}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              mainTab === t.id ? 'bg-white text-secondary-800 shadow-sm' : 'text-secondary-500 hover:text-secondary-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── APPLICATIONS TAB ── */}
      {mainTab === 'applications' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total',    value: stats.total    || 0, color: 'text-secondary-800' },
              { label: 'Pending',  value: stats.pending  || 0, color: 'text-amber-600'     },
              { label: 'Accepted', value: stats.accepted || 0, color: 'text-green-600'     },
              { label: 'Rejected', value: stats.rejected || 0, color: 'text-red-500'       },
            ].map(s => (
              <div key={s.label} className="card text-center">
                <p className="text-xs text-secondary-500 mb-1">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="card p-4 flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" size={14} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by name or email…" className="input-field pl-9 py-1.5 text-sm w-full" />
            </div>
            <div className="flex gap-1 bg-secondary-100 p-1 rounded-xl">
              {TABS.map(t => (
                <button key={t} onClick={() => { setActiveTab(t); setPage(1); }}
                  className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${
                    activeTab === t ? 'bg-white text-secondary-800 shadow-sm' : 'text-secondary-500 hover:text-secondary-700'
                  }`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          {loading ? <PageSkeleton type="table" rows={8} /> : (
            <div className="card overflow-hidden p-0">
              {filtered.length === 0 ? (
                <div className="text-center py-14 text-secondary-400">
                  <FiUser size={32} className="mx-auto mb-3 opacity-40" />
                  <p className="font-medium">No applications found</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-secondary-50">
                      {['Student','Class','Parent','Contact','Applied','Status',''].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-secondary-50">
                    {filtered.map(app => {
                      const sc = STATUS_CONFIG[app.status] || STATUS_CONFIG.pending;
                      return (
                        <tr key={app._id} className="hover:bg-secondary-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-secondary-800">{app.fullName}</td>
                          <td className="px-4 py-3 text-secondary-600">{app.applyingFor}</td>
                          <td className="px-4 py-3 text-secondary-600">{app.parentName}</td>
                          <td className="px-4 py-3">
                            <p className="text-xs text-secondary-600">{app.email}</p>
                            <p className="text-xs text-secondary-400">{app.phone}</p>
                          </td>
                          <td className="px-4 py-3 text-xs text-secondary-400">{formatDate(app.createdAt)}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 w-fit ${sc.color}`}>
                              <sc.icon size={11} /> {sc.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button onClick={() => openApplication(app)}
                              className="text-xs text-primary-600 hover:underline font-medium">
                              Review
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex justify-center gap-2">
              {[...Array(pagination.pages)].map((_, i) => (
                <button key={i} onClick={() => setPage(i + 1)}
                  className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                    page === i + 1 ? 'bg-primary-500 text-white' : 'bg-white border border-secondary-200 text-secondary-600'
                  }`}>
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── MESSAGES TAB ── */}
      {mainTab === 'messages' && (
        <div className="space-y-3">
          {loading ? <PageSkeleton type="list" rows={6} /> :
           messages.length === 0 ? (
            <div className="card text-center py-14 text-secondary-400">
              <FiMessageSquare size={32} className="mx-auto mb-3 opacity-40" />
              <p className="font-medium">No contact messages yet</p>
            </div>
           ) : messages.map(msg => (
            <div key={msg._id}
              className={`card border-2 transition-all ${!msg.isRead ? 'border-primary-100 bg-primary-50/20' : 'border-secondary-100'}`}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${!msg.isRead ? 'bg-primary-100' : 'bg-secondary-100'}`}>
                    <FiMessageSquare size={16} className={!msg.isRead ? 'text-primary-500' : 'text-secondary-400'} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-sm ${!msg.isRead ? 'font-bold text-secondary-800' : 'font-medium text-secondary-700'}`}>
                        {msg.name}
                      </p>
                      {msg.subject && (
                        <span className="text-xs bg-secondary-100 text-secondary-600 px-2 py-0.5 rounded-full">{msg.subject}</span>
                      )}
                      {!msg.isRead && <span className="w-2 h-2 bg-primary-500 rounded-full" />}
                    </div>
                    <p className="text-xs text-secondary-400 mt-0.5">{msg.email} {msg.phone ? `· ${msg.phone}` : ''}</p>
                    <p className="text-sm text-secondary-600 mt-2 leading-relaxed">{msg.message}</p>
                    <p className="text-xs text-secondary-400 mt-2">{formatDate(msg.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {!msg.isRead && (
                    <button onClick={() => handleMarkRead(msg._id)}
                      className="text-xs text-primary-500 hover:underline font-medium">
                      Mark read
                    </button>
                  )}
                  <a href={`mailto:${msg.email}?subject=Re: ${msg.subject || 'Your Enquiry'}`}
                    className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1">
                    <FiMail size={12} /> Reply
                  </a>
                </div>
              </div>
            </div>
           ))
          }
        </div>
      )}

      {/* Application Review Modal */}
      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Review Application" size="md">
        {selected && (
          <div className="space-y-5">
            {/* Applicant details */}
            <div className="bg-secondary-50 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wide mb-3">Student Details</p>
              {[
                ['Full Name',    selected.fullName],
                ['Applying For', selected.applyingFor],
                ['Gender',       selected.gender],
                ['Date of Birth',selected.dateOfBirth ? formatDate(selected.dateOfBirth) : '—'],
              ].map(([k, v]) => v && (
                <div key={k} className="flex justify-between text-sm">
                  <span className="text-secondary-500">{k}</span>
                  <span className="font-medium text-secondary-800 capitalize">{v}</span>
                </div>
              ))}
            </div>

            <div className="bg-secondary-50 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wide mb-3">Parent/Guardian</p>
              {[
                ['Name',    selected.parentName],
                ['Email',   selected.email],
                ['Phone',   selected.phone],
                ['Address', selected.address],
              ].map(([k, v]) => v && (
                <div key={k} className="flex justify-between text-sm">
                  <span className="text-secondary-500">{k}</span>
                  <span className="font-medium text-secondary-800">{v}</span>
                </div>
              ))}
            </div>

            {selected.notes && (
              <div className="bg-secondary-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wide mb-1">Notes from Applicant</p>
                <p className="text-sm text-secondary-700">{selected.notes}</p>
              </div>
            )}

            {/* Status update */}
            <div className="border-t border-secondary-100 pt-4 space-y-3">
              <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wide">Update Status</p>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  <button key={key} onClick={() => setUpdateForm(f => ({ ...f, status: key }))}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                      updateForm.status === key
                        ? `${cfg.color} border-current`
                        : 'border-secondary-200 text-secondary-600 hover:border-secondary-300'
                    }`}>
                    <cfg.icon size={14} /> {cfg.label}
                  </button>
                ))}
              </div>
              <div>
                <label className="input-label">Admin Notes (sent to applicant on accept/reject)</label>
                <textarea value={updateForm.adminNotes}
                  onChange={e => setUpdateForm(f => ({ ...f, adminNotes: e.target.value }))}
                  rows={3} placeholder="Optional note to include in the decision email…"
                  className="input-field resize-none" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setSelected(null)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={handleUpdate} disabled={updating} className="btn-primary flex-1">
                  {updating ? 'Saving…' : 'Save Decision'}
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
