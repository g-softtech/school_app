import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import RoleRoute from './RoleRoute';

// Layouts
import AdminLayout   from '../components/layout/AdminLayout';
import TeacherLayout from '../components/layout/TeacherLayout';
import StudentLayout from '../components/layout/StudentLayout';
import ParentLayout  from '../components/layout/ParentLayout';

// Auth & shared
import Login        from '../pages/Login';
import NotFound     from '../pages/NotFound';
import Unauthorized from '../pages/Unauthorized';

// Admin pages
import AdminDashboard from '../pages/admin/Dashboard';
import AdminStudents  from '../pages/admin/Students';
import AdminTeachers  from '../pages/admin/Teachers';
import AdminClasses   from '../pages/admin/Classes';
import AdminSubjects  from '../pages/admin/Subjects';
import AdminResults   from '../pages/admin/Results';
import AdminPayments  from '../pages/admin/Payments';
import AdminMessages  from '../pages/admin/Messages';
import AdminAnalytics from '../pages/admin/Analytics';
import AdminAuditLogs from '../pages/admin/AuditLogs';

// Teacher pages
import TeacherDashboard   from '../pages/teacher/Dashboard';
import TeacherMyClasses   from '../pages/teacher/MyClasses';
import TeacherLessonNotes from '../pages/teacher/LessonNotes';
import TeacherAssignments from '../pages/teacher/Assignments';
import TeacherResults     from '../pages/teacher/Results';
import TeacherPlanner     from '../pages/teacher/Planner';
import TeacherMessages    from '../pages/teacher/Messages';
import TeacherAIGenerator from '../pages/teacher/AIGenerator';

// Student pages
import StudentDashboard   from '../pages/student/Dashboard';
import StudentResults     from '../pages/student/Results';
import StudentLessonNotes from '../pages/student/LessonNotes';
import StudentAssignments from '../pages/student/Assignments';
import StudentMessages    from '../pages/student/Messages';
import StudentAnalytics   from '../pages/student/Analytics';

// Parent pages
import ParentDashboard from '../pages/parent/Dashboard';
import ParentResults   from '../pages/parent/Results';
import ParentPayments  from '../pages/parent/Payments';
import ParentMessages  from '../pages/parent/Messages';

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  const routes = { admin: '/admin', teacher: '/teacher', student: '/student', parent: '/parent' };
  return <Navigate to={routes[user.role] || '/login'} replace />;
}

function LoginRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) {
    const routes = { admin: '/admin', teacher: '/teacher', student: '/student', parent: '/parent' };
    return <Navigate to={routes[user.role] || '/admin'} replace />;
  }
  return <Login />;
}

export default function AppRoutes() {
  return (
    <Routes>

      {/* Public */}
      <Route path="/"             element={<HomeRedirect />} />
      <Route path="/login"        element={<LoginRoute />} />
      <Route path="/unauthorized" element={<Unauthorized />} />

      {/* ── Admin portal ────────────────────────────────────── */}
      <Route element={<RoleRoute allowedRoles={['admin']} />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin"             element={<AdminDashboard />} />
          <Route path="/admin/students"    element={<AdminStudents />} />
          <Route path="/admin/teachers"    element={<AdminTeachers />} />
          <Route path="/admin/classes"     element={<AdminClasses />} />
          <Route path="/admin/subjects"    element={<AdminSubjects />} />
          <Route path="/admin/results"     element={<AdminResults />} />
          <Route path="/admin/payments"    element={<AdminPayments />} />
          <Route path="/admin/messages"    element={<AdminMessages />} />
          <Route path="/admin/analytics"   element={<AdminAnalytics />} />
          <Route path="/admin/audit-logs"  element={<AdminAuditLogs />} />
        </Route>
      </Route>

      {/* ── Teacher portal ──────────────────────────────────── */}
      <Route element={<RoleRoute allowedRoles={['teacher']} />}>
        <Route element={<TeacherLayout />}>
          <Route path="/teacher"               element={<TeacherDashboard />} />
          <Route path="/teacher/classes"       element={<TeacherMyClasses />} />
          <Route path="/teacher/lesson-notes"  element={<TeacherLessonNotes />} />
          <Route path="/teacher/assignments"   element={<TeacherAssignments />} />
          <Route path="/teacher/results"       element={<TeacherResults />} />
          <Route path="/teacher/planner"       element={<TeacherPlanner />} />
          <Route path="/teacher/messages"      element={<TeacherMessages />} />
          <Route path="/teacher/ai"            element={<TeacherAIGenerator />} />
        </Route>
      </Route>

      {/* ── Student portal ──────────────────────────────────── */}
      <Route element={<RoleRoute allowedRoles={['student']} />}>
        <Route element={<StudentLayout />}>
          <Route path="/student"              element={<StudentDashboard />} />
          <Route path="/student/results"      element={<StudentResults />} />
          <Route path="/student/lesson-notes" element={<StudentLessonNotes />} />
          <Route path="/student/assignments"  element={<StudentAssignments />} />
          <Route path="/student/messages"     element={<StudentMessages />} />
          <Route path="/student/analytics"    element={<StudentAnalytics />} />
        </Route>
      </Route>

      {/* ── Parent portal ───────────────────────────────────── */}
      <Route element={<RoleRoute allowedRoles={['parent']} />}>
        <Route element={<ParentLayout />}>
          <Route path="/parent"           element={<ParentDashboard />} />
          <Route path="/parent/results"   element={<ParentResults />} />
          <Route path="/parent/payments"  element={<ParentPayments />} />
          <Route path="/parent/messages"  element={<ParentMessages />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}