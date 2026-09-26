import React, { useState, useEffect } from 'react';
import { Sidebar } from '../components/layout/Sidebar';
import { TopBar } from '../components/layout/TopBar';
import { superAdminService } from '../services/superAdminService';
import { BroadcastAnnouncement } from '../types';
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
  const [announcements, setAnnouncements] = useState<BroadcastAnnouncement[]>([]);
  const [maintenance, setMaintenance] = useState(() => superAdminService.getMaintenanceMode());

  const loadBannerData = () => {
    setAnnouncements(superAdminService.getAnnouncements());
    setMaintenance(superAdminService.getMaintenanceMode());
  };

  useEffect(() => {
    loadBannerData();
    window.addEventListener('nexus_admin_updated', loadBannerData);
    return () => window.removeEventListener('nexus_admin_updated', loadBannerData);
  }, []);

  const activeAnnouncement = announcements.find(a => a.isActive);

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
          <div className="admin-status-cluster">
            {maintenance.enabled && (
              <span className="maintenance-active-tag">● MAINTENANCE LOCK ACTIVE</span>
            )}
            <span className="admin-platform-status">API v2.4 • System Health: 99.98%</span>
          </div>
        </div>

        {/* Global Broadcast Announcement Banner (if active) */}
        {activeAnnouncement && (
          <div className={`platform-broadcast-banner priority-${activeAnnouncement.priority}`}>
            <span>📢 <strong>{activeAnnouncement.title}:</strong> {activeAnnouncement.message}</span>
            <button
              className="btn btn-ghost btn-xs text-white"
              onClick={() => onNavigate('admin-system')}
            >
              Manage &rarr;
            </button>
          </div>
        )}

        <main className="page-scrollable">{children}</main>
      </div>
    </div>
  );
};
