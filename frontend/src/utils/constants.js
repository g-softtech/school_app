export const APP_NAME    = import.meta.env.VITE_APP_NAME    || 'SmartSchool';
export const APP_TAGLINE = import.meta.env.VITE_APP_TAGLINE || 'Empowering Education Across Africa';
export const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://your-backend-domain.com/api' : 'http://localhost:5000/api');
export const SERVER_URL = API_URL.replace('/api', '');
export const FRONTEND_URL = import.meta.env.PROD ? 'https://smartschool-app.onrender.com' : 'http://localhost:5173';

if (import.meta.env.PROD && API_URL.includes('localhost')) {
  console.error('CRITICAL ERROR: API_URL is resolving to localhost in production!');
}

export const ROLES = { ADMIN: 'admin', TEACHER: 'teacher', STUDENT: 'student', PARENT: 'parent' };

export const TERMS    = ['first', 'second', 'third'];
export const SESSIONS = ['2024/2025', '2025/2026', '2026/2027'];

export const GRADE_COLORS = {
  A1: 'badge-success', B2: 'badge-success', B3: 'badge-success',
  C4: 'badge-info',    C5: 'badge-info',    C6: 'badge-info',
  D7: 'badge-warning', E8: 'badge-warning',
  F9: 'badge-danger',
};

export const FEE_TYPES = ['tuition', 'exam', 'sports', 'library', 'development', 'other'];