import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-surface">
    <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin mx-auto" />
  </div>
);

export default function RoleRoute({ allowedRoles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner />;

  const isProtectedRoute =
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/teacher') ||
    location.pathname.startsWith('/student') ||
    location.pathname.startsWith('/parent');

  // Not logged in — redirect to login, preserving the intended destination
  if (!user && isProtectedRoute) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Logged in but wrong role
  if (user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}