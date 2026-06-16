import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiLock, FiEye, FiEyeOff, FiCheckCircle, FiAlertCircle, FiShield } from 'react-icons/fi';
import { updatePassword } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../utils/helpers';

const ROLE_ROUTES = {
  admin: '/admin', teacher: '/teacher', student: '/student', parent: '/parent',
};

function PasswordStrength({ password }) {
  if (!password) return null;
  const checks = [
    { label: 'At least 8 characters', pass: password.length >= 8 },
    { label: 'Contains a number',     pass: /\d/.test(password) },
    { label: 'Contains uppercase',    pass: /[A-Z]/.test(password) },
    { label: 'Contains lowercase',    pass: /[a-z]/.test(password) },
  ];
  const score  = checks.filter((c) => c.pass).length;
  const colors = ['bg-red-400', 'bg-amber-400', 'bg-yellow-400', 'bg-green-400', 'bg-green-500'];
  const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'];

  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-1">
        {[...Array(4)].map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i < score ? colors[score] : 'bg-secondary-200'}`} />
        ))}
      </div>
      <p className={`text-xs font-medium ${score >= 3 ? 'text-green-600' : score >= 2 ? 'text-amber-600' : 'text-red-500'}`}>
        {labels[score]}
      </p>
      <ul className="space-y-1">
        {checks.map((c) => (
          <li key={c.label} className={`flex items-center gap-1.5 text-xs transition-colors ${c.pass ? 'text-green-600' : 'text-secondary-400'}`}>
            {c.pass ? <FiCheckCircle size={11} /> : <FiAlertCircle size={11} />}
            {c.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ChangePassword() {
  const { user, logoutUser } = useAuth();
  const navigate         = useNavigate();

  const [form, setForm] = useState({
    currentPassword: '',
    newPassword:     '',
    confirmPassword: '',
  });
  const [show, setShow]     = useState({ current: false, new: false, confirm: false });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const fc = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  const toggleShow = (field) => setShow((p) => ({ ...p, [field]: !p[field] }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.currentPassword)          { toast.error('Please enter your current password'); return; }
    if (form.newPassword.length < 8)    { toast.error('New password must be at least 8 characters'); return; }
    if (form.newPassword !== form.confirmPassword) { toast.error('Passwords do not match'); return; }
    if (form.newPassword === form.currentPassword) { toast.error('New password must be different from current'); return; }

    setLoading(true);
    try {
      await updatePassword({
        currentPassword: form.currentPassword,
        newPassword:     form.newPassword,
      });
      setSuccess(true);
      toast.success('Password changed successfully!');
      // Log out after 2 seconds so they re-login with new password
        logoutUser();
        navigate('/login', { replace: true });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate(ROLE_ROUTES[user?.role] || '/login');
  };

  const passwordInput = (fieldName, displayLabel, showKey) => (
    <div>
      <label className="input-label">{displayLabel}</label>
      <div className="relative">
        <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary-400" size={15} />
        <input
          type={show[showKey] ? 'text' : 'password'}
          name={fieldName}
          value={form[fieldName]}
          onChange={fc}
          placeholder="••••••••"
          className="input-field pl-10 pr-10"
          required
          autoComplete={fieldName === 'currentPassword' ? 'current-password' : 'new-password'}
        />
        <button
          type="button"
          onClick={() => toggleShow(showKey)}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-secondary-400 hover:text-secondary-600 transition-colors"
        >
          {show[showKey] ? <FiEyeOff size={15} /> : <FiEye size={15} />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <FiShield className="text-primary-500" size={22} /> Change Password
        </h1>
        <p className="page-subtitle">Update your account password. You will be logged out after changing.</p>
      </div>

      <div className="card">
        {success ? (
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <FiCheckCircle className="text-green-600" size={32} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-secondary-800">Password Changed!</h3>
              <p className="text-secondary-500 text-sm mt-2">
                Redirecting you to login with your new password…
              </p>
            </div>
            <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin mx-auto" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Current user info */}
            <div className="flex items-center gap-3 p-3 bg-secondary-50 rounded-xl border border-secondary-100">
              <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {user?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-secondary-800 text-sm">{user?.name}</p>
                <p className="text-xs text-secondary-400">{user?.email} · <span className="capitalize">{user?.role}</span></p>
              </div>
            </div>

            <div className="border-t border-secondary-100 pt-4 space-y-4">
              {passwordInput('currentPassword', 'Current Password *', 'current')}

              <div className="border-t border-secondary-100 pt-4">
                {passwordInput('newPassword', 'New Password *', 'new')}
                <PasswordStrength password={form.newPassword} />
              </div>

              <div>
                {passwordInput('confirmPassword', 'Confirm New Password *', 'confirm')}
                {form.confirmPassword && form.newPassword !== form.confirmPassword && (
                  <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                    <FiAlertCircle size={11} /> Passwords do not match
                  </p>
                )}
                {form.confirmPassword && form.newPassword === form.confirmPassword && form.confirmPassword.length >= 8 && (
                  <p className="text-xs text-green-600 mt-1.5 flex items-center gap-1">
                    <FiCheckCircle size={11} /> Passwords match
                  </p>
                )}
              </div>
            </div>

            {/* Info box */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 flex items-start gap-2">
              <FiAlertCircle size={13} className="flex-shrink-0 mt-0.5" />
              <p>You will be automatically logged out after changing your password and redirected to the login page.</p>
            </div>

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={handleCancel} className="btn-secondary flex-1 min-w-0">
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || form.newPassword !== form.confirmPassword || form.newPassword.length < 8}
                className="btn-primary flex-1 min-w-0 disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center gap-2 justify-center">
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Updating…
                  </span>
                ) : 'Change Password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
