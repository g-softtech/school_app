import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import {
  FiBell, FiAward, FiCreditCard, FiAlertCircle,
  FiInfo, FiMessageSquare, FiCheckSquare, FiTrash2,
} from 'react-icons/fi';
import { useNotifications } from '../../context/NotificationContext';
import { getMyNotifications, deleteNotification, markAllAsRead } from '../../services/notificationService';
import { getInbox } from '../../services/messageService';
import { formatDateTime, getErrorMessage } from '../../utils/helpers';

const TYPE_CONFIG = {
  announcement: { icon: FiBell,          color: 'text-primary-500',  bg: 'bg-primary-50',   label: 'Announcement' },
  result:       { icon: FiAward,         color: 'text-blue-600',     bg: 'bg-blue-50',      label: 'Result'       },
  payment:      { icon: FiCreditCard,    color: 'text-green-600',    bg: 'bg-green-50',     label: 'Payment'      },
  assignment:   { icon: FiAward,         color: 'text-purple-600',   bg: 'bg-purple-50',    label: 'Assignment'   },
  alert:        { icon: FiAlertCircle,   color: 'text-red-500',      bg: 'bg-red-50',       label: 'Alert'        },
  message:      { icon: FiMessageSquare, color: 'text-indigo-600',   bg: 'bg-indigo-50',    label: 'Message'      },
  general:      { icon: FiInfo,          color: 'text-secondary-500',bg: 'bg-secondary-100',label: 'General'      },
};

export default function Announcements() {
  const { unreadCount, markAllAsRead: ctxMarkAll, refresh } = useNotifications();
  const [notifications, setNotifications] = useState([]);
  const [broadcasts,    setBroadcasts]    = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [tab,           setTab]           = useState('notifications');
  const [page,          setPage]          = useState(1);
  const [pagination,    setPagination]    = useState({});

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMyNotifications({ page, limit: 15 });
      setNotifications(res.data.data || []);
      setPagination(res.data.pagination || {});
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, [page]);

  const loadBroadcasts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getInbox({ limit: 50 });
      setBroadcasts((res.data.data || []).filter((m) => m.isBroadcast));
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === 'notifications') loadNotifications();
    else loadBroadcasts();
  }, [tab, loadNotifications, loadBroadcasts]);

  const handleMarkAll = async () => {
    try {
      await markAllAsRead();
      await ctxMarkAll();
      loadNotifications();
      refresh();
      toast.success('All marked as read');
    } catch (err) { toast.error(getErrorMessage(err)); }
  };

  const handleDelete = async (id) => {
    try {
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      refresh();
    } catch (err) { toast.error(getErrorMessage(err)); }
  };

  const items = tab === 'notifications' ? notifications : broadcasts;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <FiBell className="text-primary-500" size={22} /> Announcements
          </h1>
          <p className="page-subtitle">All notifications and school announcements</p>
        </div>
        {tab === 'notifications' && unreadCount > 0 && (
          <button onClick={handleMarkAll} className="btn-secondary flex items-center gap-2 text-sm">
            <FiCheckSquare size={14} /> Mark All as Read
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary-100 p-1 rounded-xl w-fit">
        {[
          { id: 'notifications', label: `Notifications${unreadCount > 0 ? ` (${unreadCount})` : ''}` },
          { id: 'broadcasts',    label: 'Broadcasts' },
        ].map((t) => (
          <button key={t.id} onClick={() => { setTab(t.id); setPage(1); }}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-white text-secondary-800 shadow-sm' : 'text-secondary-500 hover:text-secondary-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => <div key={i} className="card h-16 animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="card text-center py-16 text-secondary-400">
          <FiBell size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No {tab} yet</p>
          <p className="text-xs mt-1">They will appear here when available</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const isNotif = tab === 'notifications';
            const type    = isNotif ? item.type : 'announcement';
            const cfg     = TYPE_CONFIG[type] || TYPE_CONFIG.general;
            const isUnread = !item.isRead;
            return (
              <div key={item._id}
                className={`card flex items-start gap-4 border-2 transition-all duration-200 ${
                  isUnread ? 'border-primary-100 bg-primary-50/20' : 'border-secondary-100'
                }`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                  <cfg.icon size={18} className={cfg.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className={`text-sm truncate ${isUnread ? 'font-bold text-secondary-800' : 'font-medium text-secondary-700'}`}>
                        {isNotif ? item.title : (item.subject || 'School Announcement')}
                      </p>
                      <p className="text-sm text-secondary-500 mt-0.5 line-clamp-2">
                        {isNotif ? item.message : item.content}
                      </p>
                    </div>
                    {isUnread && <span className="w-2.5 h-2.5 bg-primary-500 rounded-full flex-shrink-0 mt-1.5" />}
                  </div>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${cfg.bg} ${cfg.color}`}>
                      {cfg.label}
                    </span>
                    <span className="text-xs text-secondary-400">{formatDateTime(item.createdAt)}</span>
                    {!isNotif && item.senderId?.name && (
                      <span className="text-xs text-secondary-400">From: {item.senderId.name}</span>
                    )}
                  </div>
                </div>
                {isNotif && (
                  <button onClick={() => handleDelete(item._id)}
                    className="p-1.5 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0">
                    <FiTrash2 size={14} className="text-red-400" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'notifications' && pagination.pages > 1 && (
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
    </div>
  );
}
