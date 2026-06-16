import { NavLink, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiBookOpen, FiHome, FiUsers, FiBook, FiClipboard,
  FiBarChart2, FiCreditCard, FiMessageSquare,
  FiCalendar, FiFileText, FiAward, FiLogOut, FiCpu,
  FiActivity, FiList, FiUserCheck, FiGrid, FiArrowRight,
  FiPercent, FiBell, FiInbox, FiDownload,
} from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { getInitials } from '../../utils/helpers';
import { APP_NAME } from '../../utils/constants';

const NAV_ITEMS = {
  admin: [
    { to: '/admin',                icon: FiHome,          label: 'Dashboard'        },
    { to: '/admin/students',       icon: FiUsers,         label: 'Students'         },
    { to: '/admin/teachers',       icon: FiUserCheck,     label: 'Teachers'         },
    { to: '/admin/classes',        icon: FiBook,          label: 'Classes & Subjects'},
    { to: '/admin/results',        icon: FiAward,         label: 'Results'          },
    { to: '/admin/payments',       icon: FiCreditCard,    label: 'Payments'         },
    { to: '/admin/messages',       icon: FiMessageSquare, label: 'Messages'         },
    { to: '/admin/analytics',      icon: FiBarChart2,     label: 'Analytics'        },
    { to: '/admin/admissions',     icon: FiInbox,         label: 'Admissions'       },
    { to: '/admin/fee-structures', icon: FiPercent,       label: 'Fee Structures'   },
    { to: '/admin/billing',        icon: FiFileText,      label: 'Billing'          },
    { to: '/admin/sessions',       icon: FiCalendar,      label: 'Sessions & Terms' },
    { to: '/admin/timetable',      icon: FiGrid,          label: 'Timetable'        },
    { to: '/admin/promote',        icon: FiArrowRight,    label: 'Class Promotion'  },
    { to: '/admin/notifications',  icon: FiBell,          label: 'Notifications'    },
    { to: '/admin/audit-logs',     icon: FiList,          label: 'Audit Logs'       },
  ],
  teacher: [
    { to: '/teacher',                    icon: FiHome,          label: 'Dashboard'      },
    { to: '/teacher/classes',            icon: FiBook,          label: 'My Classes'     },
    { to: '/teacher/lesson-notes',       icon: FiFileText,      label: 'Lesson Notes'   },
    { to: '/teacher/assignments',        icon: FiClipboard,     label: 'Assignments'    },
    { to: '/teacher/results',            icon: FiAward,         label: 'Results'        },
    { to: '/teacher/planner',            icon: FiCalendar,      label: 'Weekly Planner' },
    { to: '/teacher/messages',           icon: FiMessageSquare, label: 'Messages'       },
    { to: '/teacher/announcements',      icon: FiBell,          label: 'Announcements'  },
    { to: '/teacher/ai',                 icon: FiCpu,           label: 'AI Generator'   },
  ],
  student: [
    { to: '/student',                    icon: FiHome,          label: 'Dashboard'      },
    { to: '/student/results',            icon: FiAward,         label: 'My Results'     },
    { to: '/student/lesson-notes',       icon: FiFileText,      label: 'Lesson Notes'   },
    { to: '/student/assignments',        icon: FiClipboard,     label: 'Assignments'    },
    { to: '/student/analytics',          icon: FiActivity,      label: 'My Progress'    },
    { to: '/student/announcements',      icon: FiBell,          label: 'Announcements'  },
    { to: '/student/messages',           icon: FiMessageSquare, label: 'Messages'       },
    { to: '/student/downloads',          icon: FiDownload,      label: 'Downloads'      },
  ],
  parent: [
    { to: '/parent',                     icon: FiHome,          label: 'Dashboard'      },
    { to: '/parent/results',             icon: FiAward,         label: "Child's Results"},
    { to: '/parent/payments',            icon: FiCreditCard,    label: 'Fee Payments'   },
    { to: '/parent/announcements',       icon: FiBell,          label: 'Announcements'  },
    { to: '/parent/messages',            icon: FiMessageSquare, label: 'Messages'       },
  ],
};

const ROLE_LABELS = {
  admin: 'Administrator', teacher: 'Teacher', student: 'Student', parent: 'Parent',
};

export default function Sidebar({ isOpen, onClose }) {
  const { user, logoutUser } = useAuth();
  const navigate         = useNavigate();
  const navItems         = NAV_ITEMS[user?.role] || [];

  const handleLogout = async () => {
    await logoutUser();
    toast.success('Logged out successfully');
    navigate('/', { replace: true });
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 lg:hidden animate-fade-in"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-secondary-900 flex flex-col z-30
        transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto
      `}>

        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-secondary-700 flex-shrink-0">
          <div className="w-9 h-9 bg-primary-500 rounded-xl flex items-center justify-center flex-shrink-0">
            <FiBookOpen className="text-white text-lg" />
          </div>
          <div>
            <p className="text-white font-bold text-base leading-tight">{APP_NAME}</p>
            <p className="text-primary-400 text-xs">{ROLE_LABELS[user?.role]}</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 min-w-0 overflow-y-auto py-4 px-3 space-y-0.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === `/${user?.role}`}
              onClick={onClose}
              className={({ isActive }) =>
                `nav-item transition-all duration-200 ${isActive ? 'nav-item-active shadow-sm' : 'nav-item-inactive hover:translate-x-0.5'}`
              }
            >
              <item.icon size={17} className="flex-shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User info + logout */}
        <div className="px-3 py-4 border-t border-secondary-700 space-y-1 flex-shrink-0">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {getInitials(user?.name)}
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-medium truncate">{user?.name}</p>
              <p className="text-secondary-400 text-xs truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="nav-item w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            <FiLogOut size={17} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
