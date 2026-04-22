import { Outlet, useLocation } from 'react-router-dom';
import DashboardLayout from './DashboardLayout';

const PAGE_TITLES = {
  '/parent':                 'Dashboard',
  '/parent/students':        'Students',
  '/parent/teachers':        'Teachers',
  '/parent/classes':         'Classes & Subjects',
  '/parent/results':         'Results',
  '/parent/payments':        'Payments',
  '/parent/messages':        'Messages',
  '/parent/analytics':       'Analytics',
  '/parent/audit-logs':      'Audit Logs',
  '/parent/classes':         'My Classes',
  '/parent/lesson-notes':    'Lesson Notes',
  '/parent/assignments':     'Assignments',
  '/parent/planner':         'Weekly Planner',
  '/parent/ai':              'AI Generator',
  '/parent/analytics':       'My Progress',
};

export default function ParentLayout() {
  const { pathname } = useLocation();
  const title = PAGE_TITLES[pathname] || 'Dashboard';

  return (
    <DashboardLayout pageTitle={title}>
      <Outlet />
    </DashboardLayout>
  );
}