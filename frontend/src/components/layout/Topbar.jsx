import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMenu, FiBell, FiSearch, FiX } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { getInitials } from '../../utils/helpers';

const ROLE_HOME = {
  admin: '/admin', teacher: '/teacher', student: '/student', parent: '/parent',
};

export default function Topbar({ onMenuClick, pageTitle }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread]       = useState(0);
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await api.get('/messages/unread-count');
        setUnread(res.data.unreadCount || 0);
      } catch {}
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  const goToMessages = () => {
    const path = ROLE_HOME[user?.role];
    navigate(`${path}/messages`);
  };

  return (
    <header className="h-16 bg-white border-b border-secondary-100 flex items-center px-4 gap-3 flex-shrink-0 shadow-sm">

      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg hover:bg-secondary-100 text-secondary-600 transition-colors"
      >
        <FiMenu size={20} />
      </button>

      {/* Page title */}
      <div className="flex-1 min-w-0">
        <h2 className="text-base font-semibold text-secondary-800 truncate">
          {pageTitle || 'Dashboard'}
        </h2>
        <p className="text-xs text-secondary-400 hidden sm:block">
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1">

        {/* Search toggle */}
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="p-2 rounded-lg hover:bg-secondary-100 text-secondary-500 transition-colors hidden sm:flex"
        >
          {showSearch ? <FiX size={18} /> : <FiSearch size={18} />}
        </button>

        {/* Notifications */}
        <button
          onClick={goToMessages}
          className="relative p-2 rounded-lg hover:bg-secondary-100 text-secondary-500 transition-colors"
        >
          <FiBell size={18} />
          {unread > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>

        {/* User avatar */}
        <div className="flex items-center gap-2 ml-1 pl-3 border-l border-secondary-100">
          <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center text-white text-xs font-bold">
            {getInitials(user?.name)}
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-medium text-secondary-800 leading-tight">
              {user?.name?.split(' ')[0]}
            </p>
            <p className="text-xs text-secondary-400 capitalize">{user?.role}</p>
          </div>
        </div>
      </div>

      {/* Search bar — expands below topbar on small screens */}
      {showSearch && (
        <div className="absolute top-16 left-0 right-0 bg-white border-b border-secondary-100 px-4 py-3 z-10 shadow-md sm:hidden">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" size={16} />
            <input
              type="text"
              placeholder="Search..."
              className="input-field pl-9"
              autoFocus
            />
          </div>
        </div>
      )}
    </header>
  );
}