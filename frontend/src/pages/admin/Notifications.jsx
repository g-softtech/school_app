import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import {
  FiBell, FiSend, FiRadio, FiTrash2, FiCheckSquare,
  FiSearch, FiFilter, FiAlertCircle, FiInfo, FiAward, FiCreditCard, FiMessageSquare,
} from 'react-icons/fi';
import { useNotifications } from '../../context/NotificationContext';
import { sendNotification, getMyNotifications, deleteNotification, markAllAsRead } from '../../services/notificationService';
import Modal from '../../components/common/Modal';
import PageSkeleton from '../../components/common/PageSkeleton';
import { formatDateTime, getErrorMessage } from '../../utils/helpers';

const TYPE_OPTIONS = [
  { value: 'announcement', label: 'Announcement', icon: FiBell,        color: 'bg-primary-50 text-primary-600' },
  { value: 'result',       label: 'Result',       icon: FiAward,       color: 'bg-blue-50 text-blue-600'     },
  { value: 'payment',      label: 'Payment',      icon: FiCreditCard,  color: 'bg-green-50 text-green-600'   },
  { value: 'alert',        label: 'Alert',        icon: FiAlertCircle, color: 'bg-red-50 text-red-600'       },
  { value: 'general',      label: 'General',      icon: FiInfo,        color: 'bg-secondary-100 text-secondary-600' },
];

const ROLE_OPTIONS = ['student', 'teacher', 'parent', 'admin'];

const TYPE_ICON = {
  announcement: FiBell,
  result:       FiAward,
  payment:      FiCreditCard,
  alert:        FiAlertCircle,
  message:      FiMessageSquare,
  general:      FiInfo,
};

const TYPE_COLOR = {
  announcement: 'bg-primary-50 text-primary-600',
  result:       'bg-blue-50 text-blue-600',
  payment:      'bg-green-50 text-green-600',
  alert:        'bg-red-50 text-red-600',
  message:      'bg-purple-50 text-purple-600',
  general:      'bg-secondary-100 text-secondary-600',
};

const EMPTY_FORM = { title: '', message: '', targetRole: 'student', type: 'announcement', sendEmail: false };

export default function AdminNotifications() {
  const { unreadCount, refresh } = useNotifications();
  const [notifications, setNotifications] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [sending,       setSending]       = useState(false);
  const [showModal,     setShowModal]     = useState(false);
  const [form,          setForm]          = useState(EMPTY_FORM);
  const [search,        setSearch]        = useState('');
  const [typeFilter,    setTypeFilter]    = useState('');
  const [page,          setPage]          = useState(1);
  const [pagination,    setPagination]    = useState({});
  const [stats,         setStats]         = useState({ total: 0, unread: 0, sent: 0 });

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMyNotifications({
        page,
        limit: 15,
        type: typeFilter || undefined,
      });
      setNotifications(res.data.data || []);
      setPagination(res.data.pagination || {});
      setStats({
        total:  res.data.pagination?.total || 0,
        unread: res.data.unreadCount || 0,
        sent:   0,
      });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!form.title || !form.message) { toast.error('Title and message are required'); return; }
    setSending(true);
    try {
      const res = await sendNotification(form);
      toast.success(res.data.message);
      setShowModal(false);
      setForm(EMPTY_FORM);
      fetchNotifications();
      refresh(); // update bell count
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this notification?')) return;
    try {
      await deleteNotification(id);
      toast.success('Deleted');
      fetchNotifications();
      refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead();
      toast.success('All notifications marked as read');
      fetchNotifications();
      refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const filtered = notifications.filter((n) =>
    !search ||
    n.title?.toLowerCase().includes(search.toLowerCase()) ||
    n.message?.toLowerCase().includes(search.toLowerCase())
  );

  const fc = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <FiBell className="text-primary-500" size={22} /> Notifications
          </h1>
          <p className="page-subtitle">Send announcements and manage in-app notifications</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <FiRadio size={15} /> Send Notification
        </button>
      </div>

      {/* Quick link to view received notifications */}
      <div className="flex gap-1 bg-secondary-100 p-1 rounded-xl w-fit mb-0">
        <div className="px-4 py-1.5 rounded-lg text-sm font-medium bg-white text-secondary-800 shadow-sm">
          Sent / Broadcast
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Received',  value: stats.total,  color: 'text-secondary-800' },
          { label: 'Unread',          value: unreadCount,  color: 'text-red-500' },
          { label: 'Notification Types', value: TYPE_OPTIONS.length, color: 'text-blue-600' },
        ].map((s) => (
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
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notifications…"
            className="input-field pl-9 py-1.5 text-sm w-full"
          />
        </div>
        <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} className="input-field py-1.5 text-sm w-36">
          <option value="">All Types</option>
          {TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        {unreadCount > 0 && (
          <button onClick={handleMarkAllRead} className="btn-secondary flex items-center gap-2 text-sm">
            <FiCheckSquare size={14} /> Mark All Read
          </button>
        )}
      </div>

      {/* Notifications list */}
      {loading ? (
        <PageSkeleton type="list" rows={8} />
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16 text-secondary-400">
          <FiBell size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No notifications found</p>
          <p className="text-xs mt-1">Click "Send Notification" to create one</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="divide-y divide-secondary-50">
            {filtered.map((n) => {
              const Icon  = TYPE_ICON[n.type]  || FiInfo;
              const color = TYPE_COLOR[n.type] || TYPE_COLOR.general;
              return (
                <div key={n._id} className={`flex items-start gap-4 px-5 py-4 hover:bg-secondary-50 transition-colors ${!n.isRead ? 'bg-blue-50/40' : ''}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${color}`}>
                    <Icon size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className={`text-sm truncate ${!n.isRead ? 'font-bold text-secondary-800' : 'font-medium text-secondary-700'}`}>
                          {n.title}
                        </p>
                        <p className="text-sm text-secondary-500 mt-0.5 line-clamp-2">{n.message}</p>
                      </div>
                      {!n.isRead && (
                        <span className="w-2.5 h-2.5 bg-blue-500 rounded-full flex-shrink-0 mt-1.5" />
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${color}`}>
                        {n.type}
                      </span>
                      <span className="text-xs text-secondary-400">{formatDateTime(n.createdAt)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(n._id)}
                    className="p-1.5 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0 mt-0.5"
                    title="Delete"
                  >
                    <FiTrash2 size={14} className="text-red-400" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex justify-center gap-2">
          {[...Array(pagination.pages)].map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i + 1)}
              className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                page === i + 1 ? 'bg-primary-500 text-white' : 'bg-white border border-secondary-200 text-secondary-600 hover:border-primary-300'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* Send Notification Modal */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setForm(EMPTY_FORM); }} title="Send Notification" size="md">
        <form onSubmit={handleSend} className="space-y-4">
          {/* Info box */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 flex items-start gap-2">
            <FiAlertCircle size={13} className="flex-shrink-0 mt-0.5" />
            <p>This sends an in-app notification to <strong>all active users</strong> of the selected role. It will appear in their notification bell instantly.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Send To (Role) *</label>
              <select name="targetRole" value={form.targetRole} onChange={fc} className="input-field capitalize">
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}s</option>
                ))}
              </select>
            </div>
            <div>
              <label className="input-label">Notification Type</label>
              <select name="type" value={form.type} onChange={fc} className="input-field capitalize">
                {TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 col-span-2 py-1">
            <input type="checkbox" id="sendEmail" checked={form.sendEmail}
              onChange={(e) => setForm({ ...form, sendEmail: e.target.checked })}
              className="w-4 h-4 accent-primary-500" />
            <label htmlFor="sendEmail" className="text-sm text-secondary-700 cursor-pointer">
              Also send by <strong>email</strong> to all recipients
              <span className="text-secondary-400 text-xs ml-1">(requires SMTP configured in backend)</span>
            </label>
          </div>

          <div>
            <label className="input-label">Title *</label>
            <input
              name="title"
              value={form.title}
              onChange={fc}
              placeholder="e.g. First Term Results Released"
              className="input-field"
              required
            />
          </div>

          <div>
            <label className="input-label">Message *</label>
            <textarea
              name="message"
              value={form.message}
              onChange={fc}
              rows={4}
              placeholder="Write your notification message here…"
              className="input-field resize-none"
              required
            />
          </div>

          {/* Preview */}
          {form.title && form.message && (
            <div className="p-3 bg-secondary-50 rounded-xl border border-secondary-200">
              <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wide mb-2">Preview</p>
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${TYPE_COLOR[form.type] || TYPE_COLOR.general}`}>
                  {(() => { const I = TYPE_ICON[form.type] || FiInfo; return <I size={14} />; })()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-secondary-800">{form.title}</p>
                  <p className="text-xs text-secondary-500 mt-0.5">{form.message}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setShowModal(false); setForm(EMPTY_FORM); }} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={sending} className="btn-primary flex-1 flex items-center justify-center gap-2">
              <FiSend size={14} />
              {sending ? 'Sending…' : `Send to All ${form.targetRole.charAt(0).toUpperCase() + form.targetRole.slice(1)}s`}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
