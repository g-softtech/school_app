import { useState } from 'react';
import Sidebar from './Sidebar';
import Topbar  from './Topbar';

export default function DashboardLayout({ children, pageTitle }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-surface overflow-hidden">

      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Topbar */}
        <Topbar
          onMenuClick={() => setSidebarOpen(true)}
          pageTitle={pageTitle}
        />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>

      </div>
    </div>
  );
}