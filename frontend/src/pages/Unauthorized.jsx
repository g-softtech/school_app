import { useNavigate } from 'react-router-dom';
import { FiShield, FiArrowLeft, FiLogOut } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';

const ROLE_ROUTES = {
  admin: '/admin', teacher: '/teacher', student: '/student', parent: '/parent',
};

const VALID_ROLES = ['admin', 'teacher', 'student', 'parent'];

export default function Unauthorized() {
  const navigate    = useNavigate();
  const { user, logoutUser } = useAuth();

  const isValidRole = user && VALID_ROLES.includes(user.role);
  const home        = isValidRole ? ROLE_ROUTES[user.role] : null;

  const handleDashboard = () => {
    if (home) {
      navigate(home, { replace: true });
    } else {
      // Invalid / stale role — clear everything and go to login
      logoutUser();
      navigate('/login', { replace: true });
    }
  };

  const handleGoBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      handleDashboard();
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-red-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <FiShield className="text-red-500" size={36} />
        </div>

        <h1 className="text-8xl font-bold text-secondary-100">403</h1>
        <h2 className="text-2xl font-semibold text-secondary-800 mt-2">Access Denied</h2>

        <p className="text-secondary-500 mt-3 text-sm leading-relaxed">
          You do not have permission to view this page.
          {user && isValidRole && ` You are logged in as ${user.role}.`}
          {user && !isValidRole && ' Your session data appears to be invalid.'}
          {!user && ' You are not logged in.'}
        </p>

        {/* Show session warning for invalid/stale role */}
        {user && !isValidRole && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
            Your saved session has an unrecognised role (<strong>{user.role}</strong>).
            Clicking below will clear it and redirect you to login.
          </div>
        )}

        <div className="flex gap-3 justify-center mt-6 flex-wrap">
          <button onClick={handleGoBack} className="btn-secondary flex items-center gap-2">
            <FiArrowLeft size={16} />
            Go back
          </button>

          {isValidRole ? (
            <button onClick={handleDashboard} className="btn-primary flex items-center gap-2">
              My dashboard
            </button>
          ) : (
            <button onClick={handleDashboard} className="btn-primary flex items-center gap-2">
              <FiLogOut size={15} />
              Sign in again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
