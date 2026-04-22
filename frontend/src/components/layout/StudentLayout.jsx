import { Outlet, useLocation } from 'react-router-dom';
import DashboardLayout from './DashboardLayout';

const PAGE_TITLES = {
  '/student':                 'Dashboard',
  '/student/students':        'Students',
  '/student/teachers':        'Teachers',
  '/student/classes':         'Classes & Subjects',
  '/student/results':         'Results',
  '/student/payments':        'Payments',
  '/student/messages':        'Messages',
  '/student/analytics':       'Analytics',
  '/student/audit-logs':      'Audit Logs',
  '/student/classes':         'My Classes',
  '/student/lesson-notes':    'Lesson Notes',
  '/student/assignments':     'Assignments',
  '/student/planner':         'Weekly Planner',
  '/student/ai':              'AI Generator',
  '/student/analytics':       'My Progress',
};

export default function StudentLayout() {
  const { pathname } = useLocation();
  const title = PAGE_TITLES[pathname] || 'Dashboard';

  return (
    <DashboardLayout pageTitle={title}>
      <Outlet />
    </DashboardLayout>
  );
}