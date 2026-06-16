import { useState, useRef, useEffect } from 'react';
import { FiMenu, FiSearch, FiX, FiLogOut, FiShield, FiUser, FiChevronDown } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { logoutUser } from '../../services/authService';
import { getInitials } from '../../utils/helpers';
import NotificationBell from '../common/NotificationBell';

const ROLE_CHANGE_PASSWORD = {
  admin:   '/admin/change-password',
  teacher: '/teacher/change-password',
  student: '/student/change-password',
  parent:  '/parent/change-password',
};

export default function Topbar({ onMenuClick, pageTitle }) {
  const { user, logout }        = useAuth();
  const navigate                = useNavigate();
  const [showSearch, setShowSearch] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const profileRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfile(false);
      }
    };
    if (showProfile) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showProfile]);

  const handleLogout = async () => {
    try { await logoutUser(); } catch {}
    navigate('/', { replace: true });
    setTimeout(() => logout(), 0);
  };

  const handleChangePassword = () => {
    setShowProfile(false);
    navigate(ROLE_CHANGE_PASSWORD[user?.role] || '/login');
  };

  return (
    <header className="h-16 bg-white border-b border-secondary-100 flex items-center px-4 gap-3 flex-shrink-0 shadow-sm relative z-30">

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

        {/* Notification bell */}
        <NotificationBell />

        {/* User profile dropdown */}
        <div className="relative ml-1 pl-3 border-l border-secondary-100" ref={profileRef}>
          <button
            onClick={() => setShowProfile(!showProfile)}
            className="flex items-center gap-2 hover:bg-secondary-50 rounded-xl px-2 py-1.5 transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {getInitials(user?.name)}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-secondary-800 leading-tight">
                {user?.name?.split(' ')[0]}
              </p>
              <p className="text-xs text-secondary-400 capitalize">{user?.role}</p>
            </div>
            <FiChevronDown
              size={14}
              className={`text-secondary-400 transition-transform hidden md:block ${showProfile ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Dropdown */}
          {showProfile && (
            <div className="absolute right-0 top-12 w-56 bg-white rounded-2xl shadow-xl border border-secondary-100 overflow-hidden z-50">
              {/* User info header */}
              <div className="px-4 py-3 bg-secondary-50 border-b border-secondary-100">
                <p className="font-semibold text-secondary-800 text-sm truncate">{user?.name}</p>
                <p className="text-xs text-secondary-400 truncate">{user?.email}</p>
                <span className="inline-block mt-1 text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full capitalize font-medium">
                  {user?.role}
                </span>
              </div>

              {/* Menu items */}
              <div className="p-1.5 space-y-0.5">
                <button
                  onClick={handleChangePassword}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary-50 text-secondary-700 text-sm transition-colors text-left"
                >
                  <FiShield size={15} className="text-secondary-400" />
                  Change Password
                </button>
              </div>

              {/* Logout */}
              <div className="p-1.5 border-t border-secondary-100">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-50 text-red-500 text-sm transition-colors"
                >
                  <FiLogOut size={15} />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Search bar — expands below on mobile */}
      {showSearch && (
        <div className="absolute top-16 left-0 right-0 bg-white border-b border-secondary-100 px-4 py-3 z-10 shadow-md sm:hidden">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" size={16} />
            <input
              type="text"
              placeholder="Search…"
              className="input-field pl-9"
              autoFocus
            />
          </div>
        </div>
      )}
    </header>
  );
}
