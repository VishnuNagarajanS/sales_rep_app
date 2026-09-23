import React from 'react';
import { Sidebar } from '../components/layout/Sidebar';
import { TopBar } from '../components/layout/TopBar';
import './AdminLayout.css';

interface AdminLayoutProps {
  currentRoute: string;
  onNavigate: (route: string) => void;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  currentRoute,
  onNavigate,
  children,
}) => {
  return (
    <div className="app-container admin-theme">
      {/* Super Admin Dark Console Sidebar */}
      <Sidebar currentRoute={currentRoute} onNavigate={onNavigate} />

      {/* Main Content Area */}
      <div className="main-content-area admin-layout-main">
        <TopBar onNavigate={onNavigate} onOpenQuickCreate={() => {}} />

        {/* Global Environment Banner */}
        <div className="admin-platform-banner">
          <span>⚡ PLATFORM OPERATOR CONSOLE — SYSTEM-WIDE GOVERNANCE & MULTI-TENANT PROVISIONING</span>
          <span className="admin-platform-status">API v2.4 • System Health: 99.98%</span>
        </div>

        <main className="page-scrollable">{children}</main>
      </div>
    </div>
  );
};
