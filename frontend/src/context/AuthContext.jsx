import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import api from '../services/api';
import { getMe, refreshToken as refreshTokenApi } from '../services/authService';

const AuthContext = createContext(null);

const ACCESS_TOKEN_LIFE_MS  = 15 * 60 * 1000;  // 15 minutes (must match backend JWT expiry)
const REFRESH_BEFORE_MS     = 2  * 60 * 1000;  // refresh 2 minutes before expiry
const WARN_BEFORE_MS        = 2  * 60 * 1000;  // warn user 2 minutes before expiry

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const refreshTimer  = useRef(null);
  const warnTimer     = useRef(null);
  const tokenIssuedAt = useRef(null);

  // ── Rehydrate from localStorage on mount ──────────────────────────────────
  useEffect(() => {
    const VALID_ROLES = ['admin', 'teacher', 'student', 'parent'];
    const token  = localStorage.getItem('accessToken');
    const stored = localStorage.getItem('user');
    if (token && stored) {
      try {
        const userData = JSON.parse(stored);
        // Guard against stale sessions with invalid/unrecognised roles
        if (!userData.role || !VALID_ROLES.includes(userData.role)) {
          console.warn('[Auth] Stale session with invalid role:', userData.role, '— clearing.');
          localStorage.removeItem('accessToken');
          localStorage.removeItem('user');
        } else {
          setUser(userData);
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        }
      } catch {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  // ── Clear all timers ───────────────────────────────────────────────────────
  const clearTimers = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    if (warnTimer.current)    clearTimeout(warnTimer.current);
  }, []);

  // ── Schedule silent token refresh + expiry warning ────────────────────────
  const scheduleRefresh = useCallback(() => {
    clearTimers();
    tokenIssuedAt.current = Date.now();

    // Warn user 2 mins before expiry
    warnTimer.current = setTimeout(() => {
      toast.warn(
        '⏰ Your session expires in 2 minutes. Any unsaved work will be kept.',
        { toastId: 'session-warning', autoClose: 90000 }
      );
    }, ACCESS_TOKEN_LIFE_MS - WARN_BEFORE_MS);

    // Auto-refresh 1 minute before expiry (gives 1 min buffer after warn)
    refreshTimer.current = setTimeout(async () => {
      try {
        const res = await refreshTokenApi();
        if (res.data.accessToken) {
          localStorage.setItem('accessToken', res.data.accessToken);
          api.defaults.headers.common['Authorization'] = `Bearer ${res.data.accessToken}`;
          toast.dismiss('session-warning');
          scheduleRefresh(); // reschedule for next cycle
        }
      } catch {
        // Refresh failed — logout gracefully
        toast.error('Your session has expired. Please log in again.');
        setTimeout(() => {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('user');
          delete api.defaults.headers.common['Authorization'];
          setUser(null);
        }, 1500);
      }
    }, ACCESS_TOKEN_LIFE_MS - REFRESH_BEFORE_MS);
  }, [clearTimers]);

  // ── Login ──────────────────────────────────────────────────────────────────
  const login = useCallback((accessToken, userData) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('user', JSON.stringify(userData));
    api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    setUser(userData);
    scheduleRefresh();
  }, [scheduleRefresh]);

  // ── Logout ─────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    clearTimers();
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
    toast.dismiss('session-warning');
  }, [clearTimers]);

  // ── Refresh user profile from server ──────────────────────────────────────
  const refreshUser = useCallback(async () => {
    try {
      const res = await getMe();
      const updated = res.data.user;
      localStorage.setItem('user', JSON.stringify(updated));
      setUser(updated);
    } catch {
      logout();
    }
  }, [logout]);

  // ── Start refresh timer when user is set on mount (persisted login) ────────
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token && user) {
      scheduleRefresh();
    }
    return clearTimers;
  }, [user, scheduleRefresh, clearTimers]);

  // ── Axios 401 interceptor — auto logout on hard token failure ─────────────
  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401 && user) {
          clearTimers();
          logout();
        }
        return Promise.reject(error);
      }
    );
    return () => api.interceptors.response.eject(interceptor);
  }, [user, logout, clearTimers]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
