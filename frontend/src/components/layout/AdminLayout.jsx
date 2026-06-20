import { Outlet, useLocation } from 'react-router-dom';
import DashboardLayout from './DashboardLayout';
import ActiveOverrideBanner from '../common/ActiveOverrideBanner';

const PAGE_TITLES = {
  '/admin':                 'Dashboard',
  '/admin/students':        'Students',
  '/admin/teachers':        'Teachers',
  '/admin/classes':         'Classes & Subjects',
  '/admin/results':         'Results',
  '/admin/payments':        'Payments',
  '/admin/messages':        'Messages',
  '/admin/analytics':       'Analytics',
  '/admin/audit-logs':      'Audit Logs',
  '/admin/classes':         'My Classes',
  '/admin/lesson-notes':    'Lesson Notes',
  '/admin/assignments':     'Assignments',
  '/admin/planner':         'Weekly Planner',
  '/admin/ai':              'AI Generator',
  '/admin/analytics':       'My Progress',
};

export default function AdminLayout() {
  const { pathname } = useLocation();
  const title = PAGE_TITLES[pathname] || 'Dashboard';

  return (
    <DashboardLayout pageTitle={title}>
      <ActiveOverrideBanner />
      <Outlet />
    </DashboardLayout>
  );
}