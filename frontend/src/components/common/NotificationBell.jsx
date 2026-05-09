import { useState, useRef, useEffect } from 'react';
import { FiBell, FiX, FiCheck, FiTrash2, FiInfo, FiAlertCircle, FiAward, FiCreditCard, FiMessageSquare } from 'react-icons/fi';
import { useNotifications } from '../../context/NotificationContext';
import { formatDateTime } from '../../utils/helpers';

const TYPE_CONFIG = {
  result:       { icon: FiAward,         color: 'text-blue-500',    bg: 'bg-blue-50'    },
  payment:      { icon: FiCreditCard,    color: 'text-green-600',   bg: 'bg-green-50'   },
  announcement: { icon: FiBell,          color: 'text-primary-500', bg: 'bg-primary-50' },
  message:      { icon: FiMessageSquare, color: 'text-purple-500',  bg: 'bg-purple-50'  },
  alert:        { icon: FiAlertCircle,   color: 'text-red-500',     bg: 'bg-red-50'     },
  general:      { icon: FiInfo,          color: 'text-secondary-500',bg:'bg-secondary-100'},
};

export default function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="relative p-2 rounded-lg hover:bg-secondary-100 text-secondary-500 transition-colors"
        aria-label="Notifications"
      >
        <FiBell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none animate-pulse-dot">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-xl border border-secondary-100 z-50 overflow-hidden notif-dropdown">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-secondary-100">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-secondary-800 text-sm">Notifications</p>
              {unreadCount > 0 && (
                <span className="bg-red-100 text-red-600 text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-primary-500 hover:text-primary-600 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-primary-50 transition-colors"
                >
                  <FiCheck size={12} /> All read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 hover:bg-secondary-100 rounded-lg transition-colors">
                <FiX size={15} className="text-secondary-400" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-secondary-50">
            {notifications.length === 0 ? (
              <div className="text-center py-10">
                <FiBell size={28} className="mx-auto text-secondary-200 mb-2" />
                <p className="text-sm text-secondary-400">No notifications</p>
              </div>
            ) : (
              notifications.map((n) => {
                const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.general;
                return (
                  <div
                    key={n._id}
                    className={`flex items-start gap-3 px-4 py-3 hover:bg-secondary-50 transition-colors cursor-pointer group ${!n.isRead ? 'bg-blue-50/40' : ''}`}
                    onClick={() => !n.isRead && markAsRead(n._id)}
                  >
                    <div className={`w-8 h-8 rounded-xl ${cfg.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                      <cfg.icon size={14} className={cfg.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-tight ${!n.isRead ? 'font-semibold text-secondary-800' : 'text-secondary-700'}`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-secondary-500 mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-xs text-secondary-400 mt-1">{formatDateTime(n.createdAt)}</p>
                    </div>
                    <div className="flex flex-col gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!n.isRead && (
                        <button
                          onClick={(e) => { e.stopPropagation(); markAsRead(n._id); }}
                          className="p-1 hover:bg-blue-100 rounded-md transition-colors"
                          title="Mark as read"
                        >
                          <FiCheck size={12} className="text-blue-500" />
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteNotification(n._id); }}
                        className="p-1 hover:bg-red-100 rounded-md transition-colors"
                        title="Delete"
                      >
                        <FiTrash2 size={12} className="text-red-400" />
                      </button>
                    </div>
                    {!n.isRead && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-secondary-100 px-4 py-2.5 text-center">
              <p className="text-xs text-secondary-400">
                {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
