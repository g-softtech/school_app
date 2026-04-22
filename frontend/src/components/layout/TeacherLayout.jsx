import { Outlet, useLocation } from 'react-router-dom';
import DashboardLayout from './DashboardLayout';

const PAGE_TITLES = {
  '/teacher':                 'Dashboard',
  '/teacher/students':        'Students',
  '/teacher/teachers':        'Teachers',
  '/teacher/classes':         'Classes & Subjects',
  '/teacher/results':         'Results',
  '/teacher/payments':        'Payments',
  '/teacher/messages':        'Messages',
  '/teacher/analytics':       'Analytics',
  '/teacher/audit-logs':      'Audit Logs',
  '/teacher/classes':         'My Classes',
  '/teacher/lesson-notes':    'Lesson Notes',
  '/teacher/assignments':     'Assignments',
  '/teacher/planner':         'Weekly Planner',
  '/teacher/ai':              'AI Generator',
  '/teacher/analytics':       'My Progress',
};

export default function TeacherLayout() {
  const { pathname } = useLocation();
  const title = PAGE_TITLES[pathname] || 'Dashboard';

  return (
    <DashboardLayout pageTitle={title}>
      <Outlet />
    </DashboardLayout>
  );
}